'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Dashboard error:', error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <AlertTriangle className="w-12 h-12 text-amber-500" />
            <h2 className="text-lg font-semibold text-neutral-800">
                Algo ha fallado
            </h2>
            <p className="text-sm text-neutral-500 max-w-md text-center">
                Ha ocurrido un error inesperado. Puedes intentar recargar la sección.
            </p>
            <button
                onClick={reset}
                className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors"
            >
                Reintentar
            </button>
        </div>
    );
}
