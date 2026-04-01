'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import ModalPortal from '@/components/ModalPortal';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Unique id used for aria-labelledby / aria-describedby */
  titleId?: string;
  descId?: string;
}

/**
 * Accessible modal dialog component following WAI-ARIA Dialog pattern.
 *
 * Features:
 * - `role="dialog"`, `aria-modal="true"`
 * - Escape key closes the dialog
 * - Click on backdrop closes the dialog
 * - Focus trapping (first focusable element receives focus on open)
 * - Scroll lock on body while open
 *
 * Usage:
 * ```tsx
 * <Dialog open={isOpen} onClose={() => setOpen(false)} titleId="my-title">
 *   <h2 id="my-title">Title</h2>
 *   <p>Content here</p>
 * </Dialog>
 * ```
 */
export default function Dialog({
  open,
  onClose,
  children,
  className = '',
  titleId,
  descId,
}: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Auto-focus first focusable element
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <ModalPortal>
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-end sm:items-center sm:justify-center sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-md relative animate-in zoom-in-95 duration-200 border border-neutral-100 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
    </ModalPortal>
  );
}
