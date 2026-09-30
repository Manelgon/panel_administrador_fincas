'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import FormModal from '@/components/FormModal';
import FormField from '@/components/FormField';
import SearchableSelect from '@/components/SearchableSelect';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';

export interface ComunidadOpcion {
    id: number;
    nombre: string;
}

interface PlantillaOpcion {
    id: number;
    nombre: string;
    descripcion: string;
}

interface Props {
    isOpen: boolean;
    comunidades: ComunidadOpcion[];
    comunidadInicial?: number;
    onClose: () => void;
    onCreado: (id: number) => void;
}

const inputClass = 'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all';

// Solo se monta abierto: cada apertura empieza con el formulario limpio
export default function NuevoChecklistModal(props: Props) {
    return props.isOpen ? <Formulario {...props} /> : null;
}

function Formulario({ comunidades, comunidadInicial, onClose, onCreado }: Props) {
    const [plantillas, setPlantillas] = useState<PlantillaOpcion[]>([]);
    const [comunidadId, setComunidadId] = useState<number | ''>(comunidadInicial ?? '');
    const [plantillaId, setPlantillaId] = useState<number | ''>('');
    const [nombre, setNombre] = useState('');
    const [nombreTocado, setNombreTocado] = useState(false);
    const [descripcion, setDescripcion] = useState('');
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        supabase
            .from('checklist_plantillas')
            .select('id, nombre, descripcion')
            .eq('activo', true)
            .order('nombre')
            .then(({ data }) => setPlantillas((data as PlantillaOpcion[]) || []));
    }, []);

    const elegirPlantilla = (valor: string) => {
        const id = valor === '' ? '' : Number(valor);
        setPlantillaId(id);
        // Mientras el usuario no escriba su propio nombre, se propone el de la plantilla
        if (!nombreTocado) {
            const p = plantillas.find(x => x.id === id);
            setNombre(p?.nombre ?? '');
            setDescripcion(p?.descripcion ?? '');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const nuevosErrores: Record<string, string> = {};
        if (!nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio';
        setErrores(nuevosErrores);
        if (Object.keys(nuevosErrores).length) return;

        setGuardando(true);
        const { data, error } = await supabase.rpc('crear_checklist', {
            p_comunidad_id: comunidadId === '' ? null : comunidadId,
            p_nombre: nombre.trim(),
            p_descripcion: descripcion.trim(),
            p_plantilla_id: plantillaId === '' ? null : plantillaId,
        });
        setGuardando(false);

        if (error || !data) {
            console.error(error);
            toast.error('No se pudo crear el checklist');
            return;
        }

        const comunidad = comunidades.find(c => c.id === comunidadId);
        await logActivity({
            action: 'create',
            entityType: 'checklist',
            entityId: data as number,
            entityName: `${nombre.trim()} - ${comunidad?.nombre ?? 'Sin comunidad'}`,
            details: { plantilla_id: plantillaId || null, comunidad_id: comunidadId || null },
        });
        toast.success('Checklist creado');
        onCreado(data as number);
    };

    return (
        <FormModal
            isOpen
            portalReady
            onClose={onClose}
            onSubmit={handleSubmit}
            title="Nuevo checklist"
            subtitle="Elige la comunidad (o déjalo sin comunidad) y, si quieres, una plantilla para copiar sus tareas"
            editingId={null}
            submitLabel={guardando ? 'Creando...' : 'Crear checklist'}
            formId="nuevo-checklist-form"
        >
            <div className="space-y-4">
                <FormField label="Comunidad (opcional)" error={errores.comunidad}>
                    <SearchableSelect
                        options={[{ value: '', label: 'Sin comunidad' }, ...comunidades.map(c => ({ value: c.id, label: c.nombre }))]}
                        value={comunidadId}
                        onChange={v => { setComunidadId(v === '' ? '' : Number(v)); setErrores(p => ({ ...p, comunidad: '' })); }}
                        placeholder="Sin comunidad"
                    />
                </FormField>

                <FormField label="Plantilla">
                    <select className={inputClass} value={plantillaId} onChange={e => elegirPlantilla(e.target.value)}>
                        <option value="">En blanco (sin plantilla)</option>
                        {plantillas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                </FormField>

                <FormField label="Nombre" required error={errores.nombre}>
                    <input
                        className={inputClass}
                        value={nombre}
                        onChange={e => { setNombre(e.target.value); setNombreTocado(true); setErrores(p => ({ ...p, nombre: '' })); }}
                        placeholder="Ej.: Alta de comunidad nueva"
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
