'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';

type Tipo = 'plantilla' | 'checklist';

const CONFIG: Record<Tipo, { tabla: string; entityType: 'checklist_plantilla' | 'checklist'; nombre: string }> = {
    plantilla: { tabla: 'checklist_plantillas', entityType: 'checklist_plantilla', nombre: 'plantilla' },
    checklist: { tabla: 'checklists', entityType: 'checklist', nombre: 'checklist' },
};

interface Props {
    isOpen: boolean;
    tipo: Tipo;
    /** Registro a editar; null = crear (solo plantillas: los checklists se crean con NuevoChecklistModal) */
    registro: { id: number; nombre: string; descripcion: string } | null;
    onClose: () => void;
    onGuardada: (id: number) => void;
}

const inputClass = 'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all';

// Solo se monta abierto: así el formulario arranca siempre con los datos del registro
export default function CabeceraModal(props: Props) {
    return props.isOpen ? <Formulario {...props} /> : null;
}

function Formulario({ tipo, registro, onClose, onGuardada }: Props) {
    const { tabla, entityType, nombre: etiqueta } = CONFIG[tipo];
    const [nombre, setNombre] = useState(registro?.nombre ?? '');
    const [descripcion, setDescripcion] = useState(registro?.descripcion ?? '');
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) {
            setError('El nombre es obligatorio');
            return;
        }
        setGuardando(true);
        const datos = { nombre: nombre.trim(), descripcion: descripcion.trim() };
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error: errorBD } = registro
            ? await supabase.from(tabla).update(datos).eq('id', registro.id).select('id').single()
            : await supabase.from(tabla).insert({ ...datos, created_by: user?.id }).select('id').single();
        setGuardando(false);

        if (errorBD || !data) {
            console.error(errorBD);
            toast.error('No se pudieron guardar los cambios');
            return;
        }
        await logActivity({
            action: registro ? 'update' : 'create',
            entityType,
            entityId: data.id,
            entityName: datos.nombre,
        });
        toast.success(registro ? 'Cambios guardados' : 'Plantilla creada');
        onGuardada(data.id);
    };

    return (
        <FormModal
            isOpen
            portalReady
            onClose={onClose}
            onSubmit={handleSubmit}
            title={registro ? `Editar ${etiqueta}` : `Nueva ${etiqueta}`}
            subtitle={!registro && tipo === 'plantilla' ? 'Después podrás añadir sus tareas y subtareas' : undefined}
            editingId={registro?.id ?? null}
            submitLabel={guardando ? 'Guardando...' : registro ? 'Guardar cambios' : `Crear ${etiqueta}`}
            formId="checklist-cabecera-form"
        >
            <div className="space-y-4">
                <FormField label="Nombre" required error={error}>
                    <input
                        autoFocus
                        className={inputClass}
                        value={nombre}
                        onChange={e => { setNombre(e.target.value); setError(''); }}
                        placeholder={tipo === 'plantilla' ? 'Ej.: Alta de comunidad nueva' : ''}
                    />
                </FormField>
                <FormField label="Descripción">
                    <textarea
                        className={`${inputClass} min-h-[70px]`}
                        value={descripcion}
                        onChange={e => setDescripcion(e.target.value)}
                        placeholder="Opcional"
                    />
                </FormField>
            </div>
        </FormModal>
    );
}
