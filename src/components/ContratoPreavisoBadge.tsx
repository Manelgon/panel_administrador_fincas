'use client';

// Badge de estado de preaviso de un contrato (PRP-004).
// Único lugar donde vive el criterio "vencido / próximo": no duplicar fuera.
const DIAS_AVISO_PROXIMO = 30;

export function estadoPreaviso(fechaPreaviso: string | null | undefined): {
    estado: 'vencido' | 'proximo' | 'ok';
    dias: number;
} {
    if (!fechaPreaviso) return { estado: 'ok', dias: 0 };
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fecha = new Date(fechaPreaviso + 'T00:00:00');
    const dias = Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
    if (dias < 0) return { estado: 'vencido', dias };
    if (dias <= DIAS_AVISO_PROXIMO) return { estado: 'proximo', dias };
    return { estado: 'ok', dias };
}

export default function ContratoPreavisoBadge({ fechaPreaviso }: { fechaPreaviso: string | null | undefined }) {
    const { estado, dias } = estadoPreaviso(fechaPreaviso);
    if (estado === 'ok') return null;

    if (estado === 'vencido') {
        return (
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-700">
                Preaviso vencido
            </span>
        );
    }
    return (
        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-700">
            Preaviso {dias === 0 ? 'hoy' : `en ${dias}d`}
        </span>
    );
}
