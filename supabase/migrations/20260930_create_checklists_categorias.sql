-- Catálogo de categorías para agrupar las tareas de plantillas y checklists.
-- Requiere 20260930_create_checklists.sql.
--
-- Una sola lista de categorías para todo el panel ("Banco y firmas", "Suministros"...).
-- La categoría va en la tarea principal; las subtareas se agrupan con su madre.
-- Renombrar una categoría se ve en todas partes. Archivarla la quita del desplegable,
-- pero las tareas que ya la tienen la conservan.

-- ============================================
-- TABLA
-- ============================================

CREATE TABLE IF NOT EXISTS public.checklist_categorias (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sin duplicados aunque cambien mayúsculas o espacios
CREATE UNIQUE INDEX IF NOT EXISTS checklist_categorias_nombre_key
    ON public.checklist_categorias (lower(trim(nombre)));

ALTER TABLE public.checklist_plantilla_items
    ADD COLUMN IF NOT EXISTS categoria_id BIGINT REFERENCES public.checklist_categorias(id) ON DELETE SET NULL;

ALTER TABLE public.checklist_items
    ADD COLUMN IF NOT EXISTS categoria_id BIGINT REFERENCES public.checklist_categorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checklist_plantilla_items_categoria ON public.checklist_plantilla_items(categoria_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_categoria ON public.checklist_items(categoria_id);

-- ============================================
-- GRANTS + RLS (mismo modelo que plantillas: el equipo crea y edita, borrar solo admin)
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_categorias TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.checklist_categorias_id_seq TO authenticated, service_role;

ALTER TABLE public.checklist_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_categorias: select for authenticated" ON public.checklist_categorias;
CREATE POLICY "checklist_categorias: select for authenticated"
ON public.checklist_categorias FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "checklist_categorias: admin all" ON public.checklist_categorias;
CREATE POLICY "checklist_categorias: admin all"
ON public.checklist_categorias FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "checklist_categorias: gestor_empleado insert" ON public.checklist_categorias;
CREATE POLICY "checklist_categorias: gestor_empleado insert"
ON public.checklist_categorias FOR INSERT TO authenticated
WITH CHECK ((SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado'));

DROP POLICY IF EXISTS "checklist_categorias: gestor_empleado update" ON public.checklist_categorias;
CREATE POLICY "checklist_categorias: gestor_empleado update"
ON public.checklist_categorias FOR UPDATE TO authenticated
USING ((SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado'))
WITH CHECK ((SELECT rol FROM public.profiles WHERE user_id = auth.uid()) IN ('gestor', 'empleado'));

-- ============================================
-- crear_checklist: ahora copia también la categoría
-- ============================================

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
        SELECT id, titulo, descripcion, orden, categoria_id
        FROM checklist_plantilla_items
        WHERE plantilla_id = p_plantilla_id AND parent_id IS NULL
        ORDER BY orden, id
    LOOP
        INSERT INTO checklist_items (checklist_id, titulo, descripcion, orden, categoria_id)
        VALUES (v_checklist_id, v_madre.titulo, v_madre.descripcion, v_madre.orden, v_madre.categoria_id)
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

-- ============================================
-- CATEGORÍAS INICIALES
-- ============================================

INSERT INTO public.checklist_categorias (nombre, orden)
SELECT v.nombre, v.orden
FROM (VALUES
    (1, 'Banco y firmas'),
    (2, 'Trámites y certificados'),
    (3, 'Alta en programas'),
    (4, 'Archivo y digitalización'),
    (5, 'Suministros'),
    (6, 'Proveedores y mantenimiento'),
    (7, 'Seguro'),
    (8, 'Junta y comité')
) AS v(orden, nombre)
WHERE NOT EXISTS (
    SELECT 1 FROM public.checklist_categorias c WHERE lower(trim(c.nombre)) = lower(trim(v.nombre))
);

-- ============================================
-- CLASIFICAR LA PLANTILLA "Alta de comunidad nueva"
-- ============================================
-- Solo toca tareas principales que aún no tienen categoría.

UPDATE public.checklist_plantilla_items i
SET categoria_id = c.id
FROM (VALUES
    ('Ir al banco a hacer cambio de firmas con el presidente', 'Banco y firmas'),
    ('Solicitar certificado digital de la comunidad (FINCATECH)', 'Trámites y certificados'),
    ('Solicitar protección de datos a Privacidad Global', 'Trámites y certificados'),
    ('Solicitar CAE a Fincatech', 'Trámites y certificados'),
    ('Contrato Admin. CP', 'Trámites y certificados'),
    ('Dar de alta la comunidad en el programa', 'Alta en programas'),
    ('Alta de la Comunidad en programa de gestión', 'Alta en programas'),
    ('Alta de la Comunidad en programa de gestión de incidencias', 'Alta en programas'),
    ('Dar alta elementos de la Comunidad si tiene', 'Alta en programas'),
    ('Dar de alta la incidencia Gestión de llaves de la Comunidad', 'Alta en programas'),
    ('Dar de alta trabajadores de la Comunidad con datos de contacto en programa de gestión. Horario de trabajo', 'Alta en programas'),
    ('Vado garajes número y verificar que está domiciliado. Alta en control de elementos general', 'Alta en programas'),
    ('Demandas, propietario, motivo, abogado. Alta en gestión de incidencias', 'Alta en programas'),
    ('Crear carpetas específicas de la Comunidad', 'Archivo y digitalización'),
    ('Digitalizar y archivar CIF de la Comunidad', 'Archivo y digitalización'),
    ('Digitalizar y archivar DNI del Presidente', 'Archivo y digitalización'),
    ('Digitalizar y archivar:', 'Archivo y digitalización'),
    ('Digitalizar Normas piscina, licencia apertura piscina o declaración responsable. Empresa de Analítica de Piscina', 'Archivo y digitalización'),
    ('Última Acta inspección obligatoria de ascensores. Digitalizar y archivar', 'Archivo y digitalización'),
    ('Última Acta inspección obligatoria instalaciones eléctricas. Digitalizar y archivar', 'Archivo y digitalización'),
    ('Última Acta inspección obligatoria contraincendios. Digitalizar y archivar', 'Archivo y digitalización'),
    ('Digitalizar Libro de Actas y archivar', 'Archivo y digitalización'),
    ('Empresa de suministro eléctrico y contratos. Cambiar dirección de correspondencia (watium)', 'Suministros'),
    ('Empresa de suministro de agua y contratos. Cambiar dirección de correspondencia', 'Suministros'),
    ('Empresa de mantenimiento de ascensores y contrato. Cambiar dirección de correspondencia', 'Proveedores y mantenimiento'),
    ('Empresa de mantenimiento contraincendios y contrato. Cambiar dirección de correspondencia (Mario)', 'Proveedores y mantenimiento'),
    ('Empresas de mantenimiento de la Comunidad: limpieza, mantenimiento, jardinería, seguridad, DDD', 'Proveedores y mantenimiento'),
    ('Empresa de Gestión de Nóminas y documentos. Anotar responsable y tlf', 'Proveedores y mantenimiento'),
    ('Servicio DDD. Alta en contratos', 'Proveedores y mantenimiento'),
    ('Alta contrato empresa mantenimiento extintores', 'Proveedores y mantenimiento'),
    ('Alta empresa mantenimiento puertas de garajes', 'Proveedores y mantenimiento'),
    ('Empresa de control de plagas (cambiar correspondencia y a hidroteco)', 'Proveedores y mantenimiento'),
    ('Pedir oferta de Seguro y cambiar?', 'Seguro'),
    ('Reunión comité inicial', 'Junta y comité')
) AS m(titulo, categoria)
JOIN public.checklist_categorias c ON c.nombre = m.categoria
JOIN public.checklist_plantillas p ON p.nombre = 'Alta de comunidad nueva'
WHERE i.plantilla_id = p.id
  AND i.parent_id IS NULL
  AND i.categoria_id IS NULL
  AND i.titulo = m.titulo;
