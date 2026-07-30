# PRP-004: Gestión de Contratos con Proveedores

> **Estado**: IMPLEMENTADO — pendiente aplicar migración en Supabase y ejecutar import con `--execute`
> **Fecha**: 2026-07-29
> **Proyecto**: Panel gestión de fincas - Serincosol

---

## Objetivo

Crear un sistema de gestión de contratos que vincula cada Comunidad con un Proveedor y un servicio contratado (mantenimiento de ascensor, limpieza, jardinería, etc.), con control de vencimiento y preaviso, pantalla de gestión CRUD como pestaña "Contratos" dentro de `/dashboard/proveedores` con buscador/filtro por comunidad y por proveedor, accesos de solo-consulta desde las fichas de Comunidad y Proveedor, avisos automáticos al acercarse la fecha de preaviso, e importación inicial de los 438 contratos existentes en `Contratos.xls`.

## Por Qué

| Problema | Solución |
|----------|----------|
| No existe registro centralizado de qué proveedor da cada servicio a cada comunidad, ni cuándo vence o hay que avisar de no renovación | Tabla única `contratos` con FKs a `comunidades` y `proveedores`, fechas de alta/vencimiento/preaviso |
| Con 438+ contratos, un listado plano es inmanejable para responder "¿qué contratos tiene esta comunidad?" o "¿qué contratos tiene este proveedor?" | Buscador/filtro en la pestaña Contratos por Comunidad y por Proveedor (además del filtro de estado ya existente vía `FilterBar`) |
| Los vencimientos de preaviso se pierden porque nadie los vigila manualmente | Cron diario que revisa `fecha_preaviso` e inserta notificaciones para los administradores, sin duplicar avisos |
| 438 contratos reales viven hoy en un Excel desestructurado (`Contratos.xls`, patrón de fila doble) | Script de importación única que parsea, matchea comunidades/proveedores existentes y reporta lo que no pudo matchear |
| Gestionar contratos desde cero sin reusar los componentes existentes generaría UI inconsistente | Reutilizar `DataTable`, `FormModal`, `FormSection`, `FormField`, `PageHeader`, `FilterBar`, `useCRUDPage` (mismo patrón que `proveedores` y `comunidades`) |
| Escribir el tipo de servicio a mano libre generaría datos sucios e inconsistentes en el listado/badges | `tipo_servicio` es un desplegable con catálogo cerrado de tipos de servicio; el detalle libre va en un campo `descripcion` aparte |

**Valor de negocio**: Evita perder renovaciones o dejar vencer contratos sin preaviso a proveedores (riesgo legal/económico), y da visibilidad cruzada de qué contrata cada comunidad sin buscar en Excel, con capacidad real de encontrar rápidamente los contratos de una comunidad o proveedor concreto entre cientos.

---

## Qué

### Criterios de Éxito

- [ ] Migración `contratos` aplicada con GRANTS explícitos + RLS + políticas, en el orden exigido por el estándar del proyecto
- [ ] Pestaña "Contratos" en `/dashboard/proveedores` con CRUD completo (crear, editar, listar, activar/desactivar, eliminar) reusando los componentes compartidos
- [ ] La pestaña Contratos incluye buscador/filtro por Comunidad y por Proveedor (selects tipo `SearchableSelect`, combinables entre sí y con el filtro de estado activo/inactivo)
- [ ] El formulario "Nuevo contrato" tiene `tipo_servicio` como **dropdown** con catálogo cerrado de tipos de servicio (incluye opción "Otro") y un campo `descripcion` separado de texto libre para detalles/observaciones
- [ ] Listado de contratos muestra badge visual cuando `fecha_preaviso` está vencida (rojo) o próxima ≤30 días (ámbar)
- [ ] Modal de detalle de Comunidad muestra sus contratos (solo lectura) con botón "Nuevo contrato" que abre el formulario en `/dashboard/proveedores` con `comunidad_id` preseleccionado
- [ ] Modal de detalle de Proveedor muestra sus contratos (solo lectura) con botón "Nuevo contrato" que preselecciona `proveedor_id`
- [ ] Cron diario `/api/cron/contratos-preaviso` inserta notificaciones para los administradores al llegar/pasar `fecha_preaviso`, sin crear duplicados si ya existe una notificación sin leer
- [ ] Script de importación de `Contratos.xls` inserta los ~438 contratos reales, matcheando comunidades por nombre (sin crear nuevas) y proveedores por nombre (creando el proveedor si no hay match), mapea el tipo de servicio libre del Excel al catálogo cerrado (con fallback a "Otro" + descripción), y genera un reporte de comunidades no matcheadas
- [ ] `npm run typecheck` y `npm run build` pasan sin errores

