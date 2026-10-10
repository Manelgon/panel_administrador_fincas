# PRP-007: Autocierre de fichajes fiable + flujo de rectificación (empleado propone, admin aprueba)

> **Estado**: APROBADO
> **Fecha**: 2026-10-10
> **Proyecto**: Panel gestión de fincas - Serincosol
> **Nota de numeración**: PRP-006 queda reservado para "quitar n8n / multi-instalación" (ver memoria del proyecto).

---

## Objetivo

Que ningún fichaje pueda quedar abierto más del máximo configurado (8h) y que, cuando el sistema lo cierre, el trabajador proponga su hora real de salida con un motivo y un administrador la apruebe o rechace, quedando registrado quién, cuándo y qué valor había antes (registro de jornada auditable, art. 34.9 ET).

## Por Qué

| Problema | Solución |
|----------|----------|
| El cron de Vercel corre a `0 17 * * *` UTC (19:00 Madrid en verano, 18:00 en invierno) y la función SQL solo actúa si la hora Madrid es exactamente `daily_execution_hour = 18` → en horario de verano nunca cierra nada. Solo hay 1 autocierre en la historia (15-ene-2026) y 0 notas `[AUTO-CIERRE]` desde marzo. | Quitar la comprobación de hora: el cron cierra **siempre** todo lo que exceda el máximo, con `end_at = start_at + máximo`. |
| `clock_in` lanza "Ya tienes un fichaje abierto" → el empleado cierra el de ayer (ahora) y queda un fichaje de ~24h. | `clock_in` autocierra el fichaje viejo excedido y abre el nuevo. `clock_out` sobre un fichaje excedido lo cierra a `start + máximo` como autocierre, no a `now()`. |
| La UI, el CSV y el PDF leen `entry.closed_by`, pero la columna no existe → todo aparece como "Usuario". El autocierre solo añade texto a `note`. | Columna `closed_by` ('user' \| 'admin' \| 'auto') y estado de revisión en `time_entries`. |
| La hora del autocierre (start + 8h) no es la real. Corregirla editando la fila sin rastro no sirve ante una inspección. | Tabla `time_entry_corrections`: hora propuesta, motivo, estado, revisado_por, revisado_at y valor original. La fila solo cambia por RPC al aprobar. |
| Hoy el empleado tiene permiso RLS de UPDATE/INSERT sobre sus propios `time_entries` → puede reescribir sus horas por REST sin rastro. | Quitar UPDATE/INSERT directos al rol `authenticated` (no-admin); todo pasa por RPCs `security definer` que dejan traza. |

**Valor de negocio**: registro horario fiable y defendible ante la Inspección de Trabajo (sanción grave por no llevarlo bien), horas reales en los informes mensuales y fin de las jornadas fantasma de 24h. Además es requisito para vender el panel a otras administradoras.

## Qué

### Criterios de Éxito
- [ ] Un fichaje abierto más de `max_hours_duration:max_minutes_duration` (8:00) se cierra solo en la siguiente ejecución del cron, sea cual sea la estación del año, con `end_at = start_at + máximo`, `closed_by = 'auto'` y `review_status = 'pendiente'`.
- [ ] Fichar entrada con un fichaje viejo excedido abierto **no da error**: el viejo se autocierra (igual que el cron) y se abre el nuevo. Fichar salida de un fichaje excedido no crea una jornada de más de 8h.
- [ ] El empleado ve en `/dashboard/fichaje` un banner con sus fichajes autocerrados/pendientes y puede proponer hora real de salida + motivo (validado con Zod y en SQL: posterior a la entrada, no futura, como mucho el cierre automático o el límite que se fije).
- [ ] El admin ve en `/dashboard/fichaje/admin` la lista de solicitudes pendientes y puede aprobar (se aplica la hora y queda `corregido`) o rechazar con comentario; cada decisión guarda `revisado_por`, `revisado_at` y el `end_at` original.
- [ ] CSV, PDF y resumen muestran correctamente Usuario / Admin / Autocierre (y "Corregido" cuando aplique), sin cambios de formato que rompan lo que ya se envía.
- [ ] Los fichajes largos históricos (hoy 22 de más de 9h desde marzo-2026, 5 empleados) quedan marcados como pendientes de revisión y aparecen en ambos flujos.
- [ ] Un empleado no puede modificar `start_at`/`end_at` de sus fichajes por REST directo (comprobado con su JWT).

### Comportamiento Esperado

