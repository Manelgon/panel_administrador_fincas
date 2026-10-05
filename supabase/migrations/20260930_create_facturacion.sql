-- =============================================================================
-- FACTURACIÓN MULTI-EMISOR + VERI*FACTU (modo sin envío) · PRP-005
-- =============================================================================
-- Partes 1 y 2: copia literal de sql/001 y sql/002 del módulo VeriFactu de
-- Automatizatelo (v0.2, 2026-09-30). Si se corrige algo, corregir también allí.
-- Parte 3: tablas propias del panel (datos de facturadores, clientes, borradores).
--
-- Todo lo fiscal lo escribe SOLO el servidor (service_role) desde las API
-- routes de /api/admin/facturacion, que comprueban rol admin. RLS activado sin
-- políticas para anon/authenticated.
-- =============================================================================

-- =============================================================================
-- MÓDULO VERI*FACTU · 001 — FACTURAS (base común para cualquier cliente)
-- =============================================================================
-- Sirve para las dos vías (VeriFactu propio o programa certificado externo).
--
--   · facturacion_emisores: una fila por entidad que factura (varios NIF).
--   · facturacion_series + contadores: numeración correlativa por serie y año,
--     asignada de forma atómica en el servidor (nunca desde la pantalla).
--   · facturas: datos del emisor y del cliente CONGELADOS al emitir.
--   · factura_lineas: una por concepto, cada una con su IVA o su exención.
--   · Reglas legales (RD 1007/2023):
--       - Los datos fiscales de una factura emitida no se cambian: se rectifica.
--       - Las líneas no se modifican nunca.
--       - Las facturas no se borran: se anulan (queda la fila).
--       - La fecha de una factura no puede ser anterior a la última de su serie
--         (numeración y fechas siempre en el mismo orden).
--
-- ⚠️ ESQUEMA: este archivo usa `public`. En un proyecto con esquema propio
--    (p. ej. `eivi`), sustituir `public.` por `eivi.` antes de ejecutar.
-- ⚠️ RLS activado SIN políticas: solo el servidor (service_role) lee y escribe.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------- EMISORES ----------
-- Un panel puede facturar como varias entidades (sociedad, autónomo…).
-- Cada una es un obligado tributario con su propia cadena de registros.
-- El panel puede añadir columnas propias (logo, color, IBAN…) con ALTER TABLE.
create table if not exists public.facturacion_emisores (
  id           uuid primary key default gen_random_uuid(),
  razon_social text not null,
  nif          text not null unique,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------- SERIES ----------
-- Número = {prefijo}{sep1}{año}{sep2}{correlativo con N cifras}
-- (misma lógica que src/numeracion.ts → formatearNumero)
create table if not exists public.facturacion_series (
  id             bigint generated always as identity primary key,
  emisor_id      uuid not null references public.facturacion_emisores(id) on delete restrict,
  prefijo        text not null check (prefijo ~ '^[A-Z0-9]{1,10}$'),
  tipo           text not null default 'normal' check (tipo in ('normal','rectificativa')),
  descripcion    text,
  sep1           text not null default '-' check (sep1 in ('','-','/',':','.')),
  anio_cifras    int  not null default 4 check (anio_cifras in (0,2,4)),
  sep2           text not null default '-' check (sep2 in ('','-','/',':','.')),
  digitos        int  not null default 4 check (digitos between 1 and 6),
  reinicio_anual boolean not null default true,
  activa         boolean not null default true,
  por_defecto    boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (emisor_id, prefijo)
);
create unique index if not exists uq_serie_por_defecto on public.facturacion_series(emisor_id, tipo) where por_defecto;

-- Contador por serie y año. Si la serie no se reinicia cada año, se usa anio = 0.
create table if not exists public.facturacion_contadores (
  serie_id bigint not null references public.facturacion_series(id) on delete restrict,
  anio     int not null,
  ultimo   int not null default 0 check (ultimo >= 0),
  primary key (serie_id, anio)
);

create or replace function public.facturacion_formatear_numero(p_serie_id bigint, p_anio int, p_correlativo int)
returns text
language plpgsql stable
set search_path = ''
as $$
declare s public.facturacion_series; y text;
begin
  select * into s from public.facturacion_series where id = p_serie_id;
  if not found then raise exception 'Serie % no existe', p_serie_id; end if;
  y := case s.anio_cifras when 4 then p_anio::text when 2 then right(p_anio::text, 2) else '' end;
  return s.prefijo || s.sep1 || y || case when y = '' then '' else s.sep2 end
         || lpad(p_correlativo::text, greatest(s.digitos, length(p_correlativo::text)), '0');
end $$;

create or replace function public.facturacion_clave_anio(p_serie_id bigint, p_anio int)
returns int language sql stable set search_path = '' as $$
  select case when reinicio_anual then p_anio else 0 end from public.facturacion_series where id = p_serie_id
$$;

-- Siguiente número de una serie y año, de forma atómica (bloquea la fila del contador).
create or replace function public.facturacion_siguiente_numero(p_serie_id bigint, p_anio int)
returns int
language plpgsql
set search_path = ''
as $$
declare v int; k int := public.facturacion_clave_anio(p_serie_id, p_anio);
begin
  insert into public.facturacion_contadores (serie_id, anio, ultimo) values (p_serie_id, k, 0)
    on conflict (serie_id, anio) do nothing;
  update public.facturacion_contadores set ultimo = ultimo + 1
   where serie_id = p_serie_id and anio = k
   returning ultimo into v;
  return v;
end $$;

-- Fija desde qué número continúa una serie (p. ej. al migrar desde otro programa).
-- Nunca por debajo de lo ya emitido en el panel: evita números repetidos.
create or replace function public.facturacion_fijar_siguiente(p_serie_id bigint, p_anio int, p_siguiente int)
returns void
language plpgsql
set search_path = ''
as $$
declare k int := public.facturacion_clave_anio(p_serie_id, p_anio); v_max int;
begin
  if p_siguiente < 1 then raise exception 'El número debe ser 1 o mayor' using errcode = 'check_violation'; end if;
  select coalesce(max(correlativo), 0) into v_max from public.facturas
   where serie_id = p_serie_id and (k = 0 or anio = k);
  if p_siguiente <= v_max then
    raise exception 'Ya hay facturas emitidas hasta el número %. El siguiente debe ser mayor.', v_max
      using errcode = 'check_violation';
  end if;
  insert into public.facturacion_contadores (serie_id, anio, ultimo) values (p_serie_id, k, p_siguiente - 1)
    on conflict (serie_id, anio) do update set ultimo = excluded.ultimo;
end $$;

-- ---------- FACTURAS ----------
create table if not exists public.facturas (
  id                     uuid primary key default gen_random_uuid(),
  emisor_id              uuid not null references public.facturacion_emisores(id) on delete restrict,
  serie_id               bigint not null references public.facturacion_series(id) on delete restrict,
  anio                   int not null,
  correlativo            int not null,
  numero                 text not null check (length(numero) <= 60),
  tipo_aeat              text not null check (tipo_aeat in ('F1','F2','F3','R1','R2','R3','R4','R5')),
  fecha_emision          date not null,
  -- Emisor (congelado)
  emisor_nombre          text not null,
  emisor_nif             text not null,
  emisor_direccion       text,
  -- Cliente (congelado; puede faltar en simplificadas F2)
  cliente_nombre         text,
  cliente_nif            text,
  cliente_direccion      text,
  cliente_email          text,
  -- Importes
  base_total             numeric(12,2) not null,
  cuota_total            numeric(12,2) not null,   -- suma de IVA
  retencion_pct          numeric(5,2) not null default 0,   -- IRPF %, si lo hay
  retencion_total        numeric(12,2) not null default 0,  -- IRPF, si lo hay
  importe_total          numeric(12,2) not null,   -- base + IVA (sin restar retención)
  -- Datos no fiscales para reimprimir el PDF igual que se emitió
  -- (dirección completa, IBAN, pie legal, logo, color…). Congelados como el resto.
  datos_impresion        jsonb not null default '{}'::jsonb,
  -- Rectificación
  factura_rectificada_id uuid references public.facturas(id) on delete restrict,
  motivo_rectificacion   text,
  -- Origen en el panel (p. ej. recibo de caja)
  origen_tipo            text,
  origen_id              text,
  -- Estado y cumplimiento
  estado                 text not null default 'emitida' check (estado in ('emitida','anulada')),
  proveedor              text not null default 'propio',    -- 'propio' | 'externo:<programa>'
  referencia_externa     text,                               -- id en el programa externo
  qr_url                 text,
  pdf_url                text,
  metodo_pago            text,
  notas                  text,
  creada_por             uuid,
  created_at             timestamptz not null default now(),
  unique (serie_id, anio, correlativo),
  unique (emisor_id, numero),
  constraint factura_cliente_f1 check (tipo_aeat <> 'F1' or (cliente_nombre is not null and cliente_nif is not null)),
  constraint factura_rectifica check ((tipo_aeat like 'R%') = (factura_rectificada_id is not null))
);
create index if not exists idx_facturas_fecha on public.facturas(fecha_emision desc);
create index if not exists idx_facturas_emisor on public.facturas(emisor_id, fecha_emision desc);
create index if not exists idx_facturas_origen on public.facturas(origen_tipo, origen_id);

create table if not exists public.factura_lineas (
  id              bigint generated always as identity primary key,
  factura_id      uuid not null references public.facturas(id) on delete restrict,
  orden           int not null default 0,
  concepto        text not null,
  cantidad        numeric(10,3) not null default 1,
  precio_unitario numeric(12,4) not null,          -- sin IVA
  descuento_pct   numeric(5,2) not null default 0,
  tipo_iva        numeric(5,2) not null default 21,
  exenta          text check (exenta in ('E1','E2','E3','E4','E5','E6')),  -- E1 = art. 20 LIVA (sanitaria)
  base            numeric(12,2) not null,
  cuota           numeric(12,2) not null,
  constraint linea_exenta_sin_cuota check (exenta is null or cuota = 0)
);
create index if not exists idx_factura_lineas on public.factura_lineas(factura_id, orden);

-- ---------- REGLAS LEGALES ----------
-- Fecha no anterior a la última factura de la misma serie y año
create or replace function public.facturas_orden_fechas() returns trigger
language plpgsql set search_path = '' as $$
declare v_ultima date;
begin
  select max(fecha_emision) into v_ultima from public.facturas
   where serie_id = new.serie_id and anio = new.anio and id <> new.id;
  if v_ultima is not null and new.fecha_emision < v_ultima then
    raise exception 'La fecha (%) no puede ser anterior a la última factura de la serie (%)', new.fecha_emision, v_ultima
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_facturas_orden_fechas on public.facturas;
create trigger trg_facturas_orden_fechas before insert on public.facturas
  for each row execute function public.facturas_orden_fechas();

-- Datos fiscales inmutables tras emitir (se permite cambiar estado, pago, notas, PDF/QR y referencias)
create or replace function public.facturas_inmutables() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.emisor_id, new.serie_id, new.anio, new.correlativo, new.numero, new.tipo_aeat, new.fecha_emision,
      new.emisor_nombre, new.emisor_nif, new.emisor_direccion,
      new.cliente_nombre, new.cliente_nif, new.cliente_direccion, new.cliente_email,
      new.base_total, new.cuota_total, new.retencion_pct, new.retencion_total, new.importe_total,
      new.datos_impresion, new.factura_rectificada_id, new.motivo_rectificacion, new.created_at)
     is distinct from
     (old.emisor_id, old.serie_id, old.anio, old.correlativo, old.numero, old.tipo_aeat, old.fecha_emision,
      old.emisor_nombre, old.emisor_nif, old.emisor_direccion,
      old.cliente_nombre, old.cliente_nif, old.cliente_direccion, old.cliente_email,
      old.base_total, old.cuota_total, old.retencion_pct, old.retencion_total, old.importe_total,
      old.datos_impresion, old.factura_rectificada_id, old.motivo_rectificacion, old.created_at) then
    raise exception 'Factura %: los datos fiscales no se pueden modificar. Emite una rectificativa.', old.numero
      using errcode = 'check_violation';
  end if;
  if old.estado = 'anulada' and new.estado <> 'anulada' then
    raise exception 'Factura %: una factura anulada no se puede reactivar', old.numero using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_facturas_inmutables on public.facturas;
