'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';

interface GlobalLoadingContextValue {
    showLoading: (message?: string) => void;
    hideLoading: () => void;
    withLoading: <T>(fn: () => Promise<T>, message?: string) => Promise<T>;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<{ active: boolean; message: string }>({ active: false, message: '' });

    const showLoading = useCallback((message = 'Procesando...') => {
        setState({ active: true, message });
    }, []);

    const hideLoading = useCallback(() => {
        setState({ active: false, message: '' });
    }, []);

    const withLoading = useCallback(async <T,>(fn: () => Promise<T>, message = 'Procesando...'): Promise<T> => {
        setState({ active: true, message });
        try {
            return await fn();
        } finally {
            setState({ active: false, message: '' });
        }
    }, []);

    return (
        <GlobalLoadingContext.Provider value={{ showLoading, hideLoading, withLoading }}>
            {children}
            {state.active && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-neutral-900/80 backdrop-blur-md">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-yellow-400/20 rounded-full" />
                        <div className="absolute inset-0 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        <Loader2 className="absolute inset-0 m-auto w-10 h-10 text-yellow-400 animate-pulse" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold text-white tracking-tight">{state.message}</h3>
                        <p className="text-neutral-400 text-sm">Por favor, no cierres esta ventana.</p>
                    </div>
                </div>,
                document.body
            )}
        </GlobalLoadingContext.Provider>
    );
}

export function useGlobalLoading() {
    const ctx = useContext(GlobalLoadingContext);
    if (!ctx) throw new Error('useGlobalLoading must be used within GlobalLoadingProvider');
    return ctx;
}
