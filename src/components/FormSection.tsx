'use client';

import { ReactNode } from 'react';

interface FormSectionProps {
    title: string;
    children: ReactNode;
}

export default function FormSection({ title, children }: FormSectionProps) {
    return (
        <div>
            <h3 className="text-[10px] font-bold text-neutral-900 uppercase tracking-widest pb-2 mb-4 border-b border-yellow-400">
                {title}
            </h3>
            {children}
        </div>
    );
}