**Autocierre (cron)**
1. Vercel llama a `/api/cron/fichaje-autoclose` una vez al día (horario UTC que no importe: la función ya no mira la hora).
2. `auto_close_stale_sessions()` cierra todos los `end_at IS NULL` con `now() - start_at > máximo`: `end_at = start_at + máximo`, `closed_by = 'auto'`, `review_status = 'pendiente'`. No toca `note`.
3. El route registra la actividad (como ahora) y crea una notificación al empleado: "Tu fichaje del {día} se cerró automáticamente a las {hora}. Indica tu hora real de salida".

**Empleado ficha al día siguiente sin haber cerrado**
1. Pulsa "Fichar entrada" (página o Navbar). `clock_in` detecta el abierto, ve que excede el máximo, lo autocierra (mismo cálculo) y abre el nuevo.
2. Si el abierto **no** excede el máximo, se mantiene el error actual (ficha dos veces en la misma jornada).
3. La UI muestra un toast: "Tu fichaje anterior se cerró automáticamente. Revisa la hora de salida" y aparece el banner.

**Empleado propone su hora real**
1. Banner en `/dashboard/fichaje`: "Tienes N fichajes pendientes de revisar". Cada uno con entrada, cierre automático y botón "Indicar hora real".
2. Modal: hora de salida (fecha + hora, por defecto el día de la entrada) + motivo obligatorio (mín. 5 caracteres). Zod en cliente; RPC `request_time_entry_correction` valida en SQL que el fichaje es suyo, que no tiene ya una solicitud pendiente y que la hora es > `start_at` y <= `now()`.
3. La fila pasa a `review_status = 'solicitado'`; se notifica a los admins.
4. Opción "La hora del cierre automático es correcta" → solicitud con `proposed_end_at = end_at` actual (confirmación, también la aprueba el admin).

**Admin revisa**
1. Nueva pestaña/sección "Rectificaciones" en `/dashboard/fichaje/admin` con contador. Tabla: empleado, día, entrada, salida registrada, salida propuesta, duración resultante, motivo, fecha de solicitud.
2. Aprobar → RPC `review_time_entry_correction(id, true, comentario)`: guarda `original_end_at`, aplica `end_at = proposed_end_at`, `review_status = 'corregido'`, `revisado_por = auth.uid()`, `revisado_at = now()`. Rechazar → `estado = 'rechazada'`, la fila vuelve a `pendiente` para que el empleado proponga otra, con el comentario visible.
3. El admin también puede ver y corregir directamente un fichaje pendiente sin solicitud (empleado de baja, etc.), dejando la misma traza (solicitud creada por el admin y aprobada en el acto).
4. Se notifica al empleado la resolución; se registra en `activity_logs`.

---

## Contexto

### Referencias (código existente)
- `vercel.json` — cron `/api/cron/fichaje-autoclose` a `0 17 * * *`.
- `src/app/api/cron/fichaje-autoclose/route.ts` — llama a RPC `auto_close_stale_sessions`, inserta `activity_logs` (muchos `any`, limpiar).
- `supabase/migrations/20240114_time_tracking.sql` — `time_entries`, `clock_in`, `clock_out`, `has_open_entry`, políticas RLS (incluye UPDATE/INSERT propios).
- `supabase/migrations/20240117_fichaje_settings.sql` — `fichaje_settings` (singleton), `admin_clock_out` (añade `[Cerrado por Admin]` a `note`), `auto_close_stale_sessions` (con la comprobación de hora).
- `src/app/dashboard/fichaje/page.tsx` (384 líneas) — página del empleado; `rpc('clock_in')`, `rpc('clock_out')`, historial.
- `src/components/Navbar.tsx` — fichaje rápido con las mismas RPCs (hay que tratar el nuevo aviso aquí también).
- `src/app/dashboard/fichaje/admin/page.tsx` (622 líneas, ya por encima del límite de 500) — control, ajustes (`daily_execution_hour`), informes, vacaciones. La sección nueva va en componente aparte.
- `src/components/fichaje/EmployeeResume.tsx`, `src/app/api/fichaje/resumen/route.ts`, `src/app/api/fichaje/export/csv/route.ts`, `src/lib/pdf/fichajeResume.ts` — ya consumen `closed_by`; funcionarán en cuanto exista la columna.
- `src/app/api/cron/contratos-preaviso/route.ts` + tabla `notifications` + `NotificationsBell.tsx` — patrón de notificaciones a admins.
- `src/lib/logActivity.ts` — registro de actividad.
- `src/lib/database.types.ts` — actualizar a mano (no hay generación automática).

### Estado actual en producción (consultado por REST, 2026-10-10)
- `fichaje_settings`: `auto_close_enabled = true`, `max_hours_duration = 8`, `max_minutes_duration = 0`, `daily_execution_hour = 18`.
- `time_entries`: 751 filas desde 1-mar-2026; 0 abiertas ahora; 211 de más de 8h, 22 de más de 9h (5 empleados), de ellas 9 de entre 14,6h y 24,6h; 0 con `[AUTO-CIERRE]` en la nota.

