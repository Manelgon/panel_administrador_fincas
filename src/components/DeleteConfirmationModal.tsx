'use client';

import { useState, useEffect, useRef } from 'react';
import { Trash2, X, Loader2 } from 'lucide-react';
import ModalPortal from '@/components/ModalPortal';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (credentials: { email: string; password: string }) => Promise<void>;
    title?: string;
    description?: string;
    itemType?: string;
    isDeleting?: boolean;
}

export default function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirmar Eliminación',
    description = 'Esta acción no se puede deshacer. Para confirmar, es necesaria la autorización de un administrador.',
    itemType = 'registro',
    isDeleting = false
}: DeleteConfirmationModalProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const overlayRef = useRef<HTMLDivElement>(null);

    // Reset fields on modal open/close
    useEffect(() => {
        if (!isOpen) {
            setEmail('');
            setPassword('');
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onConfirm({ email, password });
    };

    return (
        <ModalPortal>
        <div
            ref={overlayRef}
            className="fixed inset-0 bg-black/50 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
            role="presentation"
        >
            <div
                className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border border-neutral-100"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-modal-title"
                aria-describedby="delete-modal-desc"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    aria-label="Cerrar modal"
                    className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-8 text-center">
                    <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 ring-8 ring-red-50/50">
                        <Trash2 className="w-8 h-8 text-red-600" />
                    </div>
                    <h3 id="delete-modal-title" className="text-xl font-black text-neutral-900 uppercase tracking-tight">{title}</h3>
                    <p id="delete-modal-desc" className="text-sm text-neutral-500 mt-2 font-medium">
                        {description}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="delete-admin-email" className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Email Administrador</label>
                        <input
                            id="delete-admin-email"
                            type="email"
                            required
                            disabled={isDeleting}
                            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all text-sm"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@ejemplo.com"
                            autoComplete="off"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="delete-admin-pass" className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Contraseña Administrador</label>
                        <input
                            id="delete-admin-pass"
                            type="password"
                            required
                            disabled={isDeleting}
                            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all text-sm"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 px-6 border border-neutral-200 text-neutral-600 rounded-xl hover:bg-neutral-50 font-bold text-xs uppercase tracking-widest transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isDeleting}
                            className="flex-1 h-12 px-6 bg-red-600 text-white rounded-xl hover:bg-red-700 font-black text-xs uppercase tracking-[0.15em] transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>ELIMINANDO...</span>
                                </>
                            ) : (
                                <span>ELIMINAR {itemType.toUpperCase()}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
        </ModalPortal>
    );
}
