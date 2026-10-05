# PRP-005: Facturación multi-emisor con VeriFactu (Admin)

> **Estado**: FASES 1–4 IMPLEMENTADAS (2026-09-30) — pendiente aplicar `supabase/migrations/20260930_create_facturacion.sql` en Supabase y probar de punta a punta
> **Fecha**: 2026-09-30
> **Proyecto**: Panel gestión de fincas - Serincosol

---

## Objetivo

Crear un apartado **Facturación** para administradores donde se emiten facturas eligiendo **con qué facturador** (Serincosol S.L., Roberto como autónomo y AFCademia). Cada facturador tiene sus datos fiscales, logo, color, IBAN, IVA/IRPF por defecto, numeración propia y pie legal. Las facturas cumplen el reglamento de sistemas de facturación (RD 1007/2023, VeriFactu) **sin enviarlas a Hacienda** por ahora.

## Decisiones (Manel, 2026-09-30)

| Tema | Decisión |
|------|----------|
| Facturadores | Serincosol S.L., Roberto (autónomo), AFCademia. Sus datos los rellenan desde el panel. |
| Visibilidad | Todos los administradores ven y usan todos los facturadores. |
| VeriFactu | Adaptar el panel al reglamento, pero **sin envío** a la AEAT. Reutilizar el módulo `001 - Automatizatelo/006 - Modulo Verifactu`. |
| AFCademia | Sus facturas y clientes se guardan en el Supabase de Serincosol. Confirmado. |
| "Factura varios" | Se queda como está (es para otra cosa). No se toca. |
| Numeración | Cada facturador configura formato y número de arranque desde su ficha. |
| Clientes | Agenda única compartida, tabla nueva en este Supabase, importable desde comunidades/proveedores. |
| Datos de Serincosol | Salen de **Ajustes Emisor** (`company_settings`): nombre, CIF, dirección, CP, ciudad, teléfono, IBAN y logo. En Facturación solo se configura color, IVA/IRPF, pie legal, email y numeración (`origen_datos = 'ajustes_emisor'`, sincronizado al listar, previsualizar y emitir). |

## Qué hay ya

**En este panel**
- `ajustes-emisor` + `company_settings` + `getEmisor()`: un solo emisor, usado por ~10 PDFs. **No se toca.**
- `buildFacturaVariosPdf` (`src/app/api/documentos/varios/generate/route.ts`, pdf-lib): base del nuevo PDF.
- Envío por email: `createDocSendRoute` (`src/lib/api/docSend.ts`, n8n).
- Componentes: `DataTable`, `FormModal`, `FormField`, `KPICard`, `SearchableSelect`, `react-hot-toast`, `is_admin()`.
- Ya existe "Facturas" en el Sidebar (explorador de archivos). El nuevo se llama **"Facturación"**.

**Módulo VeriFactu (Automatizatelo, código propio sin datos de clientes)**
- SQL: series + contador atómico, `facturas` con emisor/cliente congelados, `factura_lineas`, triggers de inmutabilidad, no borrar y orden de fechas. Libro `verifactu_registros` encadenado por SHA-256.
- TS: huella, XML AEAT, QR, validación de NIF, tipos F1/F2/R1–R5, conector propio/externo. 9 pruebas.
- **Pensado para un solo emisor.** Hay que adaptarlo (ver abajo).

**panel_afcademia**: solo referencia de diseño; un emisor, sin VeriFactu. No se copia nada.

## Adaptaciones necesarias del módulo VeriFactu

1. **Multi-emisor**: `facturacion_series` gana `facturador_id`; `prefijo` único por facturador (no global); `numero` único por facturador.
2. **Una cadena de huellas por NIF emisor**: hoy el índice `uq_vf_primero` permite un solo "primer registro" en toda la tabla y `ultimoRegistro()` no recibe el emisor. Pasa a ser por `nif_emisor`.
3. **Bloque SistemaInformatico**: con 3 obligados en la misma instalación, `tipoUsoPosibleMultiOT` e `indicadorMultiplesOT` = `S` (hoy fijos en `N`).
4. **Modo sin envío ("No VERI*FACTU")**: `tipoUsoPosibleSoloVerifactu` = `N` y QR sin la leyenda «VERI*FACTU». Según lo que conozco del reglamento (**sin verificar hoy contra la AEAT**), este modo exige además:
   - **firma electrónica** de cada registro (XAdES) con certificado,
   - **registro de eventos** del sistema (arranques, exportaciones, incidencias…),
   - posibilidad de **exportar** los registros si Hacienda los pide.
   El módulo no tiene nada de esto todavía. Ver Fase 6.
