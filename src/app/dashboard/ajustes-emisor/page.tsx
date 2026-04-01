"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Save, Loader2, Building2, Upload, ImageIcon, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useGlobalLoading } from "@/lib/globalLoading";

type Settings = {
    emisor_name: string;
    emisor_address: string;
    emisor_city: string;
    emisor_cif: string;
};

type ImageState = {
    url: string;
    uploading: boolean;
    isDefault?: boolean; // true = es el fallback del bucket, no uno personalizado
};

export default function AjustesEmisorPage() {
    const router = useRouter();
    const { withLoading } = useGlobalLoading();
    const logoInputRef = useRef<HTMLInputElement>(null);
    const firmaInputRef = useRef<HTMLInputElement>(null);
    const headerInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<Settings>({
        emisor_name: "",
        emisor_address: "",
        emisor_city: "",
        emisor_cif: "",
    });
    const [logo, setLogo] = useState<ImageState>({ url: "", uploading: false });
    const [firma, setFirma] = useState<ImageState>({ url: "", uploading: false });
    const [header, setHeader] = useState<ImageState>({ url: "", uploading: false });

    useEffect(() => {
        checkAdminAndLoad();
    }, []);

    const checkAdminAndLoad = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { router.push("/auth/login"); return; }

        const { data: profile } = await supabase
            .from("profiles")
            .select("rol")
            .eq("user_id", session.user.id)
            .single();

        if (!profile || profile.rol !== "admin") {
            router.push("/dashboard");
            return;
        }

        await loadSettings();
    };

    const loadSettings = async () => {
        try {
            const res = await fetch("/api/admin/company-settings");
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);

            setSettings({
                emisor_name: json.settings.emisor_name || "",
                emisor_address: json.settings.emisor_address || "",
                emisor_city: json.settings.emisor_city || "",
                emisor_cif: json.settings.emisor_cif || "",
            });
            // isDefault = no hay path personalizado guardado aún
            const hasCustomLogo = !!json.settings?.logo_path;
            const hasCustomFirma = !!json.settings?.firma_path;
            const hasCustomHeader = !!json.settings?.header_path;
            setLogo({ url: json.urls?.logo_url || "", uploading: false, isDefault: !hasCustomLogo });
            setFirma({ url: json.urls?.firma_url || "", uploading: false, isDefault: !hasCustomFirma });
            setHeader({ url: json.urls?.header_url || "", uploading: false, isDefault: !hasCustomHeader });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error cargando ajustes";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await withLoading(async () => {
            try {
                const res = await fetch("/api/admin/company-settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(settings),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                toast.success("Datos del emisor actualizados");
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Error al guardar";
                toast.error(msg);
            } finally {
                setSaving(false);
            }
        }, "Guardando datos del emisor...");
    };

    const handleImageUpload = async (file: File, type: "logo" | "firma" | "header") => {
        const setter = type === "logo" ? setLogo : type === "firma" ? setFirma : setHeader;
        setter(prev => ({ ...prev, uploading: true }));
        const labels: Record<string, string> = { logo: "Subiendo logo...", firma: "Subiendo firma...", header: "Subiendo header..." };
        await withLoading(async () => {
            try {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("type", type);

                const res = await fetch("/api/admin/company-settings", {
                    method: "POST",
                    body: formData,
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);

                setter({ url: json.url, uploading: false, isDefault: false });
                const successLabels: Record<string, string> = { logo: "Logo actualizado", firma: "Firma actualizada", header: "Header actualizado" };
                toast.success(successLabels[type]);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Error al subir imagen";
                toast.error(msg);
                setter(prev => ({ ...prev, uploading: false }));
            }
        }, labels[type]);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "firma" | "header") => {
        const file = e.target.files?.[0] as File | undefined;
        if (!file) return;
        handleImageUpload(file, type);
        e.target.value = "";
    };

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="animate-spin text-neutral-400" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-6 h-6 text-yellow-500" />
                <h1 className="text-xl font-bold text-neutral-900">Ajustes del Emisor · Admin</h1>
            </div>

            <p className="text-sm text-neutral-500 -mt-4">
                Estos datos aparecen en todos los PDFs generados (suplidos, documentos varios, informes).
                Solo los administradores pueden modificarlos.
            </p>

            {/* Datos textuales */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                <h2 className="font-semibold text-neutral-800 mb-4 text-sm uppercase tracking-wide">Datos de la empresa</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <label className="block">
                        <span className="text-sm font-medium text-neutral-700">Nombre de la empresa</span>
                        <input
                            type="text"
                            value={settings.emisor_name}
                            onChange={e => setSettings(p => ({ ...p, emisor_name: e.target.value }))}
                            placeholder="SERINCOSOL S.L."
                            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium text-neutral-700">Dirección</span>
                        <input
                            type="text"
                            value={settings.emisor_address}
                            onChange={e => setSettings(p => ({ ...p, emisor_address: e.target.value }))}
                            placeholder="Pasaje Pezuela 1, 1º A Dcha"
                            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-sm font-medium text-neutral-700">Ciudad y CP</span>
                            <input
                                type="text"
                                value={settings.emisor_city}
                                onChange={e => setSettings(p => ({ ...p, emisor_city: e.target.value }))}
                                placeholder="29010 Málaga"
                                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium text-neutral-700">CIF</span>
                            <input
                                type="text"
                                value={settings.emisor_cif}
                                onChange={e => setSettings(p => ({ ...p, emisor_cif: e.target.value }))}
                                placeholder="B09915075"
                                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                            />
                        </label>
                    </div>

                    <div className="pt-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 bg-neutral-900 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-neutral-800 transition disabled:opacity-50 text-sm"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar datos
                        </button>
                    </div>
                </form>
            </div>

            {/* Imágenes */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                <h2 className="font-semibold text-neutral-800 mb-4 text-sm uppercase tracking-wide">Imágenes corporativas</h2>

                {/* Header — fila completa porque es panorámico */}
                <div className="mb-6">
                    <ImageUploadCard
                        label="Header / Cabecera de PDFs"
                        hint="Imagen panorámica que aparece en la parte superior de todos los PDFs generados. Recomendado: 1200×200px PNG."
                        url={header.url}
                        uploading={header.uploading}
                        isDefault={header.isDefault}
                        inputRef={headerInputRef}
                        onPickFile={() => headerInputRef.current?.click()}
                        onFileChange={e => handleFileChange(e, "header")}
                        onRemove={() => setHeader({ url: "", uploading: false })}
                        wide
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Logo */}
                    <ImageUploadCard
                        label="Logo de la empresa"
                        hint="Logo corporativo (usado en el login y otros elementos de la app)."
                        url={logo.url}
                        uploading={logo.uploading}
                        isDefault={logo.isDefault}
                        inputRef={logoInputRef}
                        onPickFile={() => logoInputRef.current?.click()}
                        onFileChange={e => handleFileChange(e, "logo")}
                        onRemove={() => setLogo({ url: "", uploading: false })}
                    />

                    {/* Firma */}
                    <ImageUploadCard
                        label="Imagen de firma"
                        hint="Aparece al pie de los documentos donde se requiere firma. PNG con fondo transparente ideal."
                        url={firma.url}
                        uploading={firma.uploading}
                        isDefault={firma.isDefault}
                        inputRef={firmaInputRef}
                        onPickFile={() => firmaInputRef.current?.click()}
                        onFileChange={e => handleFileChange(e, "firma")}
                        onRemove={() => setFirma({ url: "", uploading: false })}
                    />

                </div>
            </div>
        </div>
    );
}

