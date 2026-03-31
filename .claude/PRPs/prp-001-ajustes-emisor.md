# PRP-001: Ajustes del Emisor (Admin)

> **Estado**: PENDIENTE
> **Fecha**: 2026-03-31
> **Proyecto**: Panel Gestión de Fincas

---

## Objetivo

Crear una página de administración `/dashboard/ajustes-emisor` (solo accesible para rol `admin`) que permita editar los datos del emisor (nombre, dirección, ciudad y CIF), subir/cambiar el logo de empresa y la imagen de firma. Todos los PDFs generados en el sistema leerán estos datos desde la tabla `company_settings` de Supabase en lugar de las variables de entorno.

## Por Qué

| Problema | Solución |
|----------|----------|
| Los datos del emisor (nombre, dirección, CIF) están hardcodeados en variables de entorno o directamente en el código, lo que obliga a un deploy para cualquier cambio. | Una página de ajustes en BD permite cambiar datos del emisor en tiempo real sin tocar el código ni hacer deploy. |
| No hay forma de actualizar el logo o la firma de la empresa desde la interfaz. | Formulario con subida de imágenes al bucket `doc-assets`. |
| Los PDFs de distintos módulos (suplidos, varios, dashboard report) leen el emisor de fuentes diferentes (env vars, hardcoded). | Una única fuente de verdad: tabla `company_settings`. |

**Valor de negocio**: El administrador puede actualizar la identidad corporativa (marca, dirección fiscal, firma) sin depender del equipo técnico. Reduce tiempo de cambio de semanas a segundos.

## Qué

### Criterios de Éxito
- [ ] La página `/dashboard/ajustes-emisor` sólo es visible y accesible para usuarios con `rol = 'admin'`
- [ ] El formulario carga los datos actuales de `company_settings` al entrar
- [ ] Guardar el formulario actualiza la tabla con `upsert` sin errores
- [ ] Se puede subir/reemplazar el logo y la firma; las imágenes se guardan en el bucket `doc-assets` bajo rutas conocidas
- [ ] Los PDFs de suplidos, varios y dashboard report leen EMISOR desde `company_settings` (no desde env vars)
- [ ] `npm run typecheck` y `npm run build` pasan sin errores

### Comportamiento Esperado

1. Admin navega a la sección "ADMINISTRACIÓN" del Sidebar y ve el enlace "Ajustes Emisor"
2. Entra en la página, que carga el formulario con los valores actuales de BD
3. Puede editar: Nombre empresa, Dirección, Ciudad, CIF
4. Puede subir una nueva imagen de logo (PNG/JPG) — se muestra preview
5. Puede subir una nueva imagen de firma (PNG/JPG) — se muestra preview
6. Al guardar, los campos de texto se hacen `upsert` en `company_settings` y las imágenes se suben a `doc-assets`
7. Feedback de éxito/error con toast
8. La próxima vez que se genere cualquier PDF, se leen los nuevos datos de BD

---

## Contexto

### Referencias
- `src/app/dashboard/documentos/ajustes/page.tsx` — Patrón de página de ajustes existente (upsert en `document_settings`, misma estructura visual)
- `src/app/api/documentos/settings/route.ts` — API de lectura de settings existente (patrón a reusar)
- `src/app/api/documentos/suplidos/generate/route.ts` — Cómo se usa EMISOR actualmente en PDF (a migrar)
- `src/app/api/documentos/varios/generate/route.ts` — EMISOR hardcodeado (a migrar)
- `src/app/api/dashboard/report/route.ts` — EMISOR desde env vars (a migrar)
- `src/app/api/storage/upload/route.ts` — Patrón de subida de imágenes (bucket, optimización con sharp)
- `src/components/Sidebar.tsx` — Dónde añadir el nuevo enlace bajo `ADMIN_SECTION`
- `src/app/api/admin/vacations/settings/route.ts` — Patrón de verificación `isAdmin` en API routes

### Arquitectura Propuesta (Feature-First)

```
src/
├── app/
│   ├── dashboard/
│   │   └── ajustes-emisor/
│   │       └── page.tsx               # Página de ajustes del emisor (admin only)
│   └── api/
│       └── admin/
│           └── company-settings/
│               ├── route.ts           # GET (leer settings) + POST (guardar settings)
│               └── logo/
│                   └── route.ts       # POST (subir logo)
│               └── firma/
│                   └── route.ts       # POST (subir firma)
└── lib/
    └── getEmisor.ts                   # Helper compartido: lee EMISOR de company_settings
```

> Nota: Las rutas de imágenes se pueden consolidar en la API principal usando un parámetro `type=logo|firma`, reduciendo el número de archivos. Se decide en Fase 2.

### Modelo de Datos

```sql
-- Tabla para los ajustes del emisor
CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,      -- 'emisor_name', 'emisor_address', 'emisor_city', 'emisor_cif', 'logo_path', 'firma_path'
  setting_value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: solo lectura desde server (service role), solo admin puede escribir
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Política: cualquier usuario autenticado puede leer (los PDFs necesitan leer el emisor)
CREATE POLICY "Authenticated can read company_settings"
  ON company_settings FOR SELECT
  TO authenticated
  USING (true);

-- Política: solo admin puede insertar/actualizar (verificado via server action, no RLS directamente)
-- La escritura se hace desde API con service role key para simplificar
```

