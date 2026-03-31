-- Create proveedores table
CREATE TABLE IF NOT EXISTS public.proveedores (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    telefono TEXT,
    email TEXT,
    cif TEXT,
    direccion TEXT,
    cp TEXT,
    ciudad TEXT,
    provincia TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "proveedores: select for authenticated"
ON public.proveedores FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "proveedores: insert for authenticated"
ON public.proveedores FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "proveedores: update for authenticated"
ON public.proveedores FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "proveedores: delete for authenticated"
ON public.proveedores FOR DELETE
TO authenticated
USING (true);