create trigger trg_facturas_inmutables before update on public.facturas
  for each row execute function public.facturas_inmutables();

create or replace function public.facturacion_no_borrar() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Los registros de facturación no se pueden borrar ni modificar (RD 1007/2023). Anula o rectifica.'
    using errcode = 'check_violation';
end $$;
drop trigger if exists trg_facturas_no_borrar on public.facturas;
create trigger trg_facturas_no_borrar before delete on public.facturas
  for each row execute function public.facturacion_no_borrar();
drop trigger if exists trg_lineas_no_tocar on public.factura_lineas;
create trigger trg_lineas_no_tocar before update or delete on public.factura_lineas
  for each row execute function public.facturacion_no_borrar();

-- ---------- EMITIR (una sola transacción) ----------
-- Asigna número, congela la factura e inserta sus líneas. Si algo falla no se
-- consume número (todo vuelve atrás), así no quedan huecos en la numeración.
--   p_factura: tipo_aeat, fecha_emision, emisor_*, cliente_*, base_total,
--              cuota_total, retencion_pct, retencion_total, importe_total, datos_impresion,
--              factura_rectificada_id, motivo_rectificacion, origen_*, notas, creada_por
--   p_lineas:  [{orden, concepto, cantidad, precio_unitario, descuento_pct, tipo_iva, exenta, base, cuota}]
create or replace function public.facturacion_emitir(p_serie_id bigint, p_factura jsonb, p_lineas jsonb)
returns public.facturas
language plpgsql
set search_path = ''
as $$
declare s public.facturacion_series; f public.facturas; v_fecha date; v_anio int; v_n int;
begin
  select * into s from public.facturacion_series where id = p_serie_id and activa;
  if not found then raise exception 'Serie % no existe o no está activa', p_serie_id; end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La factura necesita al menos una línea' using errcode = 'check_violation';
  end if;
  v_fecha := (p_factura->>'fecha_emision')::date;
  v_anio  := extract(year from v_fecha)::int;
  v_n     := public.facturacion_siguiente_numero(p_serie_id, v_anio);

  insert into public.facturas (
    emisor_id, serie_id, anio, correlativo, numero, tipo_aeat, fecha_emision,
    emisor_nombre, emisor_nif, emisor_direccion,
    cliente_nombre, cliente_nif, cliente_direccion, cliente_email,
    base_total, cuota_total, retencion_pct, retencion_total, importe_total, datos_impresion,
    factura_rectificada_id, motivo_rectificacion, origen_tipo, origen_id,
    proveedor, metodo_pago, notas, creada_por)
  values (
    s.emisor_id, s.id, v_anio, v_n, public.facturacion_formatear_numero(s.id, v_anio, v_n),
    p_factura->>'tipo_aeat', v_fecha,
    p_factura->>'emisor_nombre', p_factura->>'emisor_nif', p_factura->>'emisor_direccion',
    p_factura->>'cliente_nombre', p_factura->>'cliente_nif', p_factura->>'cliente_direccion', p_factura->>'cliente_email',
    (p_factura->>'base_total')::numeric, (p_factura->>'cuota_total')::numeric,
    coalesce((p_factura->>'retencion_pct')::numeric, 0), coalesce((p_factura->>'retencion_total')::numeric, 0),
    (p_factura->>'importe_total')::numeric, coalesce(p_factura->'datos_impresion', '{}'::jsonb),
    nullif(p_factura->>'factura_rectificada_id', '')::uuid, p_factura->>'motivo_rectificacion',
    p_factura->>'origen_tipo', p_factura->>'origen_id',
    coalesce(p_factura->>'proveedor', 'propio'), p_factura->>'metodo_pago', p_factura->>'notas',
    nullif(p_factura->>'creada_por', '')::uuid)
  returning * into f;

  insert into public.factura_lineas (factura_id, orden, concepto, cantidad, precio_unitario, descuento_pct, tipo_iva, exenta, base, cuota)
  select f.id, coalesce((l->>'orden')::int, 0), l->>'concepto', coalesce((l->>'cantidad')::numeric, 1),
         (l->>'precio_unitario')::numeric, coalesce((l->>'descuento_pct')::numeric, 0),
         coalesce((l->>'tipo_iva')::numeric, 21), nullif(l->>'exenta', ''),
         (l->>'base')::numeric, (l->>'cuota')::numeric
    from jsonb_array_elements(p_lineas) l;

  if abs((select sum(base) from public.factura_lineas where factura_id = f.id) - f.base_total) > 0.005
     or abs((select sum(cuota) from public.factura_lineas where factura_id = f.id) - f.cuota_total) > 0.005 then
    raise exception 'Los totales no cuadran con las líneas' using errcode = 'check_violation';
  end if;
  return f;
