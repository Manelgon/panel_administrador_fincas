'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/logActivity';
import FormField from '@/components/FormField';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCreado: (proveedor: { id: number; nombre: string }) => void;
}

// Alta rápida de proveedor desde el formulario de contrato: solo los datos
// imprescindibles. El resto (dirección, ciudad...) se completa luego en la
// pestaña Proveedores. Va por encima de FormModal (z-[9999]).
export default function NuevoProveedorModal({ isOpen, onClose, onCreado }: Props) {
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [cif, setCif] = useState('');
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [guardando, setGuardando] = useState(false);

    if (!isOpen) return null;

    const limpiar = () => {
        setNombre(''); setTelefono(''); setEmail(''); setCif(''); setErrores({});
    };

    const cerrar = () => { limpiar(); onClose(); };

    const guardar = async () => {
        const errs: Record<string, string> = {};
        if (!nombre.trim()) errs.nombre = 'El nombre del proveedor es obligatorio';
        const phoneRegex = /^(\d{9,}|[0-9\-]+@g\.us)$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (telefono && !phoneRegex.test(telefono)) errs.telefono = 'El teléfono debe tener al menos 9 dígitos';
        if (email && !emailRegex.test(email)) errs.email = 'El formato del email no es válido';
        if (Object.keys(errs).length > 0) { setErrores(errs); return; }

        setGuardando(true);
        try {
            const limpio = nombre.replace(/\s+/g, ' ').trim();

            // Evita crear un duplicado si ya existe con el mismo nombre
            const { data: existente } = await supabase
                .from('proveedores')
                .select('id, nombre')
                .ilike('nombre', limpio)
                .maybeSingle();

            if (existente) {
                toast.error(`Ya existe el proveedor "${existente.nombre}", se ha seleccionado`);
                onCreado({ id: existente.id, nombre: existente.nombre });
                cerrar();
                return;
            }

            const { data, error } = await supabase
                .from('proveedores')
                .insert({
                    nombre: limpio,
                    telefono: telefono.trim() || null,
                    email: email.trim() || null,
                    cif: cif.trim() || null,
                    activo: true,
                })
                .select('id, nombre')
                .single();
            if (error || !data) throw error;

            await logActivity({ action: 'create', entityType: 'proveedor', entityId: data.id, entityName: data.nombre });
            toast.success(`Proveedor "${data.nombre}" creado`);
            onCreado({ id: data.id, nombre: data.nombre });
            cerrar();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : 'No se pudo crear el proveedor');
        } finally {
            setGuardando(false);
        }
    };

    const inputClass = (field?: string) =>
        `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30 focus:border-yellow-400 transition-all ${field && errores[field] ? 'border-red-400' : 'border-neutral-200'}`;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100000] flex justify-center items-end sm:items-center sm:p-6">
            <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[92dvh]">
                <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-lg font-black text-neutral-900 tracking-tight">Nuevo Proveedor</h2>
                        <p className="text-xs text-neutral-500 mt-0.5">Se añadirá al contrato que estás creando</p>
                    </div>
                    <button type="button" onClick={cerrar} className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    <FormField label="Nombre / Razón Social" required error={errores.nombre}>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Servicios Integrales S.L."
                            className={inputClass('nombre')}
                            value={nombre}
                            onChange={e => { setNombre(e.target.value); setErrores(p => ({ ...p, nombre: '' })); }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } }}
                        />
                    </FormField>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Teléfono" error={errores.telefono}>
                            <input
                                type="tel"
                                placeholder="600 000 000"
                                className={inputClass('telefono')}
                                value={telefono}
                                onChange={e => { setTelefono(e.target.value); setErrores(p => ({ ...p, telefono: '' })); }}
                            />
                        </FormField>
                        <FormField label="CIF">
                            <input
                                type="text"
                                placeholder="B12345678"
                                maxLength={9}
                                className={`${inputClass()} uppercase`}
                                value={cif}
                                onChange={e => setCif(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                            />
                        </FormField>
                    </div>
                    <FormField label="Email" error={errores.email}>
                        <input
                            type="email"
                            placeholder="admin@servicios.com"
                            className={inputClass('email')}
                            value={email}
                            onChange={e => { setEmail(e.target.value); setErrores(p => ({ ...p, email: '' })); }}
                        />
                    </FormField>
                    <p className="text-xs text-neutral-400">
                        Los demás datos (dirección, ciudad, provincia) se pueden completar después en la pestaña Proveedores.
                    </p>
                </div>

                <div className="px-6 py-4 bg-white border-t border-neutral-100 flex items-center justify-end gap-2 shrink-0">
                    <button type="button" onClick={cerrar} className="px-4 py-2.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={guardar}
                        disabled={guardando}
                        className="px-5 py-2.5 text-sm font-black text-neutral-900 bg-yellow-400 hover:bg-yellow-500 rounded-xl disabled:opacity-50"
                    >
                        {guardando ? 'Creando...' : 'Crear Proveedor'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
