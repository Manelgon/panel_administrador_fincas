'use client';

import { AlertCircle } from 'lucide-react';

interface FormFieldProps {
    label: string;
    required?: boolean;
    error?: string;
    className?: string;
    children: React.ReactNode;
}

export default function FormField({ label, required, error, className, children }: FormFieldProps) {
    return (
        <div className={className}>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
            {error && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {error}
                </p>
            )}
        </div>
    );
}