### Arquitectura Propuesta

El proyecto no usa `src/features/`: sigue el patrón existente de fichaje (`src/app/dashboard/fichaje/*` + `src/components/fichaje/*`) y RPCs `security definer` como `clock_in`.

```
supabase/migrations/20261010_fichaje_rectificaciones.sql   # SQL para pegar a mano
src/components/fichaje/
├── PendingReviewBanner.tsx        # banner + lista del empleado
├── CorrectionRequestModal.tsx     # hora propuesta + motivo (Zod)
├── CorrectionsAdminPanel.tsx      # lista de pendientes del admin + aprobar/rechazar
└── closedByLabel.ts               # 'user'|'admin'|'auto' -> texto (compartido UI/CSV/PDF)
src/lib/fichaje/
├── schemas.ts                     # Zod: solicitud y revisión
└── types.ts                       # ClosedBy, ReviewStatus, TimeEntryCorrection
src/app/api/cron/fichaje-autoclose/route.ts   # + notificación al empleado, sin any
vercel.json                                    # horario del cron (ya no depende de la hora)
```

Decisiones:
- **Mutaciones solo por RPC** (`security definer`, `search_path = public`), igual que hoy. Nada de UPDATE directo desde el cliente; así la traza es obligatoria.
- **El cálculo de autocierre vive en una sola función SQL** (`close_entry_as_auto(entry_id)` interna) que usan el cron, `clock_in` y `clock_out`. DRY y mismo resultado en los tres caminos.
- **`daily_execution_hour` queda obsoleta**: se quita de la UI de ajustes; la columna se deja (no borrar columnas en una migración manual).
- **No se toca `note`** en adelante. Las notas históricas con `[AUTO-CIERRE]` / `[Cerrado por Admin]` se traducen a `closed_by` en la migración (sin borrar el texto).
- **Horario del cron**: `0 22 * * *` UTC (medianoche/23:00 Madrid) para que los olvidos del día queden cerrados antes de la mañana siguiente. Si el plan de Vercel lo permite, horario (`0 * * * *`); con Hobby solo se admite diario y basta, porque `clock_in`/`clock_out` cubren el resto.

### Modelo de Datos

