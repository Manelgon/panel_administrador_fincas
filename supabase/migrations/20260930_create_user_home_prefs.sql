-- ============================================================
-- MI DÍA: preferencias de la página de inicio personal
-- Cada usuario guarda el orden de sus bloques y los que ha ocultado.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_home_prefs (
    user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    orden       text[] NOT NULL DEFAULT '{}',
    ocultos     text[] NOT NULL DEFAULT '{}',
    updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_home_prefs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_home_prefs TO service_role;

ALTER TABLE public.user_home_prefs ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve y toca su propia fila
DROP POLICY IF EXISTS "user_home_prefs_own" ON public.user_home_prefs;
CREATE POLICY "user_home_prefs_own" ON public.user_home_prefs
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
