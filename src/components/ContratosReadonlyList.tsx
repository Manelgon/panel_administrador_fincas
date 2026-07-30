'use client';

import { useState, useEffect } from 'react';
import { Plus, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import ContratoPreavisoBadge from '@/components/ContratoPreavisoBadge';

interface ContratoRow {
    id: number;
    tipo_servicio: string | null;
    num_poliza: string | null;
    descripcion: string | null;
    fecha_vencimiento: string | null;
    fecha_preaviso: string | null;
    activo: boolean;
    comunidades: { nombre_cdad: string } | null;
    proveedores: { nombre: string } | null;
}

interface Props {
    comunidadId?: number;
    proveedorId?: number;
    onNuevoContrato: () => void;
}

// Lista compacta de contratos de una comunidad o de un proveedor,
// para los modales de detalle (solo lectura + alta rápida). PRP-004 Fase 3.
export default function ContratosReadonlyList({ comunidadId, proveedorId, onNuevoContrato }: Props) {
    const [contratos, setContratos] = useState<ContratoRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [vista, setVista] = useState<'activos' | 'inactivos'>('activos');

    useEffect(() => {
        const fetchContratos = async () => {
            let query = supabase
                .from('contratos')
                .select('id, tipo_servicio, num_poliza, descripcion, fecha_vencimiento, fecha_preaviso, activo, comunidades(nombre_cdad), proveedores(nombre)')
                .order('fecha_vencimiento', { ascending: true });
            if (comunidadId) query = query.eq('comunidad_id', comunidadId);
            if (proveedorId) query = query.eq('proveedor_id', proveedorId);
            const { data, error } = await query;
            if (!error) setContratos((data as unknown as ContratoRow[]) || []);
            setLoading(false);
        };
        fetchContratos();
    }, [comunidadId, proveedorId]);

    const activos = contratos.filter(c => c.activo);
    const inactivos = contratos.filter(c => !c.activo);
    const visibles = vista === 'activos' ? activos : inactivos;

    const tabClass = (tab: 'activos' | 'inactivos') =>
        `px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${vista === tab
            ? 'bg-yellow-400 text-neutral-950'
            : 'bg-neutral-100 text-neutral-500 hover:text-neutral-800'}`;

    return (
        <div className="space-y-2">
            {loading ? (
                <p className="text-sm text-neutral-400">Cargando contratos…</p>
            ) : contratos.length === 0 ? (
                <p className="text-sm text-neutral-400">Sin contratos registrados</p>
            ) : (
                <>
                <div className="flex items-center gap-2">
                    <button type="button" className={tabClass('activos')} onClick={() => setVista('activos')}>
                        Activos ({activos.length})
                    </button>
                    <button type="button" className={tabClass('inactivos')} onClick={() => setVista('inactivos')}>
                        Inactivos ({inactivos.length})
                    </button>
                </div>
                {visibles.length === 0 ? (
                    <p className="text-sm text-neutral-400">Sin contratos {vista}</p>
                ) : (
                <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                    {visibles.map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-neutral-900 truncate">
                                        {c.tipo_servicio || 'Sin tipo'}
                                        <span className="font-normal text-neutral-500">
                                            {' · '}
                                            {comunidadId ? c.proveedores?.nombre || '—' : c.comunidades?.nombre_cdad || '—'}
                                        </span>
                                    </p>
                                    <p className="text-xs text-neutral-500 truncate">
                                        {c.fecha_vencimiento ? `Vence ${new Date(c.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-ES')}` : 'Sin vencimiento'}
                                        {c.num_poliza ? ` · Póliza ${c.num_poliza}` : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {c.activo && <ContratoPreavisoBadge fechaPreaviso={c.fecha_preaviso} />}
                            </div>
                        </div>
                    ))}
                </div>
                )}
                </>
            )}
            <button
                type="button"
                onClick={onNuevoContrato}
                className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900 hover:text-yellow-600 transition-colors"
            >
                <Plus className="w-4 h-4" /> Nuevo contrato
            </button>
        </div>
    );
}
