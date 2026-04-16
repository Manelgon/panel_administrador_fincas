'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, CheckCircle2, Loader2, Ticket } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { logActivity } from '@/lib/logActivity';
import { Reunion, Profile } from '@/lib/schemas';
import SearchableSelect from '@/components/SearchableSelect';

const TICKET_TYPES = [
    { value: 'Estado de cuentas',               label: '1 · Estado de cuentas' },
    { value: 'Informe incidencias',              label: '2 · Informe incidencias' },
    { value: 'Listado asistentes y etiquetas',   label: '3 · Listado asistentes y etiquetas' },
    { value: 'Portadas convocatoria y acta',     label: '4 · Portadas convocatoria y acta' },
    { value: 'Listado morosidad',                label: '5 · Listado morosidad' },
];

interface TicketRow { id: number; tipo: string; gestor_id: string; }

interface Props {
    reunion: Reunion;
    onClose: () => void;
    onConfirmed: () => void;
}

let nextId = 1;

export default function ConfirmarReunionTicketsModal({ reunion, onClose, onConfirmed }: Props) {
    const [tickets, setTickets] = useState<TicketRow[]>([{ id: nextId++, tipo: '', gestor_id: '' }]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        supabase
            .from('profiles')
            .select('user_id, nombre, rol')
            .order('nombre', { ascending: true })
            .then(({ data, error }) => {
                if (error) console.error('[ConfirmarReunionTicketsModal] profiles error:', error);
                if (data) setProfiles(data);
            });
    }, []);

    const addTicket = () => setTickets(prev => [...prev, { id: nextId++, tipo: '', gestor_id: '' }]);
    const removeTicket = (id: number) => setTickets(prev => prev.filter(t => t.id !== id));
    const updateTicket = (id: number, field: keyof Omit<TicketRow, 'id'>, value: string) =>
        setTickets(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));

    const fechaDisplay = reunion.fecha_reunion
        ? new Date(reunion.fecha_reunion + 'T00:00:00').toLocaleDateString('es-ES')
        : '';

    const handleConfirmar = async (crearTickets: boolean) => {
        setIsSubmitting(true);
        try {
            const { error: errReunion } = await supabase
                .from('reuniones')
                .update({ confirmada: true })
                .eq('id', reunion.id);

            if (errReunion) throw errReunion;

            await logActivity({
                action: 'confirm',
                entityType: 'reunion',
                entityId: reunion.id,
                entityName: `${reunion.tipo} - ${reunion.comunidad}`,
                details: { fecha: reunion.fecha_reunion, comunidad: reunion.comunidad },
            });

            if (crearTickets) {
                const validTickets = tickets.filter(t => t.tipo);

                // Obtener usuario actual (seguro, sin destructuring profundo)
                const authRes = await supabase.auth.getUser();
                const currentUserId = authRes.data?.user?.id ?? null;

                let creados = 0;

                for (const ticket of validTickets) {
                    const { data: insertedRows, error: errTicket } = await supabase
                        .from('incidencias')
                        .insert({
                            comunidad_id:    reunion.comunidad_id,
                            motivo_ticket:   ticket.tipo,
                            mensaje:         `${ticket.tipo} — ${reunion.tipo} del ${fechaDisplay}`,
                            gestor_asignado: ticket.gestor_id || null,
                            source:          'Gestión Interna',
                            aviso:           0,
                            nombre_cliente:  '',
                            telefono:        '',
                            email:           '',
                        })
                        .select('id');

                    if (errTicket) {
                        console.error('[ConfirmarReunionTicketsModal] insert error:', errTicket);
                        toast.error(`Error al crear ticket "${ticket.tipo}": ${errTicket.message}`);
                        continue;
                    }

                    creados++;
                    const incidenciaId = insertedRows?.[0]?.id;

                    // Notificación interna al gestor asignado (solo si es distinto al usuario actual)
                    if (ticket.gestor_id && ticket.gestor_id !== currentUserId && incidenciaId) {
                        await supabase.from('notifications').insert({
                            user_id:     ticket.gestor_id,
                            type:        'assignment',
                            title:       'Nueva tarea asignada',
                            content:     `Se te ha asignado el ticket "${ticket.tipo}" — ${reunion.tipo} del ${fechaDisplay} (${reunion.comunidad})`,
                            entity_id:   incidenciaId,
                            entity_type: 'incidencia',
                            link:        `/dashboard/incidencias?id=${incidenciaId}`,
                            is_read:     false,
                        });
                    }

                    if (incidenciaId) {
                        const gestorProfile = ticket.gestor_id
                            ? profiles.find(p => p.user_id === ticket.gestor_id)
                            : null;
                        await logActivity({
                            action: 'create',
                            entityType: 'incidencia',
                            entityId: incidenciaId,
                            entityName: ticket.tipo,
                            details: {
                                origen: 'reunion',
                                reunion_id: reunion.id,
                                comunidad: reunion.comunidad,
                                fecha_reunion: reunion.fecha_reunion,
                                asignado_a: gestorProfile?.nombre || 'Sin asignar',
                            },
                        });
                    }
                }

                toast.success(
                    creados > 0
                        ? `Reunión confirmada y ${creados} ticket${creados > 1 ? 's' : ''} creado${creados > 1 ? 's' : ''}`
                        : 'Reunión confirmada'
                );
            } else {
                toast.success('Reunión confirmada');
            }

            onConfirmed();
        } catch {
            toast.error('Error al confirmar la reunión');
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center sm:justify-center sm:p-6">
            <div
                className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh] sm:max-h-[85dvh] animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-neutral-100 bg-neutral-50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#f5a623]/15 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-[#f5a623]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Confirmar reunión</h2>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">
                                {reunion.tipo} · {reunion.comunidad || '—'} · {fechaDisplay}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:px-5 sm:py-4 overflow-y-auto flex-1 space-y-5">

                    <p className="text-sm text-neutral-600">
                        ¿Deseas crear tickets relacionados con esta reunión?
                    </p>

                    {/* Tickets */}
                    <div>
                        <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-3 border-b border-[#f5a623]">
                            Tickets a crear
                        </h3>
                        <div className="space-y-2">
                            {tickets.map((ticket, idx) => (
                                <div key={ticket.id} className="grid grid-cols-[24px_1fr_140px_32px] items-center gap-2">
                                    {/* Número */}
                                    <div className="w-6 h-6 rounded-full bg-[#f5a623]/20 text-[#f5a623] text-[10px] font-black flex items-center justify-center">
                                        {idx + 1}
                                    </div>

                                    {/* Tipo */}
                                    <SearchableSelect
                                        value={ticket.tipo}
                                        onChange={val => updateTicket(ticket.id, 'tipo', String(val))}
                                        options={TICKET_TYPES}
                                        placeholder="Tipo de ticket..."
                                    />

                                    {/* Gestor */}
                                    <SearchableSelect
                                        value={ticket.gestor_id}
                                        onChange={val => updateTicket(ticket.id, 'gestor_id', String(val))}
                                        options={profiles.map(p => ({ value: p.user_id, label: p.nombre }))}
                                        placeholder="Gestor..."
                                    />

                                    {/* Borrar */}
                                    <button
                                        type="button"
                                        onClick={() => removeTicket(ticket.id)}
                                        disabled={tickets.length === 1}
                                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed justify-self-center"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={addTicket}
                            className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#f5a623] hover:text-[#e09510] transition"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Añadir ticket
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => handleConfirmar(false)}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Solo confirmar
                    </button>
                    <button
                        type="button"
                        onClick={() => handleConfirmar(true)}
                        disabled={isSubmitting || tickets.every(t => !t.tipo)}
                        className="px-6 py-2 bg-[#f5a623] hover:bg-[#e09510] text-neutral-950 rounded-lg text-xs font-bold transition disabled:opacity-40 flex items-center gap-2"
                    >
                        {isSubmitting
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Confirmando...</>
                            : <><Ticket className="w-3.5 h-3.5" />Confirmar y crear tickets</>
                        }
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
