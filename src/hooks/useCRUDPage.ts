'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { logActivity, ActivityAction, EntityType } from '@/lib/logActivity';
import { useGlobalLoading } from '@/lib/globalLoading';

interface UseCRUDPageOptions<T, F> {
    entityType: EntityType;
    entityLabel: string; // "proveedor", "comunidad" — para mensajes
    tableName: string;
    defaultFormData: F;
    orderBy?: { column: string; ascending?: boolean };
    selectQuery?: string;
    nameField?: keyof T; // campo que contiene el "nombre" de la entidad
    onAfterSave?: () => void; // callback tras crear/actualizar (ej: dispatchEvent)
    onAfterDelete?: () => void;
}

export function useCRUDPage<T extends { id: number; activo?: boolean }, F extends Record<string, unknown>>(
    options: UseCRUDPageOptions<T, F>
) {
    const {
        entityType,
        entityLabel,
        tableName,
        defaultFormData,
        orderBy = { column: 'id', ascending: true },
        selectQuery = '*',
        nameField = 'nombre' as keyof T,
        onAfterSave,
        onAfterDelete,
    } = options;

    const { withLoading } = useGlobalLoading();

    // Data
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    // Form
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState<F>(defaultFormData);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Delete
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Detail
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<T | null>(null);

    // Filter estado
    const [filterEstado, setFilterEstado] = useState<'all' | 'activo' | 'inactivo'>('activo');

    // Portal
    const [portalReady, setPortalReady] = useState(false);
    useEffect(() => setPortalReady(true), []);

    // Body scroll lock
    useEffect(() => {
        if (showForm || showDetailModal || showDeleteModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [showForm, showDetailModal, showDeleteModal]);

    // Fetch
    const fetchData = useCallback(async () => {
        try {
            const { data: rows, error } = await supabase
                .from(tableName)
                .select(selectQuery)
                .order(orderBy.column, { ascending: orderBy.ascending ?? true });
            if (error) throw error;
            setData((rows as unknown as T[]) || []);
        } catch {
            toast.error(`Error cargando ${entityLabel}s`);
        } finally {
            setLoading(false);
        }
    }, [tableName, selectQuery, orderBy.column, orderBy.ascending, entityLabel]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Filtered data
    const filteredData = data.filter(item => {
        if (filterEstado === 'all') return true;
        if (filterEstado === 'activo') return item.activo === true;
        if (filterEstado === 'inactivo') return item.activo === false;
        return true;
    });

    // Reset form
    const resetForm = useCallback(() => {
        setFormData(defaultFormData);
        setFormErrors({});
        setEditingId(null);
    }, [defaultFormData]);

    // Open form for new
    const openNewForm = useCallback(() => {
        resetForm();
        setShowForm(true);
    }, [resetForm]);

    // Open form for edit
    const handleEdit = useCallback((item: T) => {
        setEditingId(item.id);
        const mapped: Record<string, unknown> = {};
        for (const key of Object.keys(defaultFormData)) {
            mapped[key] = (item as Record<string, unknown>)[key] ?? '';
        }
        setFormData(mapped as F);
        setShowForm(true);
    }, [defaultFormData]);

    // Close form
    const closeForm = useCallback(() => {
        setShowForm(false);
        resetForm();
    }, [resetForm]);

    // Submit (create or update)
    const handleSubmit = useCallback(async (
        dataToSubmit: Record<string, unknown>,
        validate?: () => Record<string, string>
    ) => {
        if (validate) {
            const errors = validate();
            if (Object.keys(errors).length > 0) {
                setFormErrors(errors);
                return false;
            }
        }
        setFormErrors({});

        const label = editingId
            ? `Actualizando ${entityLabel}...`
            : `Creando ${entityLabel}...`;

        let success = false;
        await withLoading(async () => {
            try {
                if (editingId) {
                    const { error } = await supabase
                        .from(tableName)
                        .update(dataToSubmit)
                        .eq('id', editingId);
                    if (error) throw error;
                    toast.success(`${capitalize(entityLabel)} actualizado correctamente`);
                    await logActivity({
                        action: 'update',
                        entityType,
                        entityId: editingId,
                        entityName: String(dataToSubmit[nameField as string] || ''),
                    });
                } else {
                    const { error } = await supabase
                        .from(tableName)
                        .insert([{ ...dataToSubmit, activo: true }])
                        .select();
                    if (error) throw error;
                    toast.success(`${capitalize(entityLabel)} creado correctamente`);
                    await logActivity({
                        action: 'create',
                        entityType,
                        entityName: String(dataToSubmit[nameField as string] || ''),
                    });
                }
                closeForm();
                fetchData();
                onAfterSave?.();
                success = true;
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Error desconocido';
                toast.error(`Error al ${editingId ? 'actualizar' : 'crear'}: ${msg}`);
            }
        }, label);

        return success;
    }, [editingId, entityLabel, entityType, tableName, nameField, withLoading, closeForm, fetchData, onAfterSave]);

    // Delete
    const handleDeleteClick = useCallback((id: number) => {
        setDeleteId(id);
        setShowDeleteModal(true);
    }, []);

    const handleConfirmDelete = useCallback(async ({ email, password }: { email: string; password: string }) => {
        if (deleteId === null || !email || !password) return;

        await withLoading(async () => {
            setIsDeleting(true);
            try {
                const res = await fetch('/api/admin/universal-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: deleteId, email, password, type: entityType }),
                });
                const resData = await res.json();
                if (!res.ok) throw new Error(resData.error || 'Error al eliminar');

                toast.success(`${capitalize(entityLabel)} eliminado correctamente`);
                const deleted = data.find(item => item.id === deleteId);
                setData(prev => prev.filter(item => item.id !== deleteId));
                await logActivity({
                    action: 'delete',
                    entityType,
                    entityId: deleteId,
                    entityName: deleted ? String((deleted as Record<string, unknown>)[nameField as string] || '') : undefined,
                    details: { deleted_by_admin: email },
                });
                setShowDeleteModal(false);
                setDeleteId(null);
                onAfterDelete?.();
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Error al eliminar';
                toast.error(msg);
            } finally {
                setIsDeleting(false);
            }
        }, `Eliminando ${entityLabel}...`);
    }, [deleteId, data, entityType, entityLabel, nameField, withLoading, onAfterDelete]);

    // Toggle active
    const toggleActive = useCallback(async (id: number, currentStatus: boolean) => {
        await withLoading(async () => {
            try {
                const { error } = await supabase
                    .from(tableName)
                    .update({ activo: !currentStatus })
                    .eq('id', id);
                if (error) throw error;

                toast.success(currentStatus ? `${capitalize(entityLabel)} desactivado` : `${capitalize(entityLabel)} activado`);
                setData(prev => prev.map(item =>
                    item.id === id ? { ...item, activo: !currentStatus } : item
                ));

                const item = data.find(i => i.id === id);
                await logActivity({
                    action: 'toggle_active',
                    entityType,
                    entityId: id,
                    entityName: item ? String((item as Record<string, unknown>)[nameField as string] || '') : undefined,
                    details: { activo: !currentStatus },
                });
            } catch {
                toast.error('Error al actualizar estado');
            }
        }, currentStatus ? `Desactivando ${entityLabel}...` : `Activando ${entityLabel}...`);
    }, [tableName, entityType, entityLabel, nameField, data, withLoading]);

    // Open detail
    const openDetail = useCallback((item: T) => {
        setSelectedDetail(item);
        setShowDetailModal(true);
    }, []);

    const closeDetail = useCallback(() => {
        setShowDetailModal(false);
        setSelectedDetail(null);
    }, []);

    return {
        // Data
        data,
        setData,
        filteredData,
        loading,
        fetchData,

        // Form
        showForm,
        setShowForm,
        editingId,
        formData,
        setFormData,
        formErrors,
        setFormErrors,
        openNewForm,
        handleEdit,
        closeForm,
        handleSubmit,
        resetForm,

        // Delete
        showDeleteModal,
        setShowDeleteModal,
        deleteId,
        isDeleting,
        handleDeleteClick,
        handleConfirmDelete,

        // Detail
        showDetailModal,
        selectedDetail,
        setSelectedDetail,
        openDetail,
        closeDetail,

        // Filters
        filterEstado,
        setFilterEstado,

        // Portal
        portalReady,

        // Toggle
        toggleActive,
    };
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