### Comportamiento Esperado (Happy Path)

1. Un gestor entra a `/dashboard/proveedores`, cambia a la pestaña "Contratos" y ve la lista de contratos con badges de vencimiento.
2. Usa el buscador para filtrar por una Comunidad concreta (o por un Proveedor concreto, o ambos a la vez) y ve solo los contratos que le interesan.
3. Crea un contrato nuevo seleccionando comunidad, proveedor, **tipo de servicio desde un desplegable** (ej. "Mantenimiento ascensor", "Limpieza", "Jardinería", "Extintores/PCI", "Desratización", "Seguros", "Administración", "Otro"), añade una descripción libre opcional y define las fechas.
4. Desde la ficha de una Comunidad, revisa qué contratos tiene activos sin salir del modal; si necesita dar de alta uno nuevo, pulsa "Nuevo contrato" y aterriza en la pestaña Contratos con la comunidad ya preseleccionada (tanto en el filtro como en el formulario de alta).
5. Mismo flujo simétrico desde la ficha de un Proveedor.
6. Cada noche, el cron revisa contratos cuya `fecha_preaviso` ya llegó o pasó y, si no hay ya un aviso pendiente para ese contrato, notifica a todos los administradores.
7. Una vez, se ejecuta el script de importación sobre `Contratos.xls` y se revisa el reporte de comunidades no matcheadas para dar de alta manualmente las que falten.

---

## Contexto

### Referencias (patrones existentes a seguir)

- `src/app/dashboard/proveedores/page.tsx` — patrón de página CRUD completa con `useCRUDPage`, `DataTable`, `FormModal`, modal de detalle con `createPortal`
- `src/app/dashboard/fichaje/admin/page.tsx` (líneas ~43, ~345-556) — patrón de pestañas con `useState<'a'|'b'|'c'>` + botones `border-b-2` (a reusar para `'proveedores' | 'contratos'`)
- `src/hooks/useCRUDPage.ts` — hook genérico de fetch/create/update/delete/toggleActive/detail; se reutiliza instanciándolo con `tableName: 'contratos'`. El filtro por Comunidad/Proveedor se añade como estado adicional propio de `ContratosTab.tsx` (no forma parte del hook genérico), combinándose con `crud.filteredData` igual que ya hace `filterEstado` internamente
- `src/components/FilterBar.tsx` y `src/components/SearchableSelect` (usado en `comunidades/page.tsx` e `incidencias`) — bases para construir la barra de filtros por Comunidad/Proveedor
- `src/app/dashboard/comunidades/page.tsx` — patrón de modal de detalle de Comunidad donde se debe insertar la sección de contratos de solo lectura
- `src/app/api/cron/fichaje-autoclose/route.ts` — patrón exacto de cron protegido por `Authorization: Bearer $CRON_SECRET`, usa `supabaseAdmin`, `export const dynamic = 'force-dynamic'`
- `supabase/migrations/20260212_vacations.sql` (líneas ~116-122) — patrón de notificar a **todos los admins**: `FOR admin_record IN (SELECT user_id FROM public.profiles WHERE rol = 'admin') LOOP INSERT INTO notifications (...) END LOOP` (en este PRP se replica en TypeScript dentro del cron, no en un trigger SQL, porque el disparador es una fecha, no un evento de fila)
- `src/lib/database.types.ts` (línea ~772) — columnas reales de `notifications`: `id, user_id, type, title, body, entity_type, entity_id, is_read, created_at` (NO existen columnas `content` ni `link` pese a que algún código legado las usa; usar `body`)
- `vercel.json` — array `crons` existente con `/api/cron/fichaje-autoclose`; añadir la nueva entrada ahí
- `supabase/migrations/20260121_create_proveedores.sql` — tabla `proveedores` (id SERIAL, nombre, telefono, email, cif, direccion, cp, ciudad, provincia, activo)
- `src/lib/schemas.ts` (línea 34) — tabla `comunidades` usa `id: number` (SERIAL) y `nombre_cdad` como nombre visible
- `Contratos.xls` (raíz del proyecto) — 876 filas = 438 contratos reales, patrón de fila doble (fila impar = datos del contrato, fila par = descripción/observaciones extendida)
- `package.json` — el proyecto ya usa `exceljs` para Excel, pero **`exceljs` NO soporta el formato binario legado `.xls`** (solo `.xlsx`); el script de importación necesita la librería `xlsx` (SheetJS), que sí lee `.xls`. Añadir `xlsx` como dependencia de desarrollo solo para el script, o convertir el archivo a `.xlsx` antes de parsear.

