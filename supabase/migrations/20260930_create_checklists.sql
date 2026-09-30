-- Checklists por comunidad con plantillas reutilizables.
--
-- Modelo:
--   checklist_plantillas         → plantilla reutilizable ("Alta de comunidad nueva"...)
--   checklist_plantilla_items    → tareas de la plantilla (parent_id = subtarea, un nivel)
--   checklists                   → checklist concreto, siempre ligado a una comunidad
--   checklist_items              → tareas del checklist (copiadas de la plantilla o a mano)
--   checklist_item_responsables  → responsables de cada tarea (varios por tarea)
--
-- Crear un checklist desde plantilla copia sus tareas: editar la plantilla después
-- no cambia los checklists ya creados.
--
-- Permisos: todo authenticated lee; admin / gestor / empleado crean y editan.
-- Borrar un checklist o una plantilla completos es solo de admin
-- (desde la app va por /api/admin/universal-delete). Archivar es de todos.

-- ============================================
-- TABLAS
-- ============================================

CREATE TABLE IF NOT EXISTS public.checklist_plantillas (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checklist_plantilla_items (
    id BIGSERIAL PRIMARY KEY,
    plantilla_id BIGINT NOT NULL REFERENCES public.checklist_plantillas(id) ON DELETE CASCADE,
    parent_id BIGINT,
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT checklist_plantilla_items_id_plantilla_key UNIQUE (id, plantilla_id),
    -- La subtarea tiene que ser de la misma plantilla que su tarea madre
    CONSTRAINT checklist_plantilla_items_parent_fkey
        FOREIGN KEY (parent_id, plantilla_id)
        REFERENCES public.checklist_plantilla_items(id, plantilla_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.checklists (
    id BIGSERIAL PRIMARY KEY,
    comunidad_id BIGINT NOT NULL REFERENCES public.comunidades(id) ON DELETE CASCADE,
    plantilla_id BIGINT REFERENCES public.checklist_plantillas(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checklist_items (
    id BIGSERIAL PRIMARY KEY,
    checklist_id BIGINT NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
    parent_id BIGINT,
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    orden INTEGER NOT NULL DEFAULT 0,
    hecho BOOLEAN NOT NULL DEFAULT false,
    completado_por UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    completado_at TIMESTAMPTZ,
    fecha_limite DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT checklist_items_id_checklist_key UNIQUE (id, checklist_id),
    CONSTRAINT checklist_items_parent_fkey
        FOREIGN KEY (parent_id, checklist_id)
        REFERENCES public.checklist_items(id, checklist_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.checklist_item_responsables (
    item_id BIGINT NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (item_id, user_id)
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_checklist_plantilla_items_plantilla ON public.checklist_plantilla_items(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_checklist_plantilla_items_parent ON public.checklist_plantilla_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_checklists_comunidad ON public.checklists(comunidad_id);
CREATE INDEX IF NOT EXISTS idx_checklists_plantilla ON public.checklists(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON public.checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_parent ON public.checklist_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_checklist_item_responsables_user ON public.checklist_item_responsables(user_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION public.checklist_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_plantillas_updated_at ON public.checklist_plantillas;
CREATE TRIGGER trg_checklist_plantillas_updated_at
    BEFORE UPDATE ON public.checklist_plantillas
    FOR EACH ROW EXECUTE FUNCTION public.checklist_set_updated_at();

DROP TRIGGER IF EXISTS trg_checklists_updated_at ON public.checklists;
CREATE TRIGGER trg_checklists_updated_at
    BEFORE UPDATE ON public.checklists
    FOR EACH ROW EXECUTE FUNCTION public.checklist_set_updated_at();

-- Quién y cuándo marcó la tarea: lo pone la base de datos, no el navegador.
CREATE OR REPLACE FUNCTION public.checklist_items_before_write()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_at = now();
    END IF;

    IF NEW.hecho AND (TG_OP = 'INSERT' OR NOT OLD.hecho) THEN
        NEW.completado_por = auth.uid();
        NEW.completado_at = now();
    ELSIF NOT NEW.hecho THEN
        NEW.completado_por = NULL;
        NEW.completado_at = NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_items_before_write ON public.checklist_items;
CREATE TRIGGER trg_checklist_items_before_write
    BEFORE INSERT OR UPDATE ON public.checklist_items
    FOR EACH ROW EXECUTE FUNCTION public.checklist_items_before_write();

-- ============================================
-- CREAR CHECKLIST DESDE PLANTILLA
-- ============================================
-- SECURITY INVOKER: se aplican las mismas RLS que si se insertara a mano.
-- p_plantilla_id NULL = checklist en blanco.

CREATE OR REPLACE FUNCTION public.crear_checklist(
    p_comunidad_id BIGINT,
    p_nombre TEXT,
    p_descripcion TEXT DEFAULT '',
    p_plantilla_id BIGINT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_checklist_id BIGINT;
    v_madre RECORD;
    v_nueva_madre BIGINT;
BEGIN
    IF coalesce(trim(p_nombre), '') = '' THEN
        RAISE EXCEPTION 'El nombre del checklist es obligatorio';
    END IF;

    INSERT INTO checklists (comunidad_id, plantilla_id, nombre, descripcion, created_by)
    VALUES (p_comunidad_id, p_plantilla_id, trim(p_nombre), coalesce(p_descripcion, ''), auth.uid())
    RETURNING id INTO v_checklist_id;

    IF p_plantilla_id IS NULL THEN
        RETURN v_checklist_id;
    END IF;

    FOR v_madre IN
        SELECT id, titulo, descripcion, orden
        FROM checklist_plantilla_items
        WHERE plantilla_id = p_plantilla_id AND parent_id IS NULL
        ORDER BY orden, id
    LOOP
        INSERT INTO checklist_items (checklist_id, titulo, descripcion, orden)
        VALUES (v_checklist_id, v_madre.titulo, v_madre.descripcion, v_madre.orden)
        RETURNING id INTO v_nueva_madre;

        INSERT INTO checklist_items (checklist_id, parent_id, titulo, descripcion, orden)
        SELECT v_checklist_id, v_nueva_madre, s.titulo, s.descripcion, s.orden
        FROM checklist_plantilla_items s
        WHERE s.parent_id = v_madre.id
        ORDER BY s.orden, s.id;
    END LOOP;

    RETURN v_checklist_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_checklist(BIGINT, TEXT, TEXT, BIGINT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crear_checklist(BIGINT, TEXT, TEXT, BIGINT) TO authenticated, service_role;

-- ============================================
-- GRANTS (obligatorios desde el cambio de Supabase; nunca a anon)
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.checklist_plantillas,
    public.checklist_plantilla_items,
    public.checklists,
    public.checklist_items,
    public.checklist_item_responsables
TO authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE
    public.checklist_plantillas_id_seq,
    public.checklist_plantilla_items_id_seq,
    public.checklists_id_seq,
    public.checklist_items_id_seq
TO authenticated, service_role;

-- ============================================
-- RLS
-- ============================================

ALTER TABLE public.checklist_plantillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_plantilla_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_item_responsables ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
    -- Tablas "cabecera": el equipo crea y edita, pero solo admin borra.
    cabeceras TEXT[] := ARRAY['checklist_plantillas', 'checklists'];
    -- Tablas de detalle: el equipo puede también borrar tareas y responsables.
    detalles TEXT[] := ARRAY['checklist_plantilla_items', 'checklist_items', 'checklist_item_responsables'];
    es_equipo TEXT := '(SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN (''gestor'', ''empleado'')';
BEGIN
    FOREACH t IN ARRAY cabeceras || detalles LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%1$s: select for authenticated" ON public.%1$I', t);
        EXECUTE format('CREATE POLICY "%1$s: select for authenticated" ON public.%1$I FOR SELECT TO authenticated USING (true)', t);

        EXECUTE format('DROP POLICY IF EXISTS "%1$s: admin all" ON public.%1$I', t);
        EXECUTE format('CREATE POLICY "%1$s: admin all" ON public.%1$I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
    END LOOP;

    FOREACH t IN ARRAY cabeceras LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%1$s: gestor_empleado insert" ON public.%1$I', t);
        EXECUTE format('CREATE POLICY "%1$s: gestor_empleado insert" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (%2$s)', t, es_equipo);

        EXECUTE format('DROP POLICY IF EXISTS "%1$s: gestor_empleado update" ON public.%1$I', t);
        EXECUTE format('CREATE POLICY "%1$s: gestor_empleado update" ON public.%1$I FOR UPDATE TO authenticated USING (%2$s) WITH CHECK (%2$s)', t, es_equipo);
    END LOOP;

    FOREACH t IN ARRAY detalles LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%1$s: gestor_empleado write" ON public.%1$I', t);
        EXECUTE format('CREATE POLICY "%1$s: gestor_empleado write" ON public.%1$I FOR ALL TO authenticated USING (%2$s) WITH CHECK (%2$s)', t, es_equipo);
    END LOOP;
END;
$$;

-- ============================================
-- PLANTILLA INICIAL: Alta de comunidad nueva
-- ============================================
-- Idempotente: solo se crea si no existe una plantilla con ese nombre.
-- Las subtareas se añaden desde el panel.

DO $$
DECLARE
    v_plantilla BIGINT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.checklist_plantillas WHERE nombre = 'Alta de comunidad nueva') THEN
        RETURN;
    END IF;

    INSERT INTO public.checklist_plantillas (nombre, descripcion)
    VALUES ('Alta de comunidad nueva', 'Pasos para dar de alta una comunidad que entra en gestión.')
    RETURNING id INTO v_plantilla;

    INSERT INTO public.checklist_plantilla_items (plantilla_id, titulo, orden)
    SELECT v_plantilla, t.titulo, t.orden
    FROM (VALUES
        (1,  'Ir al banco a hacer cambio de firmas con el presidente'),
        (2,  'Solicitar certificado digital de la comunidad (FINCATECH)'),
        (3,  'Solicitar protección de datos a Privacidad Global'),
        (4,  'Solicitar CAE a Fincatech'),
        (5,  'Dar de alta la comunidad en el programa'),
        (6,  'Contrato Admin. CP'),
        (7,  'Crear carpetas específicas de la Comunidad'),
        (8,  'Dar alta elementos de la Comunidad si tiene'),
        (9,  'Digitalizar y archivar CIF de la Comunidad'),
        (10, 'Alta de la Comunidad en programa de gestión'),
        (11, 'Digitalizar y archivar DNI del Presidente'),
        (12, 'Digitalizar y archivar:'),
        (13, 'Alta de la Comunidad en programa de gestión de incidencias'),
        (14, 'Empresa de suministro eléctrico y contratos. Cambiar dirección de correspondencia (watium)'),
        (15, 'Empresa de suministro de agua y contratos. Cambiar dirección de correspondencia'),
        (16, 'Empresa de mantenimiento de ascensores y contrato. Cambiar dirección de correspondencia'),
        (17, 'Empresa de mantenimiento contraincendios y contrato. Cambiar dirección de correspondencia (Mario)'),
        (18, 'Digitalizar Normas piscina, licencia apertura piscina o declaración responsable. Empresa de Analítica de Piscina'),
        (19, 'Empresas de mantenimiento de la Comunidad: limpieza, mantenimiento, jardinería, seguridad, DDD'),
        (20, 'Dar de alta la incidencia Gestión de llaves de la Comunidad'),
        (21, 'Última Acta inspección obligatoria de ascensores. Digitalizar y archivar'),
        (22, 'Última Acta inspección obligatoria instalaciones eléctricas. Digitalizar y archivar'),
        (23, 'Última Acta inspección obligatoria contraincendios. Digitalizar y archivar'),
        (24, 'Empresa de Gestión de Nóminas y documentos. Anotar responsable y tlf'),
        (25, 'Digitalizar Libro de Actas y archivar'),
        (26, 'Dar de alta trabajadores de la Comunidad con datos de contacto en programa de gestión. Horario de trabajo'),
        (27, 'Servicio DDD. Alta en contratos'),
        (28, 'Alta contrato empresa mantenimiento extintores'),
        (29, 'Alta empresa mantenimiento puertas de garajes'),
        (30, 'Vado garajes número y verificar que está domiciliado. Alta en control de elementos general'),
        (31, 'Demandas, propietario, motivo, abogado. Alta en gestión de incidencias'),
        (32, 'Reunión comité inicial'),
        (33, 'Empresa de control de plagas (cambiar correspondencia y a hidroteco)'),
        (34, 'Pedir oferta de Seguro y cambiar?')
    ) AS t(orden, titulo);
END;
$$;