**Keys a usar en `company_settings`:**
| setting_key | Descripción |
|-------------|-------------|
| `emisor_name` | Nombre de la empresa |
| `emisor_address` | Dirección |
| `emisor_city` | Ciudad y CP |
| `emisor_cif` | CIF |
| `logo_path` | Path en bucket `doc-assets` del logo |
| `firma_path` | Path en bucket `doc-assets` de la firma |

**Rutas en bucket `doc-assets`:**
- Logo: `company/logo.png` (upsert, mismo nombre siempre para simplificar)
- Firma: `company/firma.png` (upsert, mismo nombre siempre)

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo se definen FASES. Las subtareas se generan al entrar a cada fase
> siguiendo el bucle agéntico (mapear contexto → generar subtareas → ejecutar)

### Fase 1: Base de Datos — Tabla `company_settings` + seed inicial
**Objetivo**: Crear la tabla en Supabase, habilitar RLS con políticas correctas, e insertar los valores actuales del emisor (tomados de `.env.local`) como seed inicial para no romper los PDFs durante la migración.
**Validación**: La tabla existe en Supabase, tiene las 6 keys (`emisor_name`, `emisor_address`, `emisor_city`, `emisor_cif`, `logo_path`, `firma_path`) con valores de producción reales, y las políticas RLS permiten SELECT a usuarios autenticados.

### Fase 2: API de Admin — GET y POST para `company_settings`
**Objetivo**: Crear `src/app/api/admin/company-settings/route.ts` con endpoint GET (lee settings, devuelve objeto) y POST (upsert de campos de texto y rutas de imagen). El endpoint POST verifica `rol = 'admin'` antes de escribir. Crear helper `src/lib/getEmisor.ts` que lee los 4 campos de texto de `company_settings` y devuelve el objeto `EMISOR` para usar en PDFs.
**Validación**: `GET /api/admin/company-settings` devuelve los 6 values. `POST` con datos actualizados guarda correctamente. Un usuario no-admin recibe 403.

### Fase 3: Página de Ajustes del Emisor (UI)
**Objetivo**: Crear `src/app/dashboard/ajustes-emisor/page.tsx` con formulario editable para los 4 campos de texto + dos secciones de upload de imagen (logo y firma) con previsualización. La página verifica `rol = 'admin'` al montar (redirige a `/dashboard` si no es admin). Añadir el enlace en `ADMIN_SECTION` del Sidebar.
**Validación**: Un usuario admin ve el formulario con valores cargados de BD. Un usuario no-admin es redirigido. El formulario guarda correctamente y muestra toast de éxito. Las imágenes subidas se previsual izan.

### Fase 4: Migrar PDFs al helper `getEmisor`
**Objetivo**: Reemplazar las definiciones hardcodeadas/env-vars de `EMISOR` en los tres archivos afectados (`suplidos/generate/route.ts`, `varios/generate/route.ts`, `dashboard/report/route.ts`) para que usen el helper `getEmisor()`. El helper usa `supabaseAdmin` (service role) para leer de `company_settings` sin depender de RLS.
**Validación**: Los tres archivos ya no tienen referencias a `process.env.EMISOR_*` ni strings hardcodeados de EMISOR. Generar un PDF de cada tipo muestra el nombre/dirección correcto leído de BD.

### Fase 5: Validación Final
**Objetivo**: Sistema funcionando end-to-end: ajustes guardados en BD, PDFs leen de BD, UI sólo accesible para admin.
**Validación**:
- [ ] `npm run typecheck` pasa sin errores
- [ ] `npm run build` exitoso
- [ ] Playwright: navegar a `/dashboard/ajustes-emisor` como admin → formulario cargado → cambiar nombre → guardar → toast éxito
- [ ] Playwright: generar un PDF de suplidos → verificar que muestra el nombre actualizado
- [ ] Playwright: intentar acceder como usuario no-admin → redirigido

---

## Aprendizajes (Self-Annealing)

> Esta sección CRECE con cada error encontrado durante la implementación.

### 2026-03-31: Valores iniciales de la tabla deben hacer seed en la migración
- **Contexto**: Si se crea la tabla vacía, los PDFs fallarán al intentar leer el emisor durante la transición.
- **Fix**: La migración SQL debe incluir INSERT de los 6 keys con los valores de producción actuales (del `.env.local`).
- **Aplicar en**: Siempre hacer seed de tablas de settings al crearlas.

---

## Gotchas

- [ ] El helper `getEmisor()` debe usar `supabaseAdmin` (service role key), no el cliente de usuario, porque las API routes de generación de PDF no tienen sesión de usuario en contexto
- [ ] Las imágenes del bucket `doc-assets` usan paths fijos (`company/logo.png`, `company/firma.png`) con `upsert: true` para evitar acumulación de archivos muertos
- [ ] El logo y la firma ya existen en el bucket bajo `certificados/logo-retenciones.png` — NO se migra ese path, es para otro tipo de documento. El logo/firma del emisor es un asset diferente
- [ ] La verificación de admin en la página frontend es para UX; la verificación real ocurre en la API (siempre doble verificación: página + API)
- [ ] `varios/generate/route.ts` tiene EMISOR hardcodeado (no usa env vars), prestar atención al migrar

## Anti-Patrones

- NO crear nuevos patrones si los existentes funcionan (reusar `document_settings` upsert pattern de `ajustes/page.tsx`)
- NO ignorar errores de TypeScript
- NO hardcodear valores del emisor en ningún archivo nuevo
- NO omitir validación de rol en los endpoints de escritura
- NO exponer el SUPABASE_SERVICE_ROLE_KEY en el cliente

---

*PRP pendiente aprobación. No se ha modificado código.*