### Arquitectura Propuesta (Feature-First)

No se crea una feature nueva en `src/features/` porque el proyecto usa páginas directas en `src/app/dashboard/*` con componentes compartidos en `src/components/` y `src/hooks/` — se sigue ese mismo patrón:

```
src/app/dashboard/proveedores/
├── page.tsx                    # se añade tab switcher 'proveedores' | 'contratos'
└── ContratosTab.tsx             # NUEVO: contenido de la pestaña Contratos (CRUD + filtros)

src/components/
└── ContratoPreavisoBadge.tsx    # NUEVO: badge reutilizable (vencido/próximo/ok)

src/lib/
└── tiposServicioContrato.ts     # NUEVO: catálogo cerrado de tipos de servicio (constante compartida)

src/app/api/cron/
└── contratos-preaviso/
    └── route.ts                 # NUEVO: cron diario

scripts/
└── import-contratos.ts          # NUEVO: script de importación única (Node/TS, ts-node o tsx)
```

### Modelo de Datos

```sql
-- Migración: crear tabla contratos
CREATE TABLE public.contratos (
    id SERIAL PRIMARY KEY,
    comunidad_id INTEGER REFERENCES public.comunidades(id),
    proveedor_id INTEGER REFERENCES public.proveedores(id),
    tipo_servicio TEXT,
    descripcion TEXT,
    fecha_alta DATE,
    fecha_vencimiento DATE,
    fecha_preaviso DATE,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices para joins/filtrado frecuente (comunidad_id y proveedor_id son
-- exactamente las dos columnas por las que se filtra en la UI)
CREATE INDEX idx_contratos_comunidad_id ON public.contratos(comunidad_id);
CREATE INDEX idx_contratos_proveedor_id ON public.contratos(proveedor_id);

-- GRANTS explícitos (obligatorio desde el breaking change de Supabase 2026-04-28,
-- enforced 2026-10-30 — ver aprendizaje CLAUDE.md 2026-05-27)
-- No se otorga a `anon`: los contratos son información interna de gestión, nunca pública.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO service_role;
-- El id es SERIAL: la Data API también necesita poder usar la secuencia al insertar
GRANT USAGE, SELECT ON SEQUENCE public.contratos_id_seq TO authenticated, service_role;

-- Enable RLS
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- Políticas CRUD para authenticated (mismo patrón permisivo que proveedores/comunidades:
-- el control de acceso real de la app es por rol de negocio, no por RLS por fila)
CREATE POLICY "contratos: select for authenticated"
ON public.contratos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "contratos: insert for authenticated"
ON public.contratos FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "contratos: update for authenticated"
ON public.contratos FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "contratos: delete for authenticated"
ON public.contratos FOR DELETE
TO authenticated
USING (true);
```

