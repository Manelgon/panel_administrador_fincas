import { FileText, Pause, CalendarClock } from 'lucide-react';
import { Column } from '@/components/DataTable';
import Badge from '@/components/ui/Badge';
import { getSecureUrl } from '@/lib/storage';
import { Incidencia, Profile } from '@/lib/schemas';

export function buildColumns(profiles: Profile[]): Column<Incidencia>[] {
    return [
        { key: 'id', label: 'ID' },
        {
            key: 'codigo',
            label: 'Código',
            render: (row) => (
                <div className="flex items-start gap-3">
                    <span className={`mt-1 h-3.5 w-1.5 rounded-full ${(row.estado || (row.resuelto ? 'Resuelto' : 'Pendiente')) === 'Resuelto' ? 'bg-neutral-900' : (row.estado === 'Aplazado' ? 'bg-orange-400' : 'bg-[#bf4b50]')}`} />
                    <span className="font-semibold">{row.comunidades?.codigo || '-'}</span>
                </div>
            ),
        },
        { key: 'comunidad', label: 'Comunidad', render: (row) => row.comunidad || (row.comunidades?.nombre_cdad) || '-' },
        { key: 'nombre_cliente', label: 'Cliente' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'email', label: 'Email', render: (row) => <span className="text-xs">{row.email || '-'}</span> },
        {
            key: 'source',
            label: 'Entrada',
            render: (row) => {
                if (!row.source) return <span className="text-neutral-400">-</span>;
                const icons: Record<string, string> = { 'Llamada': '📞', 'Presencial': '🤝', 'Email': '📧', 'Whatsapp': '💬', 'App 360': '📱', 'Acuerdo Junta': '📋' };
                return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-[11px] font-medium capitalize">{icons[row.source] || ''} {row.source}</span>;
            },
        },
        { key: 'motivo_ticket', label: 'Motivo Ticket', render: (row) => <div className="max-w-xs truncate text-xs" title={row.motivo_ticket || ''}>{row.motivo_ticket || '-'}</div> },
        { key: 'mensaje', label: 'Mensaje', render: (row) => <div className="max-w-xs truncate text-xs" title={row.mensaje}>{row.mensaje}</div> },
        { key: 'nota_gestor', label: 'Nota Gestor', defaultVisible: false },
        { key: 'nota_propietario', label: 'Nota Prop.', defaultVisible: false },
        {
            key: 'adjuntos',
            label: 'Adjuntos',
            render: (row) => (
                <div className="flex flex-wrap gap-1">
                    {row.adjuntos && row.adjuntos.length > 0 ? (
                        row.adjuntos.map((url, i) => (
                            <a key={i} href={getSecureUrl(url)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors" title={`Ver adjunto ${i + 1}`}>
                                <FileText className="w-4 h-4" />
                            </a>
                        ))
                    ) : '-'}
                </div>
            ),
        },
        { key: 'created_at', label: 'Fecha', render: (row) => new Date(row.created_at).toLocaleDateString() },
        {
            key: 'gestor_asignado',
            label: 'Gestor',
            render: (row) => {
                const joinedName = (row as any).gestor?.nombre;
                if (joinedName) return joinedName;
                const localProfile = profiles.find(p => p.user_id === row.gestor_asignado);
                return localProfile?.nombre || row.gestor_asignado || '-';
            },
        },
        {
            key: 'quien_lo_recibe',
            label: 'Receptor',
            render: (row) => {
                const joinedName = (row as any).receptor?.nombre;
                if (joinedName) return joinedName;
                const localProfile = profiles.find(p => p.user_id === row.quien_lo_recibe);
                return localProfile?.nombre || row.quien_lo_recibe || '-';
            },
        },
        {
            key: 'aviso',
            label: 'Aviso',
            render: (row) => {
                const v = Number(row.aviso);
                const labels: Record<number, { label: string; cls: string }> = {
                    0: { label: 'Sin aviso', cls: 'bg-neutral-100 text-neutral-500' },
                    1: { label: 'WhatsApp', cls: 'bg-green-100 text-green-700' },
                    2: { label: 'Email', cls: 'bg-blue-100 text-blue-700' },
                    3: { label: 'Email + WA', cls: 'bg-indigo-100 text-indigo-700' },
                };
                const entry = labels[v] ?? { label: '-', cls: 'text-neutral-400' };
                return <div className="flex justify-center"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${entry.cls}`}>{entry.label}</span></div>;
            },
        },
        { key: 'categoria', label: 'Categoría' },
        {
            key: 'urgencia',
            label: 'Urgencia',
            render: (row) => (
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${row.urgencia === 'Alta' ? 'bg-red-100 text-red-700' : row.urgencia === 'Media' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                    {row.urgencia}
                </span>
            ),
        },
        { key: 'sentimiento', label: 'Sentimiento' },
        {
            key: 'resuelto',
            label: 'Estado',
            render: (row) => {
                const estado = row.estado || (row.resuelto ? 'Resuelto' : 'Pendiente');
                return (
                    <div className="flex flex-col items-start gap-1">
                        <Badge variant={estado === 'Resuelto' ? 'success' : estado === 'Aplazado' ? 'info' : 'warning'}>
                            {estado === 'Aplazado' && <Pause className="w-3 h-3 inline mr-0.5" />}
                            {estado}
                        </Badge>
                        {estado === 'Aplazado' && row.fecha_recordatorio && (
                            <span className="text-[10px] text-orange-500 font-medium flex items-center gap-1">
                                <CalendarClock className="w-3 h-3" />
                                {new Date(row.fecha_recordatorio).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </span>
                        )}
                    </div>
                );
            },
            sortable: false,
        },
        { key: 'dia_resuelto', label: 'Día Res.', render: (row) => row.dia_resuelto ? new Date(row.dia_resuelto).toLocaleDateString() : '-', defaultVisible: false },
        { key: 'resuelto_por', label: 'Resuelto Por', render: (row) => row.resolver?.nombre || '-', defaultVisible: false },
    ];
}