5. **Formato de número configurable** (el módulo solo tiene `{prefijo}-{numero}-{anio}` con 4 cifras).
6. **Borradores**: el módulo solo guarda facturas emitidas. Los borradores van en tabla aparte (`factura_borradores`) que sí se puede editar y borrar.
7. **IRPF**: el módulo ya tiene `retencion_total`; falta `irpf_pct` y mostrarlo en PDF.

Las mejoras 1–5 se hacen **en el módulo** (sirven para otros clientes) y luego el código se **copia** dentro de este repo: el panel es de Serincosol y no debe depender de un paquete a nombre de Automatizatelo.

## Modelo de datos

```
facturadores
  id, nombre_comercial, razon_social, tipo_persona (fisica|juridica), nif,
  direccion, cp, ciudad, provincia, email, telefono, iban,
  iva_defecto, irpf_defecto, pie_legal, color_principal, logo_path, activo, orden

facturacion_series (módulo + facturador_id)
  id, facturador_id, prefijo, tipo (normal|rectificativa),
  num_sep1, num_anio (4|2|0), num_sep2, num_digitos, reinicio_anual, activa
  UNIQUE (facturador_id, prefijo)

facturacion_contadores (módulo)   serie_id, anio, ultimo
  -- "Próxima factura" editable desde la ficha; nunca por debajo del último emitido

clientes_facturacion
  id, nombre, nif, direccion, cp, ciudad, provincia, email,
  origen (manual|comunidad|proveedor|facturador), origen_id, activo

factura_borradores               (editable, sin número, sin valor fiscal)
  id, facturador_id, cliente_id, fecha_prevista, lineas jsonb, irpf_pct, notas, created_by

facturas (módulo + facturador_id, irpf_pct, cliente_id, fecha_pago, fecha_envio)
factura_lineas (módulo)
verifactu_registros (módulo + cadena por nif_emisor + firma + estado 'sin_envio')
verifactu_eventos (nueva, solo añadir)
```

- Migraciones con GRANT explícito + RLS con `is_admin()` (CLAUDE.md, 2026-05-27). Tablas fiscales: solo `service_role` escribe.
- PDFs en bucket privado `facturas` → `{facturador_id}/{año}/{numero}.pdf`.
- Logos en `doc-assets/facturadores/{id}/logo.png`.

## Pantallas

- `/dashboard/facturacion`: listado de todas las facturas y borradores; filtros por facturador, año, estado y cliente; KPIs por facturador; ver PDF, marcar pagada, enviar por email, rectificar.
- `/dashboard/facturacion/nueva`: facturador → cliente → líneas → totales en vivo (IRPF si aplica) → vista previa → guardar borrador / emitir.
- `/dashboard/facturacion/facturadores`: ficha de cada uno con datos, logo, color, IVA/IRPF, pie legal y numeración con vista previa.
- `/dashboard/facturacion/clientes`: agenda con importación desde comunidades y proveedores.
- Sidebar: "Facturación" en ADMINISTRACIÓN.

## PDF

Una plantilla (la de las facturas actuales) con: logo o nombre, `color_principal`, columna IRPF solo si hay retención, IBAN, pie legal del facturador y **QR tributario** (sin leyenda VERI*FACTU en modo sin envío).

## Blueprint (fases)

### Fase 1: Adaptar el módulo VeriFactu (en su propio repo)
Mejoras 1, 2, 3 y 5. Pruebas nuevas: dos emisores con cadenas independientes, formatos de número de los ejemplos.
**Validación**: `npm test` en verde en el módulo.

### Fase 2: Base de datos en Serincosol
Migración con tablas del módulo adaptadas + `facturadores`, `clientes_facturacion`, `factura_borradores`, bucket `facturas`. Alta de los 3 facturadores vacíos (datos desde la UI).
**Validación**: triggers impiden editar/borrar facturas emitidas; numeración sin huecos en llamadas simultáneas.

### Fase 3: Ficha de facturadores y agenda de clientes
APIs admin + páginas. Subida de logo con sharp. Numeración con vista previa.