Nota: `tipo_servicio` se guarda como `TEXT` libre en BD (flexibilidad futura y compatibilidad con la importación), pero la capa de UI **restringe su edición a un desplegable** con catálogo cerrado (ver `src/lib/tiposServicioContrato.ts` más abajo). No se modela como `ENUM` de Postgres para no requerir una migración cada vez que se añada un tipo de servicio nuevo — el catálogo vive en código.

### Diseño UI

- **Catálogo de tipos de servicio** (`src/lib/tiposServicioContrato.ts`): constante compartida, ej.:
  ```ts
  export const TIPOS_SERVICIO_CONTRATO = [
    'Mantenimiento ascensor',
    'Limpieza',
    'Jardinería',
    'Extintores / PCI',
    'Desratización y control de plagas',
    'Seguros',
    'Mantenimiento piscina',
    'Administración / Gestoría',
    'Electricidad',
    'Otro',
  ] as const;
  ```
  Usada tanto en el `<select>` del formulario de Contratos como en el script de importación (para mapear el texto libre del Excel al valor más cercano del catálogo, con "Otro" como fallback).
- **Pestaña "Contratos"**: en `src/app/dashboard/proveedores/page.tsx` se añade `const [activeTab, setActiveTab] = useState<'proveedores' | 'contratos'>('proveedores')` con el mismo estilo de tabs de `fichaje/admin/page.tsx` (`border-b-2`, color `yellow-400`/`yellow-600` activo). El contenido de la pestaña Contratos vive en un componente `ContratosTab.tsx` que instancia su propio `useCRUDPage<Contrato, ContratoFormData>({ tableName: 'contratos', entityLabel: 'contrato', nameField: 'tipo_servicio', selectQuery: '*, comunidades(nombre_cdad), proveedores(nombre)', ... })`.
  - **Buscador/filtro**: encima de la `DataTable`, dos `SearchableSelect` (uno de Comunidad, otro de Proveedor) con opción "Todas/Todos" por defecto, más el `FilterBar` de estado ya usado en `proveedores`/`comunidades`. El filtrado combinado (`comunidad_id` + `proveedor_id` + `activo`) se aplica en memoria sobre `crud.filteredData` con un `useMemo`, igual que se filtra hoy `filterEstado` dentro de `useCRUDPage` — no requiere cambios en el hook genérico, solo una capa de filtrado adicional en `ContratosTab.tsx`.
  - Formulario (`FormModal` + `FormSection` + `FormField`): selects de Comunidad y Proveedor (reusar `SearchableSelect`); `tipo_servicio` como **`<select>` nativo o `SearchableSelect`** poblado desde `TIPOS_SERVICIO_CONTRATO` (obligatorio); `descripcion` como `<textarea>` de texto libre y opcional para detalles/observaciones; `fecha_alta`, `fecha_vencimiento`, `fecha_preaviso` (inputs `type="date"`).
  - Validación Zod: `fecha_preaviso <= fecha_vencimiento` cuando ambas existen; `tipo_servicio` debe pertenecer al catálogo (o ser texto libre solo si se eligió "Otro", en cuyo caso el matiz va en `descripcion`).
  - Columna de `DataTable` con badge de preaviso: rojo "Vencido" si `fecha_preaviso < hoy`, ámbar "Próximo (Nd)" si `fecha_preaviso` está entre hoy y hoy+30 días, sin badge en otro caso. Lógica extraída a `src/components/ContratoPreavisoBadge.tsx` para reutilizarla también en las integraciones de solo lectura.
