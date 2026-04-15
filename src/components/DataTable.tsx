
'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Settings2, Search, Loader2, InboxIcon, Eye } from 'lucide-react';

export interface RowAction<T> {
    label: string;
    icon?: React.ReactNode;
    onClick: (row: T) => void;
    variant?: 'default' | 'danger' | 'warning' | 'success';
    disabled?: boolean;
    hidden?: boolean;
    separator?: boolean;
}

export interface Column<T> {
    key: string;
    label: string;
    sortable?: boolean;
    render?: (row: T) => React.ReactNode;
    getSearchValue?: (row: T) => string;
    defaultVisible?: boolean;
    hideable?: boolean;
    align?: 'left' | 'center' | 'right';
    width?: string;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyExtractor: (row: T) => string | number;
    storageKey: string;
    loading?: boolean;
    emptyMessage?: string;
    selectable?: boolean;
    selectedKeys?: Set<string | number>;
    onSelectionChange?: (keys: Set<string | number>) => void;
    onRowClick?: (row: T) => void;
    rowActions?: (row: T) => RowAction<T>[];
    extraFilters?: React.ReactNode;
    headerExtras?: React.ReactNode;
    searchTerm?: string;
    onSearchChange?: (term: string) => void;
}

export default function DataTable<T extends Record<string, any>>({
    data,
    columns,
    keyExtractor,
    storageKey,
    loading = false,
    emptyMessage = 'No hay datos disponibles',
    selectable = false,
    selectedKeys = new Set(),
    onSelectionChange,
    onRowClick,
    rowActions,
    extraFilters,
    headerExtras,
    searchTerm: externalSearchTerm,
    onSearchChange: setExternalSearchTerm,
}: DataTableProps<T>) {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
    const [showColumnSelector, setShowColumnSelector] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [internalSearchTerm, setInternalSearchTerm] = useState('');
    
    const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
    const setSearchTerm = (term: string) => {
        if (setExternalSearchTerm) {
            setExternalSearchTerm(term);
        } else {
            setInternalSearchTerm(term);
        }
    };

    const [activeRow, setActiveRow] = useState<{
        row: T;
        key: string | number;
        pos: { top: number; left: number };
    } | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const getUserId = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
            else setUserId('anonymous');
        };
        getUserId();
    }, []);

    const prefKey = userId ? `table-${storageKey}-${userId}` : null;

    useEffect(() => {
        if (isInitialized || !prefKey) return;
        const saved = localStorage.getItem(prefKey);
        if (saved) {
            try {
                const prefs = JSON.parse(saved);
                if (prefs.pageSize) setPageSize(prefs.pageSize);
                if (prefs.visibleColumns && prefs.visibleColumns.length > 0) {
                    setVisibleColumns(new Set(prefs.visibleColumns));
                } else {
                    setVisibleColumns(new Set(columns.filter(c => c.defaultVisible !== false).map(c => c.key)));
                }
            } catch {
                setVisibleColumns(new Set(columns.filter(c => c.defaultVisible !== false).map(c => c.key)));
            }
        } else {
            setVisibleColumns(new Set(columns.filter(c => c.defaultVisible !== false).map(c => c.key)));
        }
        setIsInitialized(true);
    }, [prefKey, isInitialized]);

    useEffect(() => {
        if (!isInitialized || !prefKey) return;
        localStorage.setItem(prefKey, JSON.stringify({ pageSize, visibleColumns: Array.from(visibleColumns) }));
    }, [pageSize, visibleColumns, prefKey, isInitialized]);

    // Close dropdown on outside click, scroll, or Escape
    useEffect(() => {
        if (!activeRow) return;
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setActiveRow(null);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setActiveRow(null);
        };
        const handleScroll = () => setActiveRow(null);
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [activeRow]);

    const handleSort = (columnKey: string) => {
        if (sortColumn === columnKey) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(columnKey);
            setSortDirection('asc');
        }
        setCurrentPage(1);
    };

    const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>, row: T) => {
        if (!rowActions && !onRowClick) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const DROPDOWN_WIDTH = 192; // w-48

        // Estimate dropdown height: ~34px per item + 8px padding
        const actions = rowActions ? rowActions(row) : [];
        const visibleActions = actions.filter((a: RowAction<T>) => !a.hidden);
        const itemCount = visibleActions.length + (onRowClick ? 1 : 0);
        const DROPDOWN_HEIGHT = itemCount * 34 + 8;

        // Horizontal positioning
        let left = e.clientX;
        if (left + DROPDOWN_WIDTH > window.innerWidth - 8) left = window.innerWidth - DROPDOWN_WIDTH - 8;
        if (left < 8) left = 8;

        // Vertical positioning: open upward if not enough space below
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        let top: number;
        if (spaceBelow >= DROPDOWN_HEIGHT + 8) {
            // Enough space below
            top = rect.bottom + 4;
        } else if (spaceAbove >= DROPDOWN_HEIGHT + 8) {
            // Not enough below, open upward
            top = rect.top - DROPDOWN_HEIGHT - 4;
        } else {
            // Neither fits perfectly — align to whichever side has more space
            if (spaceBelow >= spaceAbove) {
                top = rect.bottom + 4;
            } else {
                top = Math.max(8, rect.top - DROPDOWN_HEIGHT - 4);
            }
        }

        const key = keyExtractor(row);
        setActiveRow({ row, key, pos: { top, left } });
    };

    const searchFilteredData = data.filter((row) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        const colsToSearch = visibleColumns.size > 0 ? columns.filter(c => visibleColumns.has(c.key) || c.hideable === false) : columns;
        return colsToSearch.some((col) => {
            let valueToSearch = '';
            if (col.getSearchValue) {
                valueToSearch = col.getSearchValue(row);
            } else {
                const val = row[col.key];
                if (val == null) return false;
                valueToSearch = typeof val === 'object' ? JSON.stringify(val) : String(val);
            }
            return valueToSearch.toLowerCase().includes(searchLower);
        });
    });

    const sortedData = [...searchFilteredData].sort((a, b) => {
        if (!sortColumn) return 0;
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        if (aVal === bVal) return 0;
        const comparison = aVal > bVal ? 1 : -1;
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    const totalPages = Math.ceil(sortedData.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

    const toggleColumn = (columnKey: string) => {
        const newVisible = new Set(visibleColumns);
        if (newVisible.has(columnKey)) newVisible.delete(columnKey);
        else newVisible.add(columnKey);
        setVisibleColumns(newVisible);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!onSelectionChange) return;
        if (e.target.checked) {
            onSelectionChange(new Set(searchFilteredData.map(keyExtractor)) as Set<string | number>);
        } else {
            onSelectionChange(new Set());
        }
    };

    const handleSelectRow = (key: string | number) => {
        if (!onSelectionChange) return;
        const newSet = new Set(selectedKeys);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        onSelectionChange(newSet);
    };

    const isAllSelected = searchFilteredData.length > 0 && selectedKeys.size === searchFilteredData.length;
    const isIndeterminate = selectedKeys.size > 0 && selectedKeys.size < searchFilteredData.length;
    const visibleCols = columns.filter(c => visibleColumns.has(c.key) || c.hideable === false);

    // Dropdown portal
    const dropdown = activeRow && typeof document !== 'undefined' ? createPortal(
        <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: activeRow.pos.top, left: activeRow.pos.left, zIndex: 9999 }}
            className="w-48 bg-white rounded-xl border border-neutral-200 shadow-xl overflow-hidden py-1"
        >
            {onRowClick && (
                <button
                    onClick={() => { onRowClick(activeRow.row); setActiveRow(null); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                    <Eye className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <span>Ver detalle</span>
                </button>
            )}
            {rowActions && (() => {
                const actions = rowActions(activeRow.row).filter(a => !a.hidden);
                return actions.map((action, i) => {
                    const showSeparator = action.separator || (i === 0 && !!onRowClick);
                    return (
                        <button
                            key={i}
                            disabled={action.disabled}
                            onClick={() => {
                                if (!action.disabled) {
                                    action.onClick(activeRow.row);
                                    setActiveRow(null);
                                }
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                                ${showSeparator ? 'border-t border-neutral-100 mt-0.5' : ''}
                                ${action.variant === 'danger' ? 'text-red-600 hover:bg-red-50' :
                                  action.variant === 'warning' ? 'text-amber-600 hover:bg-amber-50' :
                                  action.variant === 'success' ? 'text-green-600 hover:bg-green-50' :
                                  'text-neutral-700 hover:bg-neutral-50'}`}
                        >
                            {action.icon && (
                                <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                                    {action.icon}
                                </span>
                            )}
                            <span>{action.label}</span>
                        </button>
                    );
                });
            })()}
        </div>,
        document.body
    ) : null;

    return (
        <div className="space-y-3">
            {/* Controls */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                {/* Fila 1 (móvil) / todo en una fila (desktop): buscador + count */}
                <div className="flex flex-1 items-center gap-2">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg bg-white text-neutral-900 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-shadow"
                        />
                    </div>
                    {/* Selectores: en desktop junto al buscador, en móvil se mueven abajo */}
                    {extraFilters && <div className="hidden sm:flex items-center gap-2">{extraFilters}</div>}
                    {/* Record count */}
                    {!loading && (
                        <span className="text-xs text-neutral-400 whitespace-nowrap hidden sm:inline">
                            {searchFilteredData.length !== data.length
                                ? `${searchFilteredData.length} de ${data.length} registros`
                                : `${data.length} registros`
                            }
                            {selectedKeys.size > 0 && ` · ${selectedKeys.size} seleccionados`}
                        </span>
                    )}
                </div>
                {/* Fila 2 solo en móvil: selectores debajo del buscador */}
                {extraFilters && (
                    <div className="flex sm:hidden items-center gap-2 [&>*]:flex-1 [&>*]:min-w-0">
                        {extraFilters}
                    </div>
                )}

                {/* Column selector and extras */}
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                    {headerExtras}
                    <div className="relative">
                        <button
                        onClick={() => setShowColumnSelector(!showColumnSelector)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-neutral-200 rounded-lg bg-white hover:bg-neutral-50 transition text-sm text-neutral-600 font-medium"
                    >
                        <Settings2 className="w-3.5 h-3.5" />
                        Columnas
                    </button>
                    {showColumnSelector && (
                        <div className="absolute right-0 mt-1.5 w-52 bg-white border border-neutral-200 rounded-xl shadow-lg z-20 p-2">
                            <p className="text-[10px] font-bold text-neutral-400 mb-1.5 px-2 uppercase tracking-wider">Mostrar columnas</p>
                            {columns.filter(col => col.hideable !== false).map((col) => (
                                <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-neutral-50 rounded-lg cursor-pointer text-sm">
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns.has(col.key)}
                                        onChange={() => toggleColumn(col.key)}
                                        className="rounded border-neutral-300 text-yellow-500 focus:ring-yellow-400"
                                    />
                                    <span className="text-xs font-medium text-neutral-700">{col.label}</span>
                                </label>
                            ))}
                        </div>
                    )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-neutral-50 border-b border-neutral-200">
                                {selectable && (
                                    <th className="w-10 px-4 py-2 text-center">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                                            onChange={handleSelectAll}
                                            className="rounded border-neutral-300 text-yellow-500 focus:ring-yellow-400"
                                        />
                                    </th>
                                )}
                                {visibleCols.map((col) => (
                                    <th
                                        key={col.key}
                                        style={col.width ? { width: col.width } : {}}
                                        className={`px-4 py-2.5 text-xs font-bold text-neutral-500 uppercase tracking-wide select-none
                                            ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                                            ${col.sortable !== false ? 'cursor-pointer hover:bg-neutral-100 transition-colors' : ''}`}
                                        onClick={() => col.sortable !== false && handleSort(col.key)}
                                    >
                                        <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                                            <span>{col.label}</span>
                                            {col.sortable !== false && (
                                                <span className="text-neutral-300">
                                                    {sortColumn === col.key
                                                        ? sortDirection === 'asc'
                                                            ? <ChevronUp className="w-3.5 h-3.5 text-yellow-500" />
                                                            : <ChevronDown className="w-3.5 h-3.5 text-yellow-500" />
                                                        : <ChevronUp className="w-3.5 h-3.5 opacity-30" />
                                                    }
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-neutral-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={visibleCols.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3 text-neutral-400">
                                            <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
                                            <span className="text-sm font-medium">Cargando datos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={visibleCols.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3 text-neutral-400">
                                            <InboxIcon className="w-8 h-8 opacity-40" />
                                            <span className="text-sm font-medium">{emptyMessage}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((row) => {
                                    const key = keyExtractor(row);
                                    const isSelected = selectedKeys.has(key as any);
                                    const isActive = activeRow?.key === key;
                                    return (
                                        <tr
                                            key={key}
                                            className={`transition-colors
                                                ${isActive ? 'bg-yellow-50' : isSelected ? 'bg-yellow-50/60' : 'hover:bg-neutral-50/80'}
                                                ${(rowActions || onRowClick) ? 'cursor-pointer' : ''}`}
                                            onClick={(e) => handleRowClick(e, row)}
                                        >
                                            {selectable && (
                                                <td className="px-4 py-2 text-center w-10" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectRow(key as any)}
                                                        className="rounded border-neutral-300 text-yellow-500 focus:ring-yellow-400"
                                                    />
                                                </td>
                                            )}
                                            {visibleCols.map((col) => (
                                                <td
                                                    key={col.key}
                                                    style={col.width ? { width: col.width } : {}}
                                                    className={`px-4 py-2 text-neutral-700
                                                        ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                                                >
                                                    {col.render ? col.render(row) : row[col.key]}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {!loading && paginatedData.length > 0 && (
                <div className="flex items-center justify-between text-sm flex-wrap gap-3 px-1">
                    <div className="flex items-center gap-2">
                        <span className="text-neutral-500 text-xs">Filas:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                            className="px-2 py-1.5 border border-neutral-200 rounded-lg bg-white text-neutral-700 text-xs focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>

                    <span className="text-xs text-neutral-400">
                        {startIndex + 1}–{Math.min(startIndex + pageSize, sortedData.length)} de {sortedData.length}
                    </span>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                            <ChevronLeft className="w-4 h-4 text-neutral-600" />
                        </button>
                        <span className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-50 rounded-lg border border-neutral-200">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                            <ChevronRight className="w-4 h-4 text-neutral-600" />
                        </button>
                    </div>
                </div>
            )}

            {dropdown}
        </div>
    );
}
