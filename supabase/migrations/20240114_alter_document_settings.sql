-- Cambiar tipo de setting_value de numeric a text para permitir IBAN/textos
alter table public.document_settings
  alter column setting_value type text using setting_value::text;

-- Insertar IBAN por defecto para factura
insert into public.document_settings (doc_key, setting_key, setting_value)
values
  ('facturas_varias', 'iban', 'ES37 0081 7442 0600 0119 3630')
on conflict (doc_key, setting_key) do nothing;
