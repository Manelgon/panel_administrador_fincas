'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { LayoutGrid, Check, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { cargarPrefs, guardarPrefs, type PrefsMiDia } from '@/lib/miDia';
import type { EdicionBloque } from '@/components/mi-dia/BloqueMiDia';
import BloqueTareas from '@/components/mi-dia/BloqueTareas';
import BloqueChecklist from '@/components/mi-dia/BloqueChecklist';
import BloqueAvisos from '@/components/mi-dia/BloqueAvisos';
import BloqueTrabajo from '@/components/mi-dia/BloqueTrabajo';
import BloqueVacacionesAdmin from '@/components/mi-dia/BloqueVacacionesAdmin';
import { BloqueDeudas, BloqueReuniones, BloqueVacaciones, BloqueContratos } from '@/components/mi-dia/BloquesGenerales';

type PropsBloque = { edicion: EdicionBloque };

const BLOQUES: Record<string, ComponentType<PropsBloque>> = {
    tareas: BloqueTareas,
    checklist: BloqueChecklist,
    avisos: BloqueAvisos,
    deudas: BloqueDeudas,
    trabajo: BloqueTrabajo,
    reuniones: BloqueReuniones,
    vacaciones: BloqueVacaciones,
    contratos: BloqueContratos,
    vacacionesAdmin: BloqueVacacionesAdmin,
};

/** Bloques que solo ven los admins */
const SOLO_ADMIN = ['vacacionesAdmin'];

const ORDEN_INICIAL = Object.keys(BLOQUES);
const PREFS_INICIALES: PrefsMiDia = { orden: ORDEN_INICIAL, ocultos: [] };

/** Bloques plegados: comodidad de cada navegador, no hace falta guardarlo en la BD */
const CLAVE_PLEGADOS = 'mi-dia-plegados';

function leerPlegados(): string[] {
    try { return JSON.parse(localStorage.getItem(CLAVE_PLEGADOS) ?? '[]'); } catch { return []; }
}

function escribirPlegados(ids: string[]) {
    try { localStorage.setItem(CLAVE_PLEGADOS, JSON.stringify(ids)); } catch { /* sin almacenamiento local */ }
}

/** Respeta el orden guardado y añade al final los bloques nuevos que aún no conocía el usuario */
function normalizar(p: PrefsMiDia | null): PrefsMiDia {
    if (!p) return PREFS_INICIALES;
    const orden = p.orden.filter(id => id in BLOQUES);
    ORDEN_INICIAL.forEach(id => { if (!orden.includes(id)) orden.push(id); });
    return { orden, ocultos: p.ocultos.filter(id => id in BLOQUES) };
}

function mover(orden: string[], id: string, destino: number): string[] {
    const sin = orden.filter(x => x !== id);
    sin.splice(Math.max(0, Math.min(destino, sin.length)), 0, id);
    return sin;
}

export default function MiDiaPage() {
    const [prefs, setPrefs] = useState<PrefsMiDia>(PREFS_INICIALES);
    const [editando, setEditando] = useState(false);
    const [arrastrado, setArrastrado] = useState<string | null>(null);
    const [esAdmin, setEsAdmin] = useState(false);
    const [plegados, setPlegados] = useState<string[]>([]);

    useEffect(() => {
        cargarPrefs().then(p => {
            setPrefs(normalizar(p));
            setPlegados(leerPlegados());
        });
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session?.user) return;
            const { data } = await supabase.from('profiles').select('rol').eq('user_id', session.user.id).single();
            setEsAdmin(data?.rol === 'admin');
        });
    }, []);

    const alternarEdicion = () => {
        if (editando) guardarPrefs(prefs);
        setEditando(e => !e);
    };

    const edicionDe = (id: string): EdicionBloque => ({
        activa: editando,
        oculto: prefs.ocultos.includes(id),
        arrastrando: arrastrado === id,
        plegado: plegados.includes(id),
        onPlegar: () => setPlegados(prev => {
            const sig = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            escribirPlegados(sig);
            return sig;
        }),
        onOcultar: () => setPrefs(p => ({
            ...p,
            ocultos: p.ocultos.includes(id) ? p.ocultos.filter(x => x !== id) : [...p.ocultos, id],
        })),
        onMover: dir => setPrefs(p => ({ ...p, orden: mover(p.orden, id, p.orden.indexOf(id) + dir) })),
        onDragStart: () => setArrastrado(id),
        onDragOver: () => {
            if (!arrastrado || arrastrado === id) return;
            setPrefs(p => ({ ...p, orden: mover(p.orden, arrastrado, p.orden.indexOf(id)) }));
        },
        onDragEnd: () => setArrastrado(null),
    });

    const visibles = prefs.orden
        .filter(id => esAdmin || !SOLO_ADMIN.includes(id))
        .filter(id => editando || !prefs.ocultos.includes(id));
    const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="space-y-4 md:space-y-5 pb-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">Mi día</h1>
                    <p className="text-neutral-500 text-sm first-letter:uppercase">
                        {editando ? 'Arrastra los bloques (o usa las flechas) para ordenarlos y oculta los que no uses.' : hoy}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {editando && (
                        <button onClick={() => setPrefs(PREFS_INICIALES)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition">
                            <RotateCcw className="w-4 h-4" /> Restablecer
                        </button>
                    )}
                    <button onClick={alternarEdicion}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm
                            ${editando ? 'bg-yellow-400 text-neutral-950 hover:bg-yellow-500' : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'}`}>
                        {editando ? <><Check className="w-4 h-4" /> Guardar</> : <><LayoutGrid className="w-4 h-4" /> Personalizar</>}
                    </button>
                </div>
            </div>

            {visibles.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center text-sm text-neutral-500">
                    Has ocultado todos los bloques. Pulsa «Personalizar» para volver a mostrarlos.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {visibles.map(id => {
                        const Bloque = BLOQUES[id];
                        return <Bloque key={id} edicion={edicionDe(id)} />;
                    })}
                </div>
            )}
        </div>
    );
}
