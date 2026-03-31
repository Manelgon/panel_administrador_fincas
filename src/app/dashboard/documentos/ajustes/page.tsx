"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Save, Loader2, DollarSign } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

type SettingsType = {
    precio_1: number;
    precio_2: number;
    precio_3: number;
    precio_4: number;
    precio_5: number;
    precio_6: number;
}

export default function AjustesSuplidosPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<SettingsType>({
        precio_1: 0,
        precio_2: 0,
        precio_3: 0,
        precio_4: 0,
        precio_5: 0,
        precio_6: 0,
    });

    // Supabase client for admin check (optional) and direct DB ops if we wanted, 
    // but let's use API or direct client based on preference. 
    // We'll use direct client for UPSERT as it's cleaner with RLS policies enabled.
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from("document_settings")
                .select("setting_key, setting_value")
                .eq("doc_key", "suplidos");

            if (error) throw error;

            const newSettings: any = { ...settings };
            data?.forEach(row => {
                newSettings[row.setting_key] = Number(row.setting_value);
            });
            setSettings(newSettings);
        } catch (error) {
            console.error(error);
            toast.error("Error cargando ajustes");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            // Prepare upsert data
            const upsertData = Object.entries(settings).map(([key, value]) => ({
                doc_key: 'suplidos',
                setting_key: key,
                setting_value: value
            }));

            const { error } = await supabase
                .from("document_settings")
                .upsert(upsertData, { onConflict: 'doc_key, setting_key' });

            if (error) throw error;

            toast.success("Precios actualizados correctamente");

            // Redirect back to documents dashboard after a short delay or immediately
            router.push("/dashboard/documentos");
            router.refresh();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (key: keyof SettingsType, val: string) => {
        setSettings(prev => ({
            ...prev,
            [key]: val === "" ? 0 : Number(val)
        }));
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-neutral-400" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <DollarSign className="w-6 h-6 text-yellow-500" />
                <h1 className="text-xl font-bold text-neutral-900">Ajustes de Precios · Suplidos (Admin)</h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
                <p className="text-sm text-neutral-500 mb-6">
                    Estos precios se aplicarán automáticamente a todos los nuevos documentos de "Suplidos".
                    <br />Los usuarios no podrán modificarlos manualmemte.
                </p>

                <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    <div className="space-y-4">
                        <h3 className="font-semibold text-neutral-900 border-b pb-2">Material</h3>

                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Precio Sobre Normal (€)</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={settings.precio_1}
                                onChange={e => handleChange('precio_1', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Precio Sobre A5 (€)</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={settings.precio_2}
                                onChange={e => handleChange('precio_2', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Papel Corporativo (€)</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={settings.precio_3}
                                onChange={e => handleChange('precio_3', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                            />
                        </label>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-neutral-900 border-b pb-2">Servicios</h3>

                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Etiqueta y Manipulación (€)</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={settings.precio_4}
                                onChange={e => handleChange('precio_4', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Impresión B/N (€)</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={settings.precio_5}
                                onChange={e => handleChange('precio_5', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Franqueo Postal (€)</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={settings.precio_6}
                                onChange={e => handleChange('precio_6', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                            />
                        </label>
                    </div>

                    <div className="md:col-span-2 pt-4 border-t mt-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 bg-neutral-900 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-neutral-800 transition disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar Ajustes
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
