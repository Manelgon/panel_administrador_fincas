"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, X } from "lucide-react";

interface Option {
    value: string | number;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string | number;
    onChange: (value: string | number) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    label?: string;
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Seleccionar...",
    className = "",
    disabled = false,
    label,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [activeIdx, setActiveIdx] = useState(-1);
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
    const wrapperRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find((opt) => String(opt.value) === String(value));

    // Position dropdown using wrapper rect
    const updatePosition = () => {
        if (!wrapperRef.current) return;
        const rect = wrapperRef.current.getBoundingClientRect();
        setDropdownStyle({
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 99999,
        });
    };

    useEffect(() => {
        if (isOpen) updatePosition();
    }, [isOpen]);

    // Reposition on scroll or resize
    useEffect(() => {
        if (!isOpen) return;
        const handleScroll = () => updatePosition();
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", handleScroll);
        return () => {
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleScroll);
        };
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            if (wrapperRef.current && !wrapperRef.current.contains(target)) {
                setIsOpen(false);
                // search sync is handled by the useEffect(..., [isOpen, selectedOption])
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Sync search with selected label when not open
    useEffect(() => {
        if (!isOpen) {
            setSearch(selectedOption?.label || "");
        }
    }, [selectedOption, isOpen, options]);

    // Filter and sort options based on search
    const filteredOptions = isOpen
        ? [...options].sort((a, b) => {
            if (!search) return 0;
            
            const s = search.toLowerCase();
            const aLabel = a.label.toLowerCase();
            const bLabel = b.label.toLowerCase();

            // Exact matches first
            const aExact = aLabel === s;
            const bExact = bLabel === s;
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;

            // Starts with matches second
            const aStarts = aLabel.startsWith(s);
            const bStarts = bLabel.startsWith(s);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;

            // Includes matches third
            const aIncludes = aLabel.includes(s);
            const bIncludes = bLabel.includes(s);
            if (aIncludes && !bIncludes) return -1;
            if (!aIncludes && bIncludes) return 1;

            return 0;
        })
        : options;

    // Reset active index when search changes
    useEffect(() => {
        setActiveIdx(-1);
    }, [search]);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;

        if (!isOpen && e.key !== "Tab" && e.key !== "Escape") {
            setIsOpen(true);
            if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSearch(""); // clear down text on open via keys
            }
            return;
        }

        switch (e.key) {
            case "Escape":
                e.preventDefault();
                setIsOpen(false);
                if (inputRef.current) inputRef.current.blur();
                break;
            case "ArrowDown":
                e.preventDefault();
                setActiveIdx((prev) => Math.min(prev + 1, filteredOptions.length - 1));
                break;
            case "ArrowUp":
                e.preventDefault();
                setActiveIdx((prev) => Math.max(prev - 1, 0));
                break;
            case "Enter":
                e.preventDefault();
                if (activeIdx >= 0 && activeIdx < filteredOptions.length) {
                    onChange(filteredOptions[activeIdx].value);
                    setIsOpen(false);
                } else if (filteredOptions.length === 1) {
                    // Auto-select the only option on enter
                     onChange(filteredOptions[0].value);
                     setIsOpen(false);
                }
                break;
            case "Tab":
                setIsOpen(false);
                break;
        }
    };

    // Scroll active option into view
    useEffect(() => {
        if (activeIdx >= 0 && isOpen && listRef.current) {
            const active = listRef.current.querySelector(`[data-idx="${activeIdx}"]`);
            active?.scrollIntoView({ block: "nearest" });
        }
    }, [activeIdx, isOpen]);

    const selectId = `searchable-select-${label?.replace(/\s/g, '-') || 'field'}`;

    const handleSelectOption = (optValue: string | number) => {
        onChange(optValue);
        setIsOpen(false);
    };

    const dropdown = isOpen ? (
        <div
            style={dropdownStyle}
            className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col"
        >
            <div
                ref={listRef}
                className="overflow-y-auto flex-1 py-1"
                role="listbox"
                id={`${selectId}-listbox`}
                aria-label={label || placeholder}
            >
                {filteredOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500 text-center" role="option" aria-disabled="true" aria-selected={false}>
                        No se encontraron resultados
                    </div>
                ) : (
                    filteredOptions.map((opt, idx) => (
                        <div
                            key={opt.value}
                            data-idx={idx}
                            className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                                String(opt.value) === String(value) ? "bg-yellow-100 text-yellow-900 font-medium" : "text-gray-700"
                            } ${idx === activeIdx ? "bg-yellow-50 ring-1 ring-inset ring-yellow-300" : "hover:bg-yellow-100"}`}
                            role="option"
                            aria-selected={String(opt.value) === String(value)}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent input blur
                                handleSelectOption(opt.value);
                            }}
                        >
                            <span>{opt.label}</span>
                            {String(opt.value) === String(value) && <Check className="w-4 h-4 text-yellow-600" aria-hidden="true" />}
                        </div>
                    ))
                )}
            </div>
        </div>
    ) : null;

    return (
        <div
            className={`relative ${className} ${disabled ? "opacity-60" : ""}`}
            ref={wrapperRef}
        >
            {label && (
                <label id={`${selectId}-label`} className="sr-only" htmlFor={selectId}>{label}</label>
            )}
            <div
                className={`w-full rounded-lg border border-neutral-200 bg-white flex items-center justify-between focus-within:ring-2 focus-within:ring-yellow-400 focus-within:border-yellow-400 overflow-hidden ${disabled ? "bg-slate-50 cursor-not-allowed pointer-events-none" : "cursor-text"}`}
                onClick={() => {
                    if (disabled) return;
                    inputRef.current?.focus();
                }}
            >
                <input
                    ref={inputRef}
                    id={selectId}
                    type="text"
                    disabled={disabled}
                    className={`w-full px-3 py-2.5 text-sm bg-transparent outline-none truncate ${
                        !selectedOption && !search && !isOpen ? "text-gray-500" : "text-neutral-900"
                    }`}
                    placeholder={placeholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => {
                        setIsOpen(true);
                        if (selectedOption) {
                            setSearch(selectedOption.label);
                            // Use setTimeout to ensure the input value is set before selecting
                            setTimeout(() => inputRef.current?.select(), 0);
                        } else {
                            setSearch("");
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-controls={isOpen ? `${selectId}-listbox` : undefined}
                    aria-labelledby={label ? `${selectId}-label` : undefined}
                    autoComplete="off"
                />
                
                <div className="flex items-center gap-1 pr-2 shrink-0">
                    {selectedOption && !disabled && (
                        <button
                            type="button"
                            className="p-1 hover:bg-gray-100 rounded-full"
                            aria-label="Limpiar selección"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onChange("");
                                setSearch("");
                                if (inputRef.current) inputRef.current.focus();
                                setIsOpen(true);
                            }}
                        >
                            <X className="w-3 h-3 text-gray-400" aria-hidden="true" />
                        </button>
                    )}
                    <button
                        type="button"
                        className="p-1 hover:bg-gray-100 rounded-full focus:outline-none"
                        tabIndex={-1}
                        onMouseDown={(e) => {
                            e.preventDefault(); // Keep focus on input if already there
                            if (disabled) return;
                            if (isOpen) {
                                setIsOpen(false);
                                if (inputRef.current) inputRef.current.blur();
                            } else {
                                if (inputRef.current) inputRef.current.focus();
                                setIsOpen(true);
                            }
                        }}
                    >
                         <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {typeof document !== "undefined" && createPortal(dropdown, document.body)}
        </div>
    );
}
