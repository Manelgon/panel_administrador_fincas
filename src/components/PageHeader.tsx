'use client';

import { ReactNode } from 'react';
import { Plus } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    showForm?: boolean;
    onToggleForm: () => void;
    newButtonLabel: string;
    newButtonShortLabel?: string;
    extraButtons?: ReactNode;
}

export default function PageHeader({
    title,
    showForm,
    onToggleForm,
    newButtonLabel,
    newButtonShortLabel,
    extraButtons,
}: PageHeaderProps) {
    return (
        <div className="flex justify-between items-center gap-3">
            <h1 className="text-xl font-bold text-neutral-900 min-w-0 truncate">{title}</h1>
            <div className="flex items-center gap-2 flex-shrink-0">
                {extraButtons}
                <button
                    onClick={onToggleForm}
                    className="bg-yellow-400 hover:bg-yellow-500 text-neutral-950 px-3 py-2 rounded-xl flex items-center gap-1.5 transition font-semibold text-sm shadow-sm flex-shrink-0"
                >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">
                        {showForm ? 'Cancelar' : newButtonLabel}
                    </span>
                    <span className="sm:hidden">
                        {showForm ? 'Cancelar' : (newButtonShortLabel || 'Nuevo')}
                    </span>
                </button>
            </div>
        </div>
    );
}
