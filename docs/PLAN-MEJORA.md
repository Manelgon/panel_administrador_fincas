# Plan de mejora del proyecto — Panel Serincosol

**Fecha:** julio 2026 · **Stack:** Next.js 16 (App Router) + Supabase + TypeScript
**Alcance:** calidad de código, arquitectura, nomenclatura de BD y desacople de n8n.
_(La seguridad y el RGPD se auditaron y remediaron aparte; ver commits de julio 2026.)_

Este documento es una hoja de ruta para revisar. Está ordenado por **relación valor/riesgo**: lo de arriba da mucho con poco riesgo; lo de abajo es más profundo o más delicado. No hace falta hacerlo todo ni en orden estricto.

> **Leyenda de esfuerzo/riesgo:** 🟢 bajo · 🟡 medio · 🔴 alto (puede romper cosas).

---

## Bloque 0 — Limpieza inmediata (🟢 casi sin riesgo)

Cosas que se pueden borrar/arreglar hoy sin tocar comportamiento.

- [ ] **Borrar código muerto:** `src/lib/supabase/client.ts` no lo importa nadie (0 usos; los 30 imports usan `src/lib/supabaseClient.ts`).
- [ ] **Borrar andamiaje vacío:** `src/features/` (solo README) y `src/shared/*/` (solo `.gitkeep`) sugieren una arquitectura que no existe. O se adopta o se borra.
- [ ] **Env var muerta:** `IMPORT_TICKETS_PDF_WEBHOOK` (la importación de PDF ya es 100% nativa, no usa n8n). Actualizar también `.env.local.example`, que documenta un `/api/webhooks/*` que **no existe**.
- [ ] **Ficheros basura versionados en la raíz:** `staged_a.txt`, `unstaged.txt`, `modified_files.txt`, `test-resolve.js`, screenshots y PDFs/DOCX de ejemplo. Sacar del repo.
- [ ] **Tabla `MIGRATION BBDD`** (con espacio en el nombre, vacía, sin RLS): borrarla. Ya lo tenías anotado.

---

## Bloque 1 — Duplicación mecánica (🟢 bajo esfuerzo, alto retorno)

Extraer a helpers compartidos lo que hoy está copiado a mano.

- [ ] **`src/lib/format.ts`** con `formatDateEU`, `formatDateTime`, `formatCurrency`. Hoy `formatDateEU` está redefinida inline en 4+ rutas de documentos y el formateo de € se hace a mano en 26 ficheros.
- [ ] **`src/lib/pdf/shared.ts`** con la constante `A4`, los colores (`YELLOW`, `BORDER`) y `downloadAssetPng` (lógica idéntica copiada en 14 ficheros).
- [ ] **Cliente admin único:** sustituir las creaciones inline de `createClient(...SERVICE_ROLE...)` (en `admin/delete-incident`, `admin/universal-delete`, `admin/list-profiles`, `reports/email/delete`…) por el import del singleton `src/lib/supabase/admin.ts`.
- [ ] **Un solo motor de PDF:** portar los 2 usos de `jspdf`/`jspdf-autotable` (`cronometraje/page.tsx`, `reuniones/lib/generarPortadasPdf.ts`) a `pdf-lib` (ya en 17 ficheros) y eliminar esas 2 dependencias.
- [ ] **Factories para rutas gemelas:** las 5 rutas `signed-url` y las 3 `send` de documentos son casi idénticas → `createSignedUrlHandler(bucket)` y `createSendHandler(config)`. Elimina ~5 ficheros.
- [ ] **Un solo modal de borrado:** `DeleteComunidadModal` y `DeleteConfirmationModal` son casi iguales → uno parametrizable.

---

## Bloque 2 — Reducir la dependencia de n8n (🟡 el objetivo que pediste)

Hoy n8n hace de bus para 3 cosas: enviar emails con PDF, puente OneDrive/buzón + resumen IA, y WhatsApp (avisos + Sofía-Bot). Orden por retorno:

- [ ] **P1 · Emails de documentos con Resend directo** ⭐ *mayor retorno.*
  Los 6 endpoints de `documentos/*/send` y `fichaje/export/send` solo usan n8n como "SMTP + plantilla". El código **ya descarga el PDF de Storage y arma el adjunto**; solo falta instalar el paquete `resend` (no está instalado, solo hay un placeholder en `.env`), recrear la plantilla HTML y cambiar el `fetch(n8n)` por `resend.emails.send()`.
  **Bonus crítico:** hoy 4 de esos endpoints devuelven `ok:true` aunque el email falle (`.catch` silencioso) → el usuario cree que se envió. Al migrar, hacer que devuelvan error real.
