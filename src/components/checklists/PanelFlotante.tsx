'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Punto o rectángulo junto al que se abre el panel (coordenadas de pantalla) */
export interface Ancla {
    top: number;
    bottom: number;
    left: number;
}

interface PanelProps {
    ancla: Ancla;
    ancho: number;
    onCerrar: () => void;
    children: ReactNode;
}

const MARGEN = 8;

// Panel flotante en un portal (la tarjeta de la tarea recorta lo que se sale).
// Se mide a sí mismo para abrirse justo debajo del ancla o, si no cabe, justo encima.
// Se cierra al pulsar fuera, con Escape, al hacer scroll en la página o al cambiar el tamaño.
export function PanelFlotante({ ancla, ancho, onCerrar, children }: PanelProps) {
    const panel = useRef<HTMLDivElement>(null);

    // Colocación según el alto real; se repite si el contenido cambia (p. ej. al abrir una lista)
    useLayoutEffect(() => {
        const el = panel.current;
        if (!el) return;
        const colocar = () => {
            const alto = el.offsetHeight;
            const cabeAbajo = window.innerHeight - ancla.bottom - MARGEN >= alto;
            const top = cabeAbajo ? ancla.bottom + 4 : Math.max(MARGEN, ancla.top - alto - 4);
            el.style.top = `${top}px`;
            el.style.left = `${Math.max(MARGEN, Math.min(ancla.left, window.innerWidth - ancho - MARGEN))}px`;
            el.style.visibility = 'visible';
        };
        colocar();
        const observador = new ResizeObserver(colocar);
        observador.observe(el);
        return () => observador.disconnect();
    }, [ancla, ancho]);

    useEffect(() => {
        const cerrarFuera = (e: MouseEvent) => { if (!panel.current?.contains(e.target as Node)) onCerrar(); };
        const cerrarEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
        const cerrarScroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) onCerrar(); };
        document.addEventListener('mousedown', cerrarFuera);
        document.addEventListener('keydown', cerrarEsc);
        window.addEventListener('scroll', cerrarScroll, true);
        window.addEventListener('resize', onCerrar);
        return () => {
            document.removeEventListener('mousedown', cerrarFuera);
            document.removeEventListener('keydown', cerrarEsc);
            window.removeEventListener('scroll', cerrarScroll, true);
            window.removeEventListener('resize', onCerrar);
        };
    }, [onCerrar]);

    return createPortal(
        <div
            ref={panel}
            style={{ width: ancho, visibility: 'hidden', top: 0, left: 0 }}
            className="fixed z-[9999] bg-white rounded-xl border border-neutral-200 shadow-xl py-1 max-h-80 overflow-y-auto [scrollbar-width:thin]"
            onClick={e => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body,
    );
}
