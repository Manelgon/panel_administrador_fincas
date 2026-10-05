'use client';

import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cargarMisAvisos, enlaceAviso, marcarAvisoLeido, marcarTodosLeidos, type MiAviso } from '@/lib/miDia';
import BloqueMiDia, { type EdicionBloque } from './BloqueMiDia';
import { useCarga, Fila, Vacio, ErrorCarga, Cargando, haceCuanto } from './comun';

export default function BloqueAvisos({ edicion }: { edicion: EdicionBloque }) {
    const router = useRouter();
    const { datos, error, recargar } = useCarga(cargarMisAvisos);

    const abrir = async (a: MiAviso) => {
        try { await marcarAvisoLeido(a.id); } catch (e) { console.error(e); }
        router.push(enlaceAviso(a));
    };

    const leerTodos = async () => {
        try { await marcarTodosLeidos(); toast.success('Avisos marcados como leídos'); recargar(); }
        catch (e) { console.error(e); toast.error('No se pudieron marcar los avisos'); }
    };

    const hayAvisos = !!datos && datos.total > 0;

    return (
        <BloqueMiDia titulo="Avisos sin leer" icono={Bell} contador={datos?.total} edicion={edicion}
            enlace={{ href: '/dashboard/avisos', texto: 'Ver avisos' }}
            accion={hayAvisos && (
                <button onClick={leerTodos} className="text-xs font-medium text-neutral-500 hover:text-neutral-900">Marcar leídos</button>
            )}>
            {error ? <ErrorCarga /> : !datos ? <Cargando /> : datos.items.length === 0 ? (
                <Vacio>Estás al día: no tienes avisos sin leer.</Vacio>
            ) : (
                <ul>
                    {datos.items.map(a => (
                        <Fila key={a.id}>
                            <button onClick={() => abrir(a)} className="min-w-0 flex-1 text-left group">
                                <p className="font-medium text-neutral-800 truncate group-hover:underline">{a.title}</p>
                                {a.body && <p className="text-xs text-neutral-500 truncate">{a.body}</p>}
                            </button>
                            <span className="text-xs text-neutral-400 flex-shrink-0">{haceCuanto(a.created_at)}</span>
                        </Fila>
                    ))}
                </ul>
            )}
        </BloqueMiDia>
    );
}