- [ ] **P2 · Avisos WhatsApp: mover los joins al código.**
  Los 4 avisos (ticket/deuda nuevo/resuelto) salen por *Supabase DB Webhooks* y n8n hace los joins (comunidad, gestor, teléfono) para el mensaje. El panel ya tiene esos datos al insertar → hacer el join en el API route y dejar n8n solo como transporte (o WhatsApp Cloud API directa).
- [ ] **P3 · Resumen IA de emails con OpenAI en código.**
  En el informe de comunidad, n8n hace (1) leer el buzón y (2) resumir con IA. La parte (2) es replicable con `OPENAI_API_KEY` (ya se usa en `presupuestos/analyze`). Solo (1) necesita acceso al buzón.
- [ ] **P4 · OneDrive vía Microsoft Graph directo** (requiere registrar app en Azure AD).
- [ ] **P5 · Sofía-Bot (intake WhatsApp): dejarlo en n8n.** Requiere WhatsApp Business API + RAG; bajo retorno de migrar.

> Tras P1–P4, n8n quedaría reducido casi solo al canal de Sofía-Bot, que es lo único difícil de replicar.

---

## Bloque 3 — Arquitectura (🟡 esfuerzo medio, gran impacto en mantenibilidad)

Los tres cambios de mayor retorno del proyecto:

- [ ] **Capa de servicios.** Hoy **39 componentes de UI** llaman directamente a `supabase.from()` (incluidos `DataTable`, `Sidebar`, `Navbar`). Crear `src/lib/services/` con funciones tipadas por dominio (`comunidadesService.list()`, etc.); los componentes llaman al servicio, no a Supabase. Es la base para tipar, testear y desacoplar.
- [ ] **Server Components + carga en servidor.** Las 22 páginas del dashboard son `"use client"` y cargan datos con `useEffect`+`fetch`. Mover la carga inicial a Server Components / route handlers y dejar `"use client"` solo en las islas interactivas. Es la mayor mejora de rendimiento disponible en Next 16.
- [ ] **Caché de datos en cliente.** Cero uso de SWR/React Query: cada componente refetchea por su cuenta (Navbar, Sidebar, NotificationsBell → varios round-trips por navegación). Adoptar SWR o React Query para caché/dedupe, o resolver vía server-fetch del punto anterior.
- [ ] **Descomponer las páginas-monstruo:** `incidencias/page.tsx` (**3.446 líneas**), `sofia/page.tsx` (1.883), `deudas/page.tsx` (1.782). Separar fetching (hooks) + cálculo (servicios) + render (subcomponentes). Priorizar `incidencias` y `deudas`.
- [ ] **Aprovechar `useCRUDPage`:** es un hook CRUD genérico y bien hecho, pero solo lo usan 2 de ~15 páginas CRUD. Migrar más (avisos, deudas…) o extraer sub-hooks.
- [ ] **Estandarizar el patrón de ruta:** solo 17 de 60 rutas usan `requireAuth`/`requireAdmin` y solo 8 de 60 validan con Zod (`validateRequest`), pese a estar ambos montados. Adoptarlos en el resto: `auth → validación → lógica → respuesta`.

---

## Bloque 4 — Nomenclatura y salud de la BD (🔴 alto riesgo, hacer con cuidado)

⚠️ **Renombrar columnas/tablas rompe a la vez el código, los tipos generados Y los flujos de n8n.** No se hace "a lo loco". Divido en lo seguro y lo delicado.

### 4a — Seguro de hacer ya (🟢)
- [ ] **Borrar tablas duplicadas/fantasma** (previa confirmación de que están vacías o en desuso):
  - `MIGRATION BBDD` — copia vacía de `incidencias`, con espacio en el nombre.
  - Revisar `chat_temporal` vs `n8n_chat_temporal_ai` (dos tablas de chat) y `time_entries_monthly` vs `monthly_hours` (dos agregados de horas; probablemente vistas) — consolidar.
- [ ] **Activar RLS** en `n8n_chat_temporal_ai` (tiene RLS activado sin policy → inaccesible o incoherente).

