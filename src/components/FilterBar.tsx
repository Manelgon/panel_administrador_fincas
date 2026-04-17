'use client';

interface FilterOption {
    value: string;
    label: string;
    activeClass?: string;
}

interface FilterBarProps {
    value: string;
    onChange: (value: string) => void;
    options?: FilterOption[];
}

const defaultOptions: FilterOption[] = [
    { value: 'activo', label: 'Activos', activeClass: 'bg-yellow-400 text-neutral-950' },
    { value: 'inactivo', label: 'Inactivos', activeClass: 'bg-neutral-900 text-white' },
    { value: 'all', label: 'Todos', activeClass: 'bg-neutral-900 text-white' },
];

export default function FilterBar({
    value,
    onChange,
    options = defaultOptions,
}: FilterBarProps) {
    return (
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                        value === opt.value
                            ? (opt.activeClass || 'bg-yellow-400 text-neutral-950')
                            : 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
