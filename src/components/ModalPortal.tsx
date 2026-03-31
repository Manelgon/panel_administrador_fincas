'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children directly into document.body via a React Portal.
 * This ensures modal overlays escape any parent stacking context
 * (e.g. Navbar, Sidebar with backdropFilter) and always render on top.
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    return createPortal(children, document.body);
}