### 4b — Deuda de nomenclatura (🔴 planificar, no improvisar)
Inconsistencias reales detectadas en el esquema:
- **Nombres de persona sin convención:** `incidencias.nombre_cliente`, `morosidad.nombre_deudor`, `profiles.nombre`, `proveedores.nombre`; apellidos como `apellido` / `apellidos` / **`apellid_cliente`** (typo en `propietarios`).
- **Email inconsistente:** `propietarios.mail` vs `email` / `email_deudor` en el resto.
- **"Gestor" con 4 nombres:** `gestor_asignado`, `gestor`, `quien_lo_recibe`, `resuelto_por`.
- **Tipos de id mezclados:** casi todo `bigint`, pero `proveedores.id` e `incidencias.proveedor_id` son `integer`, y `reuniones.comunidad_id` es `integer` (mismatch con `comunidades.id` bigint → FKs frágiles).
- **`incidencias_serincobot.timestamp`:** columna con nombre de palabra reservada; además esta tabla es un duplicado casi exacto de `incidencias`.
- **`aviso` con 3 tipos distintos** (integer / smallint / text) para el mismo concepto.
- **Nombres crípticos:** `rag_cdades`.

**Cómo abordarlo sin romper (recomendado):**
1. Fijar la convención objetivo y documentarla en `CLAUDE.md`.
2. Migrar **tabla por tabla**, no todo de golpe. Para cada renombrado: `ALTER ... RENAME`, regenerar `database.types.ts`, actualizar el código, y **actualizar los flujos de n8n que tocan esa tabla en el mismo momento** (mirar el Bloque 2 para saber cuáles).
3. Alternativa de bajo riesgo: crear **vistas** con los nombres nuevos sobre las tablas viejas y migrar el código a las vistas gradualmente, renombrando físico al final.
> Sugerencia: hacer esto **después** del Bloque 2 (desacople de n8n), porque cuanto menos toque n8n la BD, menos frágil es cada renombrado.

---

## Bloque 5 — Tipado (🟡 metódico, en tandas)

- [ ] **403 usos de `any`** en `src` (sobre todo en rutas API). `database.types.ts` ya está generado; al tipar los clientes con `<Database>` afloran ~101 desajustes, **varios son bugs reales** (como los de columnas ya arreglados).
- [ ] **Plan por tandas:** activar los tipos y arreglar los ~101 en lotes de 10-15, verificando el build en cada lote. Empezar por la categoría "columna que no existe" (los bugs reales).
- [ ] Activar `@typescript-eslint/no-explicit-any` como *warning* para frenar la sangría.
- [ ] Centralizar tipos de dominio en `src/types/` derivados de `database.types.ts` (hoy están inline y dispersos).

---

## Bloque 6 — Errores, tests, config y convenciones (🟢/🟡)

- [ ] **Errores uniformes:** 233 `NextResponse.json({error})` a mano, solo 9 con `safeApiError`, 145 `console.*` sueltos. Estandarizar en `safeApiError` + un helper `apiError(status, msg)` + un logger único.
- [ ] **Tests en lo crítico:** hoy solo 2 ficheros de test. Priorizar unitarios de lógica pura (cálculos de deudas, `fichaje/resumen`, esquemas Zod) y e2e de los flujos clave (login, crear incidencia, generar documento). `vitest` y `playwright` ya están configurados.
- [ ] **Config:** subir `tsconfig` de `target: ES2017` → `ES2022`; añadir reglas de calidad a ESLint (`no-explicit-any`, `no-console`); revisar `allowJs`.
- [ ] **Convención de idioma:** mezcla español/inglés en carpetas (`documentos`/`avisos` vs `reports`/`storage`) y en código. Fijar una regla (p.ej. dominio en español, infra en inglés) y documentarla. No renombrar todo, pero frenar la divergencia.

---

## Orden recomendado

1. **Bloque 0 + Bloque 1** — un par de sesiones, sin riesgo, dejan el repo mucho más limpio.
2. **Bloque 2 (P1: emails con Resend)** — quita el fallo silencioso y el mayor punto único de fallo.
3. **Bloque 3 (capa de servicios + un par de páginas-monstruo)** — la mayor mejora estructural.
4. **Bloque 5 (tipos en tandas)** en paralelo, poco a poco.
5. **Bloque 4 (nomenclatura BD)** al final y con cuidado, tabla por tabla, cuando n8n ya toque menos la BD.
6. **Bloque 6** de forma continua.

Nada de esto es urgente ni afecta a la seguridad (ya cerrada). Es inversión en mantenibilidad y en reducir la dependencia de n8n.
