'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Archive, ArchiveRestore, ArrowLeft, Building, Loader2, Pencil } from 'lucide-react';
import TareasEditor from '@/components/checklists/TareasEditor';
import CabeceraModal from '@/components/checklists/CabeceraModal';
import ResumenLateral from '@/components/checklists/ResumenLateral';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import { Categoria, ChecklistTarea, progreso } from '@/lib/checklists';

interface Cabecera {
    id: number;
    nombre: string;
    descripcion: string;
    activo: boolean;
    comunidad_id: number | null;
    comunidades: { codigo: string | null; nombre_cdad: string } | null;
    checklist_plantillas: { nombre: string } | null;
}

async function leerCabecera(id: number): Promise<Cabecera | null> {
    const { data, error } = await supabase
        .from('checklists')
        .select('id, nombre, descripcion, activo, comunidad_id, comunidades(codigo, nombre_cdad), checklist_plantillas(nombre)')
        .eq('id', id)
        .maybeSingle();
    return error ? null : (data as unknown as Cabecera | null);
}

const botonSecundario = 'px-3 py-2 rounded-xl flex items-center gap-1.5 text-sm font-semibold border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition';

export default function ChecklistDetallePage() {
    const { id } = useParams<{ id: string }>();
    const checklistId = Number(id);
    const [cabecera, setCabecera] = useState<Cabecera | null>(null);
    const [noExiste, setNoExiste] = useState(false);
    const [tareas, setTareas] = useState<ChecklistTarea[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [editando, setEditando] = useState(false);

    const cargar = useCallback(() => leerCabecera(checklistId).then(c => {
        if (c) setCabecera(c);
        else setNoExiste(true);
    }), [checklistId]);

    useEffect(() => { cargar(); }, [cargar]);

    const alCambiarTareas = useCallback((nuevas: ChecklistTarea[], cats: Categoria[]) => {
        setTareas(nuevas);
        setCategorias(cats);
    }, []);

    const comunidad = cabecera?.comunidades
        ? [cabecera.comunidades.codigo, cabecera.comunidades.nombre_cdad].filter(Boolean).join(' - ')
        : 'Sin comunidad';

    const alternarArchivo = async () => {
        if (!cabecera) return;
        const { error } = await supabase.from('checklists').update({ activo: !cabecera.activo }).eq('id', cabecera.id);
        if (error) {
            toast.error('No se pudo cambiar el estado');
            return;
        }
        await logActivity({
            action: 'toggle_active',
            entityType: 'checklist',
            entityId: cabecera.id,
            entityName: `${cabecera.nombre} - ${comunidad}`,
            details: { activo: !cabecera.activo },
        });
        toast.success(cabecera.activo ? 'Checklist archivado' : 'Checklist reactivado');
        cargar();
    };

    if (noExiste) {
        return (
            <div className="space-y-4">
                <Link href="/dashboard/checklists" className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-900">
                    <ArrowLeft className="w-4 h-4" /> Checklists
                </Link>
                <p className="text-neutral-600">Este checklist no existe o se ha eliminado.</p>
            </div>
        );
    }

    if (!cabecera) {
        return (
            <div className="flex justify-center py-20 text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    const avance = progreso(tareas);

    return (
        <div className="space-y-6 max-w-6xl">
            <Link href="/dashboard/checklists" className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-900">
                <ArrowLeft className="w-4 h-4" /> Checklists
            </Link>

            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500">
                            <Building className="w-3.5 h-3.5" /> {comunidad}
                        </p>
                        <h1 className="text-xl font-bold text-neutral-900 mt-1">{cabecera.nombre}</h1>
                        {cabecera.descripcion && <p className="text-sm text-neutral-500 mt-1">{cabecera.descripcion}</p>}
                        <p className="text-xs text-neutral-400 mt-2">
                            {cabecera.checklist_plantillas ? `Creado desde la plantilla «${cabecera.checklist_plantillas.nombre}»` : 'Creado en blanco'}
                            {!cabecera.activo && ' · Archivado'}
                        </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={() => setEditando(true)} className={botonSecundario}>
                            <Pencil className="w-4 h-4" /> Editar
                        </button>
                        <button onClick={alternarArchivo} className={botonSecundario}>
                            {cabecera.activo
                                ? <><Archive className="w-4 h-4" /> Archivar</>
                                : <><ArchiveRestore className="w-4 h-4" /> Reactivar</>}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${avance.pct === 100 ? 'bg-green-500' : 'bg-yellow-400'}`}
                            style={{ width: `${avance.pct}%` }}
                        />
                    </div>
                    <span className="text-sm font-semibold text-neutral-700 tabular-nums">
                        {avance.hechas} de {avance.total} · {avance.pct}%
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
                <TareasEditor modo="checklist" padreId={checklistId} onCambio={alCambiarTareas} />
                <ResumenLateral tareas={tareas} categorias={categorias} />
            </div>

            <CabeceraModal
                isOpen={editando}
                tipo="checklist"
                registro={cabecera}
                onClose={() => setEditando(false)}
                onGuardada={() => { setEditando(false); cargar(); }}
            />
        </div>
    );
}