- **Query params de deep-link**: la página de Proveedores lee `useSearchParams()` — `?tab=contratos&comunidad_id=X` o `?tab=contratos&proveedor_id=Y` — para: (a) abrir directamente la pestaña Contratos, (b) preseleccionar ese mismo filtro de Comunidad/Proveedor en el buscador, y (c) desplegar el formulario de alta con el FK correspondiente ya preseleccionado en `defaultFormData`.
- **Integración en modal de detalle de Comunidad** (`src/app/dashboard/comunidades/page.tsx`): dentro del modal de detalle existente, nueva `FormSection title="Contratos"` que hace un fetch de solo lectura (`supabase.from('contratos').select('*, proveedores(nombre)').eq('comunidad_id', selectedDetail.id)`), lista filas compactas (proveedor, tipo_servicio, badge de preaviso) y un botón "Nuevo contrato" que navega a `/dashboard/proveedores?tab=contratos&comunidad_id={id}`.
- **Integración en modal de detalle de Proveedor** (`src/app/dashboard/proveedores/page.tsx`, modal ya existente): misma sección simétrica, filtrando `.eq('proveedor_id', selectedDetail.id)` e incluyendo `comunidades(nombre_cdad)`, botón "Nuevo contrato" hacia `?tab=contratos&proveedor_id={id}`.

### Mecanismo de Aviso

Nuevo endpoint `src/app/api/cron/contratos-preaviso/route.ts`, calcado de `src/app/api/cron/fichaje-autoclose/route.ts`:

- `export const dynamic = 'force-dynamic'`, valida `Authorization: Bearer ${CRON_SECRET}`.
- Query con `supabaseAdmin`: `contratos` activos con `fecha_preaviso <= hoy` (usar `<=` para cubrir tanto "llega hoy" como "ya pasó" — contratos vencidos que no se hayan desactivado siguen avisando cada día hasta que un gestor actúe).
- Para cada contrato candidato, comprobar si ya existe una notificación sin leer para ese contrato: `notifications.entity_type = 'contrato' AND notifications.entity_id = contrato.id AND is_read = false` — si existe, **saltar** (evita duplicados; el aviso reaparece solo si el admin ya marcó el anterior como leído y el contrato sigue sin resolverse al día siguiente, comportamiento aceptado y documentado en Gotchas).
- Si no existe, obtener todos los `profiles` con `rol = 'admin'` (mismo patrón que `20260212_vacations.sql`) e insertar una notificación por admin: `{ user_id: admin.user_id, type: 'contrato_preaviso', title: 'Preaviso de contrato próximo a vencer', body: '<tipo_servicio> con <proveedor> (<comunidad>) — vence el <fecha_vencimiento>', entity_type: 'contrato', entity_id: contrato.id, is_read: false }`.
- Registrar el nuevo cron en `vercel.json`:

```json
{
    "path": "/api/cron/contratos-preaviso",
    "schedule": "0 6 * * *"
}
```

(el header de `Authorization` con `$CRON_SECRET` ya aplica a todo `/api/cron/(.*)` por el bloque `headers` existente, no hace falta tocarlo).

### Estrategia de Importación (`Contratos.xls`)

Script de una sola ejecución: `scripts/import-contratos.ts` (ejecutar con `npx tsx scripts/import-contratos.ts` o `ts-node`, no forma parte del build de la app).

1. **Dependencia**: añadir `xlsx` (SheetJS) a `devDependencies` — `exceljs` no lee `.xls` binario legado.
2. **Parseo de fila doble**: leer la hoja, iterar de dos en dos filas (`i`, `i+1`); la fila impar (`i`) trae los datos estructurados del contrato (comunidad, proveedor, tipo de servicio, fechas), la fila par (`i+1`) trae la `descripcion` extendida asociada al mismo contrato. Resultado: 876 filas → 438 objetos `ContratoRaw`.
3. **Matching de Comunidad**: normalizar strings (trim, lowercase, sin tildes) y comparar contra `comunidades.nombre_cdad` fetcheadas una vez al inicio. Si no hay match exacto/aproximado (similaridad razonable, ej. `includes` en ambas direcciones tras normalizar), **no crear comunidad nueva**: registrar la fila en el array de "no matcheadas" para el reporte y omitir el contrato.
4. **Matching de Proveedor**: mismo criterio de normalización contra `proveedores.nombre`. Si no hay match, **sí crear** el proveedor nuevo (`insert` mínimo con solo `nombre` y `activo: true`) y usar el id recién creado.
5. **Mapeo de tipo de servicio**: normalizar el texto libre de la columna de servicio del Excel y mapearlo al valor más parecido de `TIPOS_SERVICIO_CONTRATO` (import compartido desde `src/lib/tiposServicioContrato.ts`); si no hay coincidencia razonable, usar `'Otro'` y volcar el texto original del Excel dentro de `descripcion` (prefijado, ej. `"[Origen Excel: <texto original>] <descripcion fila par>"`) para no perder información.
6. **Inserción**: `insert` en lote (o por lotes de ~100) en `contratos` con los ids resueltos.
7. **Reporte**: al finalizar, escribir `scripts/reports/contratos-import-report.txt` (o imprimir por consola) con: total de filas procesadas, total insertado, lista de comunidades no matcheadas (con el nombre tal cual venía en el Excel) para revisión manual, proveedores creados automáticamente, y contratos cuyo tipo de servicio cayó en "Otro" (para revisar si conviene ampliar el catálogo).
8. El script es idempotente en la medida de lo posible: si se re-ejecuta, debe evitar duplicar contratos ya importados (ej. comprobando existencia previa por combinación `comunidad_id + proveedor_id + tipo_servicio + fecha_alta` antes de insertar), dado que no hay una clave natural única en el Excel origen.