```sql
-- 1) time_entries: columnas nuevas (tabla existente, ya tiene grants)
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS closed_by text
    CHECK (closed_by IN ('user','admin','auto')),
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'ok'
    CHECK (review_status IN ('ok','pendiente','solicitado','corregido')),
  ADD COLUMN IF NOT EXISTS original_end_at timestamptz;   -- end_at antes de la 1ª corrección

-- Un solo fichaje abierto por usuario (evita carreras en clock_in)
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_open_per_user
  ON public.time_entries (user_id) WHERE end_at IS NULL;

-- Backfill
UPDATE public.time_entries SET closed_by = 'auto'  WHERE end_at IS NOT NULL AND note LIKE '%[AUTO-CIERRE]%';
UPDATE public.time_entries SET closed_by = 'admin' WHERE end_at IS NOT NULL AND note LIKE '%[Cerrado por Admin]%';
UPDATE public.time_entries SET closed_by = 'user'  WHERE end_at IS NOT NULL AND closed_by IS NULL;
UPDATE public.time_entries SET review_status = 'pendiente'
  WHERE end_at IS NOT NULL
    AND start_at >= '2026-03-01'
    AND end_at - start_at > interval '9 hours';          -- ~22 filas hoy

-- 2) Solicitudes de corrección (tabla nueva)
CREATE TABLE public.time_entry_corrections (
  id               bigserial PRIMARY KEY,
  time_entry_id    bigint NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  user_id          uuid   NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,  -- dueño del fichaje
  requested_by     uuid   NOT NULL REFERENCES public.profiles(user_id),                    -- empleado o admin
  previous_end_at  timestamptz NOT NULL,      -- end_at en el momento de la solicitud
  proposed_end_at  timestamptz NOT NULL,
  reason           text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 500),
  status           text NOT NULL DEFAULT 'pendiente'
                     CHECK (status IN ('pendiente','aprobada','rechazada')),
  reviewed_by      uuid REFERENCES public.profiles(user_id),
  reviewed_at      timestamptz,
  review_comment   text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX time_entry_corrections_one_pending
  ON public.time_entry_corrections (time_entry_id) WHERE status = 'pendiente';
CREATE INDEX time_entry_corrections_status_idx
  ON public.time_entry_corrections (status, created_at DESC);

GRANT SELECT ON public.time_entry_corrections TO authenticated;            -- escrituras solo vía RPC
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entry_corrections TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.time_entry_corrections_id_seq TO service_role;

ALTER TABLE public.time_entry_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corrections: read own or admin" ON public.time_entry_corrections
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- 3) RLS time_entries: quitar escritura directa del empleado
--    INSERT/UPDATE solo admin; el empleado escribe vía clock_in / clock_out / RPCs.

-- 4) Funciones (security definer, search_path = public)
--    close_entry_as_auto(_id)                      -- interna, no expuesta a authenticated
--    auto_close_stale_sessions()                    -- sin comprobación de hora; usa la anterior
--    clock_in(_note)                                -- autocierra el excedido en vez de error
--    clock_out()                                    -- excedido => autocierre; normal => closed_by 'user'
--    admin_clock_out(_user_id)                      -- closed_by 'admin', sin tocar note
--    request_time_entry_correction(_entry_id, _proposed_end_at, _reason)
--    review_time_entry_correction(_correction_id, _approve, _comment)   -- solo admin
--    admin_correct_time_entry(_entry_id, _end_at, _reason)              -- solicitud + aprobación en el acto
--    REVOKE EXECUTE ... FROM anon/public en todas; GRANT EXECUTE TO authenticated en las públicas.
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo definir FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar)

### Fase 1: Migración SQL (entregable para pegar a mano)
**Objetivo**: Archivo `supabase/migrations/20261010_fichaje_rectificaciones.sql` idempotente con columnas, backfill, tabla de correcciones con GRANTs y RLS, índice de un abierto por usuario, RLS endurecida y todas las funciones. Revisado por `supabase-guardian` antes de entregarlo. Manel lo pega en el SQL Editor.
**Validación**: Por REST con service role: existen `closed_by`/`review_status`/`original_end_at`, `time_entry_corrections` responde, `rpc/auto_close_stale_sessions` devuelve `[]` sin error, ~22 filas en `pendiente`, ninguna fila con `closed_by` nulo y `end_at` no nulo.

### Fase 2: Cron y lógica de fichar
**Objetivo**: Route del cron sin `any`, con notificación al empleado afectado; horario nuevo en `vercel.json`; página del empleado y Navbar tratan el autocierre en `clock_in` (toast) y `clock_out`; ajustes del admin sin `daily_execution_hour` y con texto explicativo correcto.
**Validación**: Llamada manual al cron con `CRON_SECRET` en local cierra un fichaje de prueba excedido; fichar entrada con uno viejo abierto no da error; `npm run typecheck` pasa.

### Fase 3: Flujo del empleado (banner + solicitud)
**Objetivo**: `PendingReviewBanner` y `CorrectionRequestModal` en `/dashboard/fichaje`; historial muestra quién cerró y estado de revisión; notificación a admins al solicitar.
**Validación**: Con un usuario empleado de prueba: aparece el banner, se envía la solicitud, la fila pasa a `solicitado`, no se puede enviar una segunda pendiente ni una hora futura o anterior a la entrada.

### Fase 4: Flujo del admin (revisión)
**Objetivo**: `CorrectionsAdminPanel` en `/dashboard/fichaje/admin` con contador, aprobar/rechazar con comentario y corrección directa por admin; notificación y `activity_logs` al empleado; extraer lo necesario para que la página no siga creciendo.
**Validación**: Aprobar aplica la hora y guarda `original_end_at`, `reviewed_by`, `reviewed_at`; rechazar devuelve la fila a `pendiente` con comentario visible al empleado.

### Fase 5: Informes y fichajes históricos
**Objetivo**: CSV, PDF y resumen muestran Usuario/Admin/Autocierre y "Corregido"; el resumen mensual refleja horas corregidas; repaso de los ~22 fichajes largos históricos con Manel (cuáles reclamar a cada empleado y cuáles corrige el admin directamente).
**Validación**: Exportar CSV y PDF de un mes con fichajes de los tres tipos y uno corregido; lista de históricos resuelta o asignada.

### Fase 6: Validación Final
**Objetivo**: Sistema funcionando end-to-end
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run lint` sin errores nuevos
- [ ] `npm run build` exitoso
- [ ] Playwright: banner del empleado, modal, panel del admin (screenshots)
- [ ] Un empleado no puede hacer PATCH directo a `time_entries` con su JWT
- [ ] Criterios de éxito cumplidos

---

## 🧠 Aprendizajes (Self-Annealing / Neural Network)

> Esta sección CRECE con cada error encontrado durante la implementación.

_(vacío)_