### Fase 4: Borrador → emitir → PDF
Formulario con Zod en cliente y servidor. Al emitir: número (RPC) → factura congelada → registro encadenado → QR → PDF.
**Validación**: reproducir las dos facturas de ejemplo (Serincosol con IVA; Roberto → Serincosol con IVA + IRPF 15 %) y compararlas con las actuales.

### Fase 5: Listado, cobros, email y rectificativas
KPIs, marcar pagada, envío con `createDocSendRoute`, rectificativa R1–R4 con su serie.

### Fase 6: Requisitos del modo sin envío
Firma de registros, registro de eventos y exportación. Antes: confirmar con la gestoría y la documentación AEAT qué exige exactamente este modo, y quién firma la declaración responsable del sistema.

**Prueba pequeña primero**: Fases 1–4 solo con Serincosol y Roberto, en entorno de pruebas. AFCademia después.

## Pendiente de confirmar fuera del código

- [ ] Gestoría: fechas de obligación vigentes y requisitos del modo sin envío.
- [ ] Certificado digital de cada facturador para la firma (Fase 6). Nunca en el repo.
- [ ] Quién figura como productor del software en la declaración responsable.
- [ ] Qué pasa con las facturas ya emitidas en 2026 fuera del panel (solo se continúa la numeración; no se importan como registros).
- [ ] **QR apagado** (2026-10-02, decisión de Manel): el PDF sale sin QR hasta que VeriFactu se aplique. Encenderlo con `FACTURACION_QR=si` y, a la vez, `VERIFACTU_ENV=prod` para que apunte a la AEAT real (hoy apuntaría a preproducción).

---

## Aprendizajes (Self-Annealing)

> Esta sección crece con cada error encontrado durante la implementación.

### 2026-09-30: Probar el SQL en un Postgres en memoria antes de aplicarlo
- **Error**: el trigger de inmutabilidad comparaba filas con distinto número de columnas tras añadir `emisor_id` (solo en `new`).
- **Fix**: pruebas del módulo con PGlite (`test/sql.test.ts`) que ejecutan los SQL reales. La migración del panel también se ejecutó dos veces en PGlite (idempotente).
- **Aplicar en**: cualquier cambio de SQL del módulo VeriFactu.

### 2026-09-30: No exportar funciones auxiliares desde `route.ts`
- **Fix**: Next.js solo admite handlers (GET, POST…) como exports de un route. Los helpers van en `src/lib/facturacion/server.ts`.

## Implementado (fases 1–4)

- Módulo VeriFactu v0.2 (`001 - Automatizatelo/006 - Modulo Verifactu`): multi-emisor, cadena por NIF, formato de número, `facturacion_emitir` y `facturacion_fijar_siguiente`, modo sin envío. 18 pruebas.
- Migración `supabase/migrations/20260930_create_facturacion.sql` (copia del módulo + tablas del panel + bucket `facturacion` + 3 facturadores; AFCademia inactivo).
- Código: `src/lib/verifactu/` (copia del módulo), `src/lib/facturacion/` (cálculo, esquemas, PDF, emisión), `src/app/api/admin/facturacion/*`, `src/components/facturacion/*`, `src/app/dashboard/facturacion/*`, enlace "Facturación" en el Sidebar.
- Variables opcionales: `VERIFACTU_PRODUCTOR_NOMBRE`, `VERIFACTU_PRODUCTOR_NIF`, `VERIFACTU_NUM_INSTALACION`, `VERIFACTU_ENV` (por defecto `pre`: el QR apunta al entorno de pruebas de la AEAT).

## Gotchas

- [ ] No romper `getEmisor()` ni `company_settings`.
- [ ] Número asignado en servidor y solo al emitir.
- [ ] Cadena de huellas **por emisor**, nunca global.
- [ ] Redondeo a 2 decimales por línea y en totales, igual en PDF, BD y huella.
- [ ] La fecha de emisión no puede ser anterior a la última de la serie (trigger del módulo).

## Anti-patrones

- NO numerar en el cliente.
- NO editar ni borrar facturas emitidas: rectificar o anular.
- NO mezclar assets ni cadenas entre facturadores.
- NO exponer `SUPABASE_SERVICE_ROLE_KEY` ni certificados.

---

*PRP en borrador. No se ha modificado código.*
