import Link from 'next/link';
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold text-neutral-900">Historial de Documentos</h1>
                    <p className="text-sm text-neutral-500">Consulta, descarga y envía los documentos generados desde un único sitio.</p>
                </div>
                <Link
                    href="/dashboard/documentos?new=1"
                    className="inline-flex items-center rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-yellow-500 transition shadow-sm hover:shadow"
                >
                    + Nuevo documento
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
