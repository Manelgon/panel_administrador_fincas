import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import ClientHistoryTable from '@/components/dashboard/ClientHistoryTable';

export default async function HistorialVariosPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return (
            <div className="text-center py-12">
                <p className="text-neutral-600">No autenticado</p>
            </div>
        );
    }

    const { data, error } = await supabase
        .from("doc_submissions")
        .select(`
      id, created_at, title, pdf_path, payload,
      profiles:user_id ( nombre, apellido, rol, email )
    `)
        .eq("doc_key", "facturas_varias")
        .order("created_at", { ascending: false })
        .limit(200);

    const entries = data || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center gap-3">
                <h1 className="text-xl font-bold text-neutral-900">Historial de Documentos</h1>
                <Link
                    href="/dashboard/documentos"
                    className="flex items-center gap-2 px-3 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 rounded-md text-sm font-semibold transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Volver</span>
                </Link>
            </div>

            {/* Table */}
            <ClientHistoryTable entries={entries} type="varios" />

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-900">
                    Error cargando historial: {error.message}
                </div>
            )}
        </div>
    );
}
