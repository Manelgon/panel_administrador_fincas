"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import Dialog from "@/components/ui/Dialog";

interface Props {
    open: boolean;
    titulo: string;
    children: ReactNode;
    textoConfirmar: string;
    peligro?: boolean;
    ocupado?: boolean;
    onConfirmar: () => void;
    onCancelar: () => void;
}

/** Confirmación con la estética del panel (sustituye al confirm() del navegador). "Cancelar" recibe el foco. */
export default function ConfirmarDialog({ open, titulo, children, textoConfirmar, peligro, ocupado, onConfirmar, onCancelar }: Props) {
    return (
        <Dialog open={open} onClose={onCancelar} titleId="confirmar-titulo" descId="confirmar-desc" className="p-6">
            <div className="flex items-start gap-4">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${peligro ? "bg-red-50 text-red-600" : "bg-yellow-50 text-yellow-600"}`}>
                    <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                    <h3 id="confirmar-titulo" className="text-lg font-bold text-neutral-900">{titulo}</h3>
                    <div id="confirmar-desc" className="text-sm text-neutral-600 mt-1.5 space-y-2">{children}</div>
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={onCancelar} disabled={ocupado}
                    className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition disabled:opacity-50">
                    Cancelar
                </button>
                <button type="button" onClick={onConfirmar} disabled={ocupado}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition disabled:opacity-50 ${peligro ? "bg-red-600 hover:bg-red-700 text-white" : "bg-yellow-400 hover:bg-yellow-500 text-neutral-950"}`}>
                    {ocupado && <Loader2 className="w-4 h-4 animate-spin" />}
                    {textoConfirmar}
                </button>
            </div>
        </Dialog>
    );
}