end $$;

alter table public.facturacion_emisores enable row level security;
alter table public.facturacion_series enable row level security;
alter table public.facturacion_contadores enable row level security;
alter table public.facturas enable row level security;
alter table public.factura_lineas enable row level security;
grant all on public.facturacion_emisores, public.facturacion_series, public.facturacion_contadores, public.facturas, public.factura_lineas to service_role;

-- Las funciones solo las usa el servidor
revoke execute on function public.facturacion_formatear_numero(bigint, int, int), public.facturacion_clave_anio(bigint, int),
  public.facturacion_siguiente_numero(bigint, int), public.facturacion_fijar_siguiente(bigint, int, int),
  public.facturacion_emitir(bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.facturacion_formatear_numero(bigint, int, int), public.facturacion_clave_anio(bigint, int),
  public.facturacion_siguiente_numero(bigint, int), public.facturacion_fijar_siguiente(bigint, int, int),
  public.facturacion_emitir(bigint, jsonb, jsonb) to service_role;


-- =============================================================================
-- MÓDULO VERI*FACTU · 002 — REGISTROS ENCADENADOS (solo vía "propio")
-- =============================================================================
-- Libro de registros de facturación (alta y anulación) encadenados por SHA-256.
-- Solo se añade: nada se modifica ni se borra (salvo el estado del envío a AEAT).
-- Hay UNA cadena por NIF emisor. Se linealiza con índices únicos: un único
-- primer registro por emisor y cada huella_anterior usada una sola vez.
-- Requiere 001. Mismo aviso de esquema: sustituir `public.` si procede.
-- =============================================================================

create table if not exists public.verifactu_registros (
  id                    uuid primary key default gen_random_uuid(),
  factura_id            uuid not null references public.facturas(id) on delete restrict,
  tipo                  text not null check (tipo in ('alta','anulacion')),
  num_registro          bigint generated always as identity,
  huella                text not null,
  huella_anterior       text,
  nif_emisor            text not null,
  numero_factura        text not null,
  fecha_emision         date not null,
  tipo_factura_aeat     text not null check (tipo_factura_aeat in ('F1','F2','F3','R1','R2','R3','R4','R5')),
  cuota_total           numeric(12,2) not null,
  importe_total         numeric(12,2) not null,
  fecha_hora_generacion timestamptz not null,
  xml_payload           text not null,
  -- Envío a la AEAT ('sin_envio' = modo No VERI*FACTU: el registro se guarda y no se envía)
  estado_envio          text not null default 'pendiente' check (estado_envio in ('sin_envio','pendiente','enviado','aceptado','rechazado','error')),
  csv_aeat              text,
  respuesta_aeat        jsonb,
  intentos              int not null default 0,
  ultimo_error          text,
  enviado_at            timestamptz,
  created_at            timestamptz not null default now()
);
create index if not exists idx_vf_factura on public.verifactu_registros(factura_id, tipo);
create index if not exists idx_vf_num on public.verifactu_registros(num_registro);
create unique index if not exists uq_vf_huella_anterior on public.verifactu_registros(huella_anterior) where huella_anterior is not null;
create unique index if not exists uq_vf_primero on public.verifactu_registros(nif_emisor) where huella_anterior is null;
create index if not exists idx_vf_cadena on public.verifactu_registros(nif_emisor, num_registro desc);
create index if not exists idx_vf_pendientes on public.verifactu_registros(estado_envio, created_at) where estado_envio in ('pendiente','error');

alter table public.facturas
  add column if not exists verifactu_alta_id uuid references public.verifactu_registros(id),
  add column if not exists verifactu_anulacion_id uuid references public.verifactu_registros(id);

-- Inmutable salvo los campos del envío
create or replace function public.verifactu_inmutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.factura_id, new.tipo, new.num_registro, new.huella, new.huella_anterior, new.nif_emisor, new.numero_factura,
      new.fecha_emision, new.tipo_factura_aeat, new.cuota_total, new.importe_total, new.fecha_hora_generacion,
      new.xml_payload, new.created_at)
     is distinct from
     (old.factura_id, old.tipo, old.num_registro, old.huella, old.huella_anterior, old.nif_emisor, old.numero_factura,
      old.fecha_emision, old.tipo_factura_aeat, old.cuota_total, old.importe_total, old.fecha_hora_generacion,
      old.xml_payload, old.created_at) then
    raise exception 'verifactu_registros: solo se puede actualizar el estado del envío' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_vf_inmutable on public.verifactu_registros;