// Sub-componente para upload de imagen
interface ImageUploadCardProps {
    label: string;
    hint: string;
    url: string;
    uploading: boolean;
    isDefault?: boolean;
    wide?: boolean;
    inputRef: React.RefObject<HTMLInputElement | null>;
    onPickFile: () => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemove: () => void;
}

function ImageUploadCard({ label, hint, url, uploading, isDefault, wide, inputRef, onPickFile, onFileChange, onRemove }: ImageUploadCardProps) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-medium text-neutral-700">{label}</p>
                {url && isDefault && (
                    <span className="text-[10px] font-medium bg-neutral-100 text-neutral-500 rounded px-1.5 py-0.5">
                        actual
                    </span>
                )}
                {url && !isDefault && (
                    <span className="text-[10px] font-medium bg-green-50 text-green-600 rounded px-1.5 py-0.5">
                        personalizado
                    </span>
                )}
            </div>
            <div className={`border-2 border-dashed border-neutral-200 rounded-xl p-4 flex flex-col items-center gap-3 justify-center relative ${wide ? "min-h-[100px]" : "min-h-[140px]"}`}>
                {uploading ? (
                    <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
                ) : url ? (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={url}
                            alt={label}
                            className={`max-w-full object-contain rounded ${wide ? "max-h-20 w-full" : "max-h-24"}`}
                        />
                        <div className="flex gap-2 mt-1">
                            <button
                                type="button"
                                onClick={onPickFile}
                                className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-lg px-3 py-1.5 transition"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                {isDefault ? "Subir nuevo" : "Cambiar"}
                            </button>
                            {!isDefault && (
                                <button
                                    type="button"
                                    onClick={onRemove}
                                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 border border-red-100 rounded-lg px-3 py-1.5 transition"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Quitar
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <ImageIcon className="w-8 h-8 text-neutral-300" />
                        <button
                            type="button"
                            onClick={onPickFile}
                            className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-lg px-4 py-2 transition hover:border-neutral-400"
                        >
                            <Upload className="w-4 h-4" />
                            Subir imagen
                        </button>
                    </>
                )}
            </div>
            <p className="text-xs text-neutral-400 mt-1.5">{hint}</p>
            <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={onFileChange}
            />
        </div>
    );
}
