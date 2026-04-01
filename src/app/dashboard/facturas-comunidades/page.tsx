'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Folder, FileText, ChevronRight, Home, RefreshCw, ExternalLink, Download, Search, Plus, Upload, MoveHorizontal } from 'lucide-react';
import DataTable, { Column } from '@/components/DataTable';
import { supabase } from '@/lib/supabaseClient';
import { useRef } from 'react';

interface BucketItem {
    name: string;
    id: string | null;
    updated_at: string | null;
    created_at: string | null;
    last_accessed_at: string | null;
    metadata: any;
    comunidad?: string;
    file_count?: number;
}

export default function FacturasComunidadesPage() {
    const [path, setPath] = useState<string[]>([]);
    const [items, setItems] = useState<BucketItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [comunidades, setComunidades] = useState<{ codigo: string; nombre_cdad: string }[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Move state
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [movingFile, setMovingFile] = useState<BucketItem | null>(null);
    const [movePath, setMovePath] = useState<string[]>([]);
    const [moveFolderItems, setMoveFolderItems] = useState<BucketItem[]>([]);
    const [moveLoading, setMoveLoading] = useState(false);
    const [isMoving, setIsMoving] = useState(false);

    const currentPathString = path.join('/');

    const tableData = useMemo(() => {
        return items.map(item => {
            const comunidadFolder = path.length === 0 ? item.name : path[0];
            const codeMatch = comunidadFolder.match(/^(\d+)/);
            const code = codeMatch ? codeMatch[1] : '';
            const comunidadObj = comunidades.find(c => c.codigo === code);
            const comunidadName = comunidadObj ? comunidadObj.nombre_cdad : comunidadFolder;

            return {
                ...item,
                comunidad: comunidadName
            };
        });
    }, [items, comunidades, path]);

    useEffect(() => {
        fetchComunidades();
    }, []);

    useEffect(() => {
        fetchItems();
    }, [currentPathString]);

    const fetchComunidades = async () => {
        try {
            const { data, error } = await supabase
                .from('comunidades')
                .select('codigo, nombre_cdad');

            if (error) throw error;
            setComunidades(data || []);
        } catch (error: any) {
            console.error('Error loading comunidades:', error);
        }
    };

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/facturas-comunidades/list?path=${encodeURIComponent(currentPathString)}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al listar archivos');

            const filteredItems = (data.items || []).filter((item: BucketItem) =>
                item.name !== '.emptyFolderPlaceholder' && item.name !== '.keep'
            );
            setItems(filteredItems);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFolderClick = (folderName: string) => {
        setPath([...path, folderName]);
    };

    const handleFileClick = async (fileName: string) => {
        const filePath = currentPathString ? `${currentPathString}/${fileName}` : fileName;
        // Use the proxy view route instead of signed URL for better browser compatibility
        window.open(`/api/facturas-comunidades/view?path=${encodeURIComponent(filePath)}`, '_blank');
    };

    const handleDownloadClick = async (fileName: string) => {
        const filePath = currentPathString ? `${currentPathString}/${fileName}` : fileName;
        try {
            const res = await fetch(`/api/facturas-comunidades/signed-url?path=${encodeURIComponent(filePath)}&download=true`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al obtener URL de descarga');

            const link = document.createElement('a');
            link.href = data.url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleCreateBudget = () => {
        if (path.length === 0) {
            toast.error('Debes estar dentro de una carpeta de comunidad');
            return;
        }
        setNewFolderName('budget');
        setShowCreateModal(true);
    };

    const handleCreateConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) {
            toast.error('El nombre de la carpeta no puede estar vacío');
            return;
        }

        setIsCreating(true);
        const loadingToast = toast.loading(`Creando carpeta ${newFolderName}...`);
        try {
            const res = await fetch('/api/facturas-comunidades/create-folder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: currentPathString, folderName: newFolderName.trim() }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al crear la carpeta');

            toast.success('Carpeta creada correctamente', { id: loadingToast });
            setShowCreateModal(false);
            setNewFolderName('');
            fetchItems();
        } catch (error: any) {
            toast.error(error.message, { id: loadingToast });
        } finally {
            setIsCreating(false);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const loadingToast = toast.loading(`Subiendo ${file.name}...`);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', currentPathString);

            const res = await fetch('/api/facturas-comunidades/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al subir el archivo');

            toast.success('Archivo subido correctamente', { id: loadingToast });
            fetchItems();
        } catch (error: any) {
            toast.error(error.message, { id: loadingToast });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Move logic
    const handleMoveClick = (item: BucketItem) => {
        setMovingFile(item);
        setMovePath([]);
        setShowMoveModal(true);
        fetchMoveFolders([]);
    };

    const fetchMoveFolders = async (targetPath: string[]) => {
        setMoveLoading(true);
        try {
            const pathStr = targetPath.join('/');
            const res = await fetch(`/api/facturas-comunidades/list?path=${encodeURIComponent(pathStr)}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al listar carpetas');

            const folders = (data.items || []).filter((item: BucketItem) => !item.metadata);
            setMoveFolderItems(folders);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setMoveLoading(false);
        }
    };

    const handleMoveFolderClick = (folderName: string) => {
        const newPath = [...movePath, folderName];
        setMovePath(newPath);
        fetchMoveFolders(newPath);
    };

    const handleMoveConfirm = async () => {
        if (!movingFile) return;

        setIsMoving(true);
        const loadingToast = toast.loading('Moviendo archivo...');
        try {
            const fromPath = currentPathString ? `${currentPathString}/${movingFile.name}` : movingFile.name;
            const toPathStr = movePath.join('/');
            const toPath = toPathStr ? `${toPathStr}/${movingFile.name}` : movingFile.name;

            const res = await fetch('/api/facturas-comunidades/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromPath, toPath }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al mover el archivo');

            toast.success('Archivo movido correctamente', { id: loadingToast });
            setShowMoveModal(false);
            setMovingFile(null);
            fetchItems();
        } catch (error: any) {
            toast.error(error.message, { id: loadingToast });
        } finally {
            setIsMoving(false);
        }
    };

    const navigateTo = (index: number) => {
        setPath(path.slice(0, index + 1));
    };

    const goHome = () => {
        setPath([]);
    };

    const columns: Column<BucketItem>[] = [
        {
            key: 'icon',
            label: '',
            width: '50px',
            sortable: false,
            render: (row) => {
                const isFolder = !row.metadata;
                return (
                    <div className={`p-2 rounded-lg ${isFolder ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'}`}>
                        {isFolder ? <Folder className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>
                );
            },
        },
        {
            key: 'name',
            label: 'Nombre',
            sortable: true,
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-neutral-900">
                        {row.name}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono hidden sm:block">
                        {row.id}
                    </span>
                </div>
            ),
        },
        {
            key: 'comunidad',
            label: 'Comunidad',
            sortable: true,
            render: (row) => (
                <span className="font-semibold text-neutral-900">{row.comunidad || '-'}</span>
            ),
        },
        {
            key: 'kind',
            label: 'Tipo',
            sortable: true,
            render: (row) => {
                const isFolder = !row.metadata;
                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isFolder ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-800'}`}>
                        {isFolder ? 'Carpeta' : 'Archivo PDF'}
                    </span>
                );
            },
            getSearchValue: (row) => !row.metadata ? 'carpeta' : 'archivo pdf'
        },
        {
            key: 'file_count',
            label: 'Archivos PDF',
            sortable: true,
            align: 'center',
            render: (row) => {
                if (row.metadata) return null; // Don't show count for files
                return (
                    <div className="flex justify-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${row.file_count && row.file_count > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-neutral-100 text-neutral-400'}`}>
                            {row.file_count || 0}
                        </span>
                    </div>
                );
            },
        },
        {
            key: 'updated_at',
            label: 'Última Modificación',
            sortable: true,
            render: (row) => (
                <span className="text-sm text-neutral-500">
                    {row.updated_at ? new Date(row.updated_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }) : '-'}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-neutral-900">Facturas Comunidades</h1>
                <div className="flex items-center gap-2">
                    {path.length > 0 && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                                accept="application/pdf"
                            />
                            <button
                                onClick={handleUploadClick}
                                className="flex items-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
                            >
                                <Upload className="w-4 h-4" />
                                <span>Subir Archivo</span>
                            </button>
                            <button
                                onClick={handleCreateBudget}
                                className="flex items-center gap-2 px-3 py-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-900 rounded-lg transition-colors text-sm font-medium shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Crear carpeta</span>
                            </button>
                        </>
                    )}
                    <button
                        onClick={fetchItems}
                        className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                        title="Actualizar"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Breadcrumbs */}
            <nav className="flex items-center space-x-2 text-sm text-neutral-600 bg-white p-3 rounded-lg border border-neutral-200 shadow-sm">
                <button
                    onClick={goHome}
                    className="hover:text-yellow-600 flex items-center gap-1 transition-colors"
                >
                    <Home className="w-4 h-4" />
                    <span className="font-medium">Facturas</span>
                </button>
                {path.map((folder, index) => (
                    <div key={index} className="flex items-center space-x-2">
                        <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                        <button
                            onClick={() => navigateTo(index)}
                            className={`hover:text-yellow-600 transition-colors ${index === path.length - 1 ? 'font-bold text-neutral-900' : 'font-medium'}`}
                        >
                            {folder}
                        </button>
                    </div>
                ))}
            </nav>

            {/* Content Table */}
            <DataTable
                key={currentPathString}
                data={tableData}
                columns={columns}
                keyExtractor={(row) => row.id || row.name}
                storageKey="facturas-comunidades"
                loading={loading}
                emptyMessage="No se encontraron archivos o carpetas"
                onRowClick={(row) => {
                    const isFolder = !row.metadata;
                    if (isFolder) {
                        handleFolderClick(row.name);
                    } else {
                        handleFileClick(row.name);
                    }
                }}
                rowActions={(row) => [
                    {
                        label: 'Mover',
                        icon: <MoveHorizontal className="w-4 h-4" />,
                        onClick: (r) => handleMoveClick(r),
                        hidden: !row.metadata,
                    },
                    {
                        label: 'Descargar',
                        icon: <Download className="w-4 h-4" />,
                        onClick: (r) => handleDownloadClick(r.name),
                        hidden: !row.metadata,
                    },
                ]}
            />

            {/* Create Folder Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-[9999] backdrop-blur-sm">
                    <div className="bg-white rounded-t-2xl sm:rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                        <form onSubmit={handleCreateConfirm} className="space-y-6">
                            <div>
                                <label className="block text-lg font-bold text-neutral-900 mb-4">
                                    Nombre de la carpeta:
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    className="w-full px-4 py-3 border-2 border-yellow-400/30 rounded-2xl focus:ring-2 focus:ring-yellow-400/20 focus:border-yellow-400 outline-none transition-all text-neutral-800"
                                    placeholder="Nombre de la carpeta"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>
                            <div className="flex gap-4 justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="px-8 py-3 bg-yellow-400 text-neutral-900 rounded-full hover:bg-yellow-500 transition-all font-bold shadow-sm disabled:opacity-50 active:scale-95"
                                >
                                    {isCreating ? 'Creando...' : 'Aceptar'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewFolderName('');
                                    }}
                                    className="px-8 py-3 bg-neutral-100 text-neutral-600 rounded-full hover:bg-neutral-200 transition-all font-bold active:scale-95"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Move File Modal */}
            {showMoveModal && (
                <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-[9999] backdrop-blur-sm sm:p-4">
                    <div className="bg-white rounded-t-2xl sm:rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col max-h-[92vh] sm:max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b border-neutral-100">
                            <h2 className="text-xl font-bold text-neutral-900">Mover archivo</h2>
                            <p className="text-sm text-neutral-500 mt-1">
                                Selecciona el destino para: <span className="font-semibold text-yellow-600">{movingFile?.name}</span>
                            </p>
                        </div>

                        {/* Breadcrumbs for Move Modal */}
                        <div className="px-8 py-4 bg-neutral-50 flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                            <button
                                onClick={() => {
                                    setMovePath([]);
                                    fetchMoveFolders([]);
                                }}
                                className="text-xs font-bold text-neutral-400 hover:text-yellow-600 uppercase tracking-widest flex items-center gap-1"
                            >
                                <Home className="w-3 h-3" />
                                FACTURAS
                            </button>
                            {movePath.map((folder, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <ChevronRight className="w-3 h-3 text-neutral-300 shrink-0" />
                                    <button
                                        onClick={() => {
                                            const newPath = movePath.slice(0, index + 1);
                                            setMovePath(newPath);
                                            fetchMoveFolders(newPath);
                                        }}
                                        className={`text-xs font-bold uppercase tracking-widest ${index === movePath.length - 1 ? 'text-yellow-600' : 'text-neutral-400 hover:text-yellow-600'}`}
                                    >
                                        {folder}
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Cascading Folders List */}
                        <div className="flex-grow p-4 overflow-y-auto">
                            {moveLoading ? (
                                <div className="flex flex-col items-center justify-center p-12">
                                    <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
                                    <span className="text-sm text-neutral-400 mt-4">Cargando carpetas...</span>
                                </div>
                            ) : moveFolderItems.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {moveFolderItems.map((item) => (
                                        <button
                                            key={item.id || item.name}
                                            onClick={() => handleMoveFolderClick(item.name)}
                                            className="flex items-center gap-3 p-4 rounded-2xl border-2 border-transparent hover:border-yellow-400 hover:bg-yellow-50 transition-all text-left group"
                                        >
                                            <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600 group-hover:bg-yellow-200 transition-colors">
                                                <Folder className="w-5 h-5" />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-neutral-900 truncate">{item.name}</span>
                                                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Carpeta</span>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-neutral-300 ml-auto group-hover:text-yellow-600 transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-12 text-center">
                                    <div className="p-4 rounded-full bg-neutral-50 text-neutral-300">
                                        <Folder className="w-12 h-12" />
                                    </div>
                                    <p className="text-neutral-500 font-medium mt-4">Esta carpeta está vacía</p>
                                    <p className="text-sm text-neutral-400">Puedes mover el archivo aquí pulsando el botón de abajo.</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-8 py-6 border-t border-neutral-100 flex items-center justify-between gap-4">
                            <div className="hidden sm:block">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Destino seleccionado:</span>
                                <div className="text-xs font-bold text-neutral-900 truncate max-w-[200px]">
                                    /FACTURAS/{movePath.join('/') || '(Raíz)'}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setShowMoveModal(false)}
                                    className="px-6 py-3 bg-neutral-100 text-neutral-600 rounded-full hover:bg-neutral-200 transition-all font-bold text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleMoveConfirm}
                                    disabled={isMoving}
                                    className="px-8 py-3 bg-yellow-400 text-neutral-900 rounded-full hover:bg-yellow-500 transition-all font-bold text-sm shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50"
                                >
                                    {isMoving ? 'Moviendo...' : 'Mover aquí'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