create trigger trg_vf_inmutable before update on public.verifactu_registros
  for each row execute function public.verifactu_inmutable();
drop trigger if exists trg_vf_no_borrar on public.verifactu_registros;
create trigger trg_vf_no_borrar before delete on public.verifactu_registros
  for each row execute function public.facturacion_no_borrar();

-- Los ids de registro de la factura, una vez puestos, no cambian
create or replace function public.facturas_vf_ids() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.verifactu_alta_id is not null and new.verifactu_alta_id is distinct from old.verifactu_alta_id then
    raise exception 'Factura %: verifactu_alta_id inmutable', old.numero using errcode = 'check_violation';
  end if;
  if old.verifactu_anulacion_id is not null and new.verifactu_anulacion_id is distinct from old.verifactu_anulacion_id then
    raise exception 'Factura %: verifactu_anulacion_id inmutable', old.numero using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_facturas_vf_ids on public.facturas;
create trigger trg_facturas_vf_ids before update on public.facturas
  for each row execute function public.facturas_vf_ids();

alter table public.verifactu_registros enable row level security;
grant all on public.verifactu_registros to service_role;


-- =============================================================================
-- PARTE 3 · PROPIO DEL PANEL SERINCOSOL
-- =============================================================================

-- ---------- Datos completos de cada facturador ----------
alter table public.facturacion_emisores
  add column if not exists nombre_comercial text,
  add column if not exists tipo_persona     text not null default 'juridica' check (tipo_persona in ('fisica','juridica')),
  add column if not exists direccion        text,
  add column if not exists cp               text,
  add column if not exists ciudad           text,
  add column if not exists provincia        text,
  add column if not exists email            text,
  add column if not exists telefono         text,
  add column if not exists iban             text,
  add column if not exists iva_defecto      numeric(5,2) not null default 21 check (iva_defecto between 0 and 100),
  add column if not exists irpf_defecto     numeric(5,2) not null default 0 check (irpf_defecto between 0 and 100),
  add column if not exists pie_legal        text,
  add column if not exists color_principal  text not null default '#FFD966' check (color_principal ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists logo_path        text,
  add column if not exists orden            int not null default 0,
  -- 'ajustes_emisor' = nombre, CIF, dirección, CP, ciudad, teléfono, IBAN y logo
  -- se leen de company_settings (pantalla Ajustes Emisor) y no se editan aquí.
  add column if not exists origen_datos     text not null default 'propio' check (origen_datos in ('propio','ajustes_emisor')),
  add column if not exists updated_at       timestamptz not null default now();

-- ---------- Seguimiento (no fiscal, editable) ----------
alter table public.facturas
  add column if not exists fecha_envio date,
  add column if not exists fecha_pago  date;

-- ---------- Agenda de clientes (compartida por todos los facturadores) ----------
create table if not exists public.clientes_facturacion (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  nif        text,
  direccion  text,
  cp         text,
  ciudad     text,
  provincia  text,
  email      text,
  origen     text not null default 'manual' check (origen in ('manual','comunidad','proveedor','facturador')),
  origen_id  text,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clientes_facturacion_nombre on public.clientes_facturacion(lower(nombre));
create unique index if not exists uq_clientes_facturacion_origen on public.clientes_facturacion(origen, origen_id) where origen_id is not null;

-- ---------- Borradores (sin número, sin valor fiscal; se editan y se borran) ----------
create table if not exists public.factura_borradores (
  id            uuid primary key default gen_random_uuid(),
  emisor_id     uuid not null references public.facturacion_emisores(id) on delete cascade,
  cliente_id    uuid references public.clientes_facturacion(id) on delete set null,
  fecha_emision date,
  lineas        jsonb not null default '[]'::jsonb,
  retencion_pct numeric(5,2) not null default 0,
  notas         text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_factura_borradores_emisor on public.factura_borradores(emisor_id, updated_at desc);

alter table public.clientes_facturacion enable row level security;
alter table public.factura_borradores enable row level security;
grant select, insert, update, delete on public.clientes_facturacion, public.factura_borradores to service_role;

-- ---------- Bucket privado para los PDF emitidos ----------
insert into storage.buckets (id, name, public)
values ('facturacion', 'facturacion', false)
on conflict (id) do nothing;

-- ---------- Facturadores iniciales ----------
-- NIF provisional único: el panel obliga a poner el real antes de emitir.
-- Serincosol toma sus datos de Ajustes Emisor (se sincronizan al abrir Facturación).
insert into public.facturacion_emisores (razon_social, nombre_comercial, nif, tipo_persona, activo, orden, origen_datos)
values
  ('Serincosol S.L.', 'Serincosol', 'PENDIENTE-1', 'juridica', true, 1, 'ajustes_emisor'),
  ('Roberto (autónomo)', 'Roberto', 'PENDIENTE-2', 'fisica', true, 2, 'propio'),
  ('AFCademia', 'AFCademia', 'PENDIENTE-3', 'juridica', false, 3, 'propio')
on conflict (nif) do nothing;

-- Un solo facturador puede estar vinculado a Ajustes Emisor
create unique index if not exists uq_emisor_ajustes on public.facturacion_emisores(origen_datos) where origen_datos = 'ajustes_emisor';
