-- =============================================================================
-- FACTURACIÓN · Serincosol toma sus datos de Ajustes Emisor (PRP-005)
-- =============================================================================
-- Complementa 20260930_create_facturacion.sql, que ya estaba aplicada sin esta
-- columna. Idempotente.
--   'ajustes_emisor' = nombre, CIF, dirección, CP, ciudad, teléfono, IBAN y logo
--   se leen de company_settings (pantalla Ajustes Emisor) y no se editan en la
--   ficha del facturador.
-- =============================================================================

alter table public.facturacion_emisores
  add column if not exists origen_datos text not null default 'propio'
  check (origen_datos in ('propio','ajustes_emisor'));

-- Un solo facturador puede estar vinculado a Ajustes Emisor
create unique index if not exists uq_emisor_ajustes
  on public.facturacion_emisores(origen_datos) where origen_datos = 'ajustes_emisor';

update public.facturacion_emisores
   set origen_datos = 'ajustes_emisor'
 where razon_social = 'Serincosol S.L.'
   and not exists (select 1 from public.facturacion_emisores where origen_datos = 'ajustes_emisor');

-- Verificación: debe salir Serincosol con 'ajustes_emisor'
select razon_social, origen_datos from public.facturacion_emisores order by orden;
