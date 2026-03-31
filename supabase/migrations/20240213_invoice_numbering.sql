-- Migration: 20240213_invoice_numbering.sql

-- 1) Create table for invoice sequences
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
    id TEXT PRIMARY KEY, -- e.g., 'factura_varios'
    current_value BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Initialize sequence for Factura Varios
INSERT INTO public.invoice_sequences (id, current_value)
VALUES ('factura_varios', 0)
ON CONFLICT (id) DO NOTHING;

-- 3) Function to get next invoice number atomically
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(sequence_id TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_val BIGINT;
BEGIN
    UPDATE public.invoice_sequences
    SET current_value = current_value + 1,
        updated_at = NOW()
    WHERE id = sequence_id
    RETURNING current_value INTO next_val;
    
    RETURN next_val;
END;
$$;

-- 4) Add invoice_number column to doc_submissions
ALTER TABLE public.doc_submissions 
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- 5) RLS for invoice_sequences (only admin can touch it directly, though we'll use a function)
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_sequences: admin all" ON public.invoice_sequences;
CREATE POLICY "invoice_sequences: admin all"
ON public.invoice_sequences FOR ALL
TO authenticated
USING (public.is_admin());