---

## Gotchas

- [ ] **Sin DDL automatizado**: la migración se entrega como SQL para pegar en el dashboard. Debe ser idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`) por si se pega dos veces. Las fases 2-5 no se pueden probar hasta que Manel la aplique.
- [ ] **GRANTs explícitos** en `time_entry_corrections` (cambio de Supabase de 2026). La secuencia `bigserial` también necesita grant para `service_role`.
- [ ] **Cambiar la firma/retorno de una función** (`clock_out`, `auto_close_stale_sessions`) exige `DROP FUNCTION` antes del `CREATE` si cambia el tipo de retorno. Mantener las firmas actuales si es posible para no romper la app desplegada mientras se aplica la migración.
- [ ] **Orden de despliegue**: la migración debe aplicarse antes de publicar el código nuevo (el código lee columnas nuevas). El código actual sigue funcionando con la migración aplicada (solo añade columnas).
- [ ] **Quitar el UPDATE/INSERT propios** en `time_entries` puede romper algo que escriba directo: verificar con grep que nada salvo RPCs escribe en `time_entries` (hoy solo `universal-delete` y `delete-user` con service role).
- [ ] **Índice único de abierto por usuario**: comprobar antes que no hay dos abiertos del mismo usuario (hoy 0 abiertos).
- [ ] **Zona horaria**: la hora propuesta la escribe el empleado en hora de Madrid; convertir a `timestamptz` correctamente (no `new Date('YYYY-MM-DDTHH:mm')` sin zona en servidor). El resumen agrupa por `start_at.split('T')[0]` (día UTC): para entradas de antes de las 02:00 Madrid el día sale mal. Anotar, no arreglar aquí salvo que afecte.
- [ ] **Vercel Hobby** solo admite crons diarios; comprobar el plan antes de poner un horario por horas.
- [ ] **`notifications.type`**: comprobar si tiene CHECK o enum de tipos permitidos antes de insertar `fichaje_autocierre` / `fichaje_rectificacion`.
- [ ] **Umbral de históricos**: con máximo 8h hay 211 fichajes de más de 8h (jornadas normales de 8h y pico); por eso el backfill marca solo los de más de 9h. Confirmar con Manel.
- [ ] `admin/page.tsx` ya tiene 622 líneas: no añadir la sección nueva dentro; componente aparte.

## Anti-Patrones

- NO corregir horas con UPDATE directo sobre `time_entries` (ni desde el admin): siempre por RPC que deja solicitud y revisor.
- NO borrar ni sobrescribir el valor original: `original_end_at` y `previous_end_at` son la prueba ante inspección.
- NO volver a usar `note` como campo de estado.
- NO depender de la hora de ejecución del cron para decidir qué cerrar.
- NO usar `any` (el route del cron actual los tiene: sustituir por tipos).
- NO omitir validación Zod en la hora propuesta y el motivo.

---

*PRP pendiente aprobación. No se ha modificado código.*

---

## Decisiones confirmadas (2026-10-10)

1. **Históricos**: NO tocar los fichajes antiguos. La migración solo traduce `[AUTO-CIERRE]`/`[Cerrado por Admin]` de `note` a `closed_by`; ningún histórico pasa a `pendiente`. La Fase 5 queda reducida a informes (sin marcado histórico).
2. **Corrección directa por admin**: SÍ, con el mismo rastro que una solicitud aprobada (fila en `time_entry_corrections` creada y aprobada por el admin, `original_end_at` guardado).
3. **Vercel**: plan Hobby → cron una vez al día (`0 22 * * *` UTC) + autocierre en clock_in/clock_out.

**Estado**: APROBADO

---

## Estado de avance (2026-10-10) — EN PAUSA por decisión de Manel

- **Fase 1 (SQL)**: escrita en `supabase/migrations/20261010_fichaje_rectificaciones.sql`. Revisada por supabase-guardian: sin bloqueantes. **NO aplicada** en Supabase.
  - Antes de pegarla, comprobar que nadie tiene dos fichajes abiertos (si no, el índice único falla y la transacción se revierte entera):
    `select user_id, count(*) from public.time_entries where end_at is null group by 1 having count(*) > 1;`
  - Avisos menores: regenerar `database.types.ts`; quitar `daily_execution_hour` de la UI; `validate_time_entry_end` limita a 16h.
- **Fases 2-6**: sin empezar. No se ha tocado código de `src/`.
- **Al retomar**: trabajar en una rama aparte (no en master), aplicar la migración solo tras revisarla con Manel y desplegar el código después de la migración.
- Solo existe un proyecto Supabase (el de producción, `.env.local`); no hay entorno de pruebas.
