ALTER TABLE public.reuniones
  ADD COLUMN IF NOT EXISTS resuelto BOOLEAN NOT NULL DEFAULT FALSE;

-- Ampliar el CHECK de tipo para incluir JD (Junta Directiva)
ALTER TABLE public.reuniones DROP CONSTRAINT IF EXISTS reuniones_tipo_check;
ALTER TABLE public.reuniones ADD CONSTRAINT reuniones_tipo_check CHECK (tipo IN ('JGO', 'JGE', 'JV', 'JD'));
