'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Info, Loader2, Pencil } from 'lucide-react';
import TareasEditor from '@/components/checklists/TareasEditor';
import CabeceraModal from '@/components/checklists/CabeceraModal';
import { supabase } from '@/lib/supabaseClient';

interface Plantilla {
    id: number;
    nombre: string;
    descripcion: string;
    activo: boolean;
}

async function leerPlantilla(id: number): Promise<Plantilla | null> {
    const { data, error } = await supabase
        .from('checklist_plantillas')
        .select('id, nombre, descripcion, activo')
        .eq('id', id)
        .maybeSingle();
    return error ? null : (data as Plantilla | null);
}

export default function PlantillaDetallePage() {
    const { id } = useParams<{ id: string }>();
    const plantillaId = Number(id);
    const [plantilla, setPlantilla] = useState<Plantilla | null>(null);
    const [noExiste, setNoExiste] = useState(false);
    const [editando, setEditando] = useState(false);

    const cargar = useCallback(() => leerPlantilla(plantillaId).then(p => {
        if (p) setPlantilla(p);
        else setNoExiste(true);
    }), [plantillaId]);

    useEffect(() => { cargar(); }, [cargar]);

    const volver = (
        <Link href="/dashboard/checklists?tab=plantillas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-900">
            <ArrowLeft className="w-4 h-4" /> Plantillas
        </Link>
    );

    if (noExiste) {
        return (
            <div className="space-y-4">
                {volver}
                <p className="text-neutral-600">Esta plantilla no existe o se ha eliminado.</p>
            </div>
        );
    }

    if (!plantilla) {
        return (
            <div className="flex justify-center py-20 text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {volver}

            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        Plantilla{!plantilla.activo && ' · Archivada'}
                    </p>
                    <h1 className="text-xl font-bold text-neutral-900 mt-1">{plantilla.nombre}</h1>
                    {plantilla.descripcion && <p className="text-sm text-neutral-500 mt-1">{plantilla.descripcion}</p>}
                </div>
                <button
                    onClick={() => setEditando(true)}
                    className="px-3 py-2 rounded-xl flex items-center gap-1.5 text-sm font-semibold border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition shrink-0"
                >
                    <Pencil className="w-4 h-4" /> Editar nombre
                </button>
            </div>

            <p className="flex items-start gap-2 text-xs text-neutral-500">
                <Info className="w-4 h-4 shrink-0" />
                Los cambios en la plantilla se aplican a los checklists que se creen a partir de ahora. Los que ya existen no cambian.
            </p>

            <TareasEditor modo="plantilla" padreId={plantillaId} />

            <CabeceraModal
                isOpen={editando}
                tipo="plantilla"
                registro={plantilla}
                onClose={() => setEditando(false)}
                onGuardada={() => { setEditando(false); cargar(); }}
            />
        </div>
    );
}