---

## Blueprint (Assembly Line)

> Solo se listan FASES. Las subtareas se generan al entrar a cada fase (bucle agéntico: mapear contexto real → generar subtareas → ejecutar).

### Fase 1: Modelo de Datos
**Objetivo**: Migración `contratos` aplicada en Supabase con GRANTS + RLS + políticas en el orden exigido, e índices creados.
**Validación**: `list_tables` muestra `contratos`; `get_advisors` sin warnings de seguridad nuevos; insert/select de prueba funciona vía cliente `authenticated`.

### Fase 2: CRUD de Contratos con buscador (pestaña en /dashboard/proveedores)
**Objetivo**: Pestaña "Contratos" funcional con listado, alta, edición, activar/desactivar, eliminación, badge de preaviso, `tipo_servicio` como dropdown del catálogo cerrado con `descripcion` como campo libre separado, y buscador/filtro combinable por Comunidad y por Proveedor.
**Validación**: `npm run typecheck` pasa; flujo completo de crear/editar/eliminar un contrato probado manualmente o vía Playwright; el dropdown de tipo de servicio solo permite valores del catálogo (más "Otro"); filtrar por una Comunidad y por un Proveedor reduce correctamente el listado, combinado con el filtro de estado.

### Fase 3: Integraciones de solo lectura (Comunidad y Proveedor)
**Objetivo**: Modal de detalle de Comunidad y modal de detalle de Proveedor muestran sus contratos asociados con badge de preaviso, y el botón "Nuevo contrato" navega a la pestaña Contratos con la FK correspondiente preseleccionada tanto en el filtro como en el formulario de alta (vía query params).
**Validación**: Desde una ficha de Comunidad y desde una ficha de Proveedor, el botón "Nuevo contrato" abre el formulario correcto con el FK ya rellenado y el buscador ya filtrado a esa misma entidad.

### Fase 4: Mecanismo de Aviso (cron de preaviso)
**Objetivo**: Endpoint `/api/cron/contratos-preaviso` registrado en `vercel.json`, protegido por `CRON_SECRET`, que notifica a los admins sin duplicar avisos.
**Validación**: Llamada manual al endpoint con el header correcto crea notificaciones para contratos con preaviso vencido/hoy; una segunda llamada inmediata no duplica notificaciones sin leer.

### Fase 5: Importación de Contratos.xls
**Objetivo**: Script `scripts/import-contratos.ts` ejecutado una vez, contratos reales cargados en producción/staging, con `tipo_servicio` mapeado al catálogo cerrado, y reporte de comunidades no matcheadas generado y revisado.
**Validación**: Conteo de contratos insertados coherente con las 438 filas reales menos las omitidas por comunidad no matcheada; reporte legible y completo, incluyendo cuántos contratos cayeron en "Otro".

