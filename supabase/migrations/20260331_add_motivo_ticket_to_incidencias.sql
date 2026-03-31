-- Add motivo_ticket column to incidencias table
alter table public.incidencias
  add column if not exists motivo_ticket text;