### Fase 6: Validación Final
**Objetivo**: Sistema funcionando end-to-end.
**Validación**:
- [ ] `npm run typecheck` pasa
- [ ] `npm run build` exitoso
- [ ] Playwright/screenshot confirma la pestaña Contratos, el buscador/filtro, los badges y las integraciones en los modales de detalle
- [ ] Todos los criterios de éxito del PRP cumplidos

---

## 🧠 Aprendizajes (Self-Annealing)

### 2026-07-29: No hay vía de DDL automatizada en este entorno
- **Error**: El MCP de Supabase tiene placeholders en `.mcp.json` (sin `SUPABASE_ACCESS_TOKEN`), la CLI no está logueada y no existe `DATABASE_URL` ni RPC `exec_sql`.
- **Fix**: La migración se deja escrita en `supabase/migrations/` y se aplica manualmente en el SQL Editor del dashboard (o configurando el token del MCP). Los datos (select/insert) sí funcionan vía REST con `SUPABASE_SERVICE_ROLE_KEY` de `.env.local`.
- **Aplicar en**: Cualquier fase futura que requiera DDL en este proyecto.

### 2026-07-29: Policies permisivas `USING (true)` son una regresión aquí
- **Error**: El borrador inicial de la migración copiaba el patrón de `20260121_create_proveedores.sql` (escritura para todo `authenticated`), patrón que el proyecto ya abandonó en `20260210_secure_tables.sql` + `20260410_proveedores_gestor_write.sql`.
- **Fix**: Tablas nuevas sensibles: SELECT para authenticated, escritura solo `is_admin()` + roles `gestor`/`empleado` vía subquery a `profiles`.
- **Aplicar en**: Todas las migraciones futuras de este proyecto (validado por supabase-guardian).

### 2026-07-29: El matching de comunidades del Excel salió 100%
- Dry-run del import: 438/438 contratos matchean comunidad (0 omitidos), 123 proveedores nuevos a crear, 5 contratos caen en tipo "Otro".

---

## Gotchas

- [ ] `exceljs` no lee `.xls` legado — el script de importación necesita `xlsx` (SheetJS) como dependencia adicional
- [ ] El cron de preaviso puede volver a notificar el mismo contrato al día siguiente si el admin ya marcó como leída la notificación anterior y el contrato sigue sin resolverse (comportamiento aceptado, no es un bug)
- [ ] `contratos.id` es `SERIAL`: no olvidar el `GRANT USAGE, SELECT ON SEQUENCE public.contratos_id_seq` además del grant sobre la tabla, o los `insert` desde `authenticated` fallarán con `permission denied for sequence`
- [ ] El patrón de fila doble del Excel origen no tiene clave natural única — el script de importación debe decidir su propio criterio de idempotencia antes de re-ejecutarse
- [ ] Las columnas reales de `notifications` son `body` (no `content`) y no existe columna `link` — usar el esquema real de `database.types.ts`, no el de código legado que las usa incorrectamente
- [ ] `tipo_servicio` es `TEXT` libre en BD pero **debe** presentarse siempre como dropdown en la UI (nunca como input de texto libre) — el texto libre real va en `descripcion`
- [ ] El buscador por Comunidad/Proveedor debe combinarse con el filtro de estado (`activo`/`inactivo`) ya existente, no sustituirlo — validar que los tres filtros funcionan combinados (AND), no solo por separado

## Anti-Patrones

- NO crear comunidades nuevas automáticamente durante la importación aunque no haya match — siempre reportar para revisión manual
- NO usar `anon` para el grant de `contratos` — es información interna, nunca pública
- NO duplicar notificaciones de preaviso para un mismo contrato mientras haya una sin leer
- NO hardcodear el color de los badges fuera de `ContratoPreavisoBadge.tsx` (evitar que el criterio de "próximo/vencido" viva en dos sitios)
- NO permitir que `tipo_servicio` se edite como texto libre en el formulario — siempre dropdown del catálogo compartido
- NO omitir validación Zod en el formulario de contratos (fechas coherentes: `fecha_preaviso <= fecha_vencimiento`, `fecha_alta` no futura respecto a `fecha_vencimiento`)

---

*PRP pendiente aprobación. No se ha modificado código.*
