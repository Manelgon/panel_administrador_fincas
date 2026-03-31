import Link from 'next/link';
import { ArrowLeft, Calendar, User, FileText } from 'lucide-react';
import { supabaseServer } from '@/lib/supabase/server';
import ClientHistoryTable from '@/components/dashboard/ClientHistoryTable';

export default async function HistorialSuplidosPage() {
    const supabase = await supabaseServer();
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
        .eq("doc_key", "suplidos")
        .order("created_at", { ascending: false })
        .limit(200);

    const entries = data || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-yellow-500" />
                    <div>
                        <h1 className="text-xl font-bold text-neutral-900">Historial · Suplidos</h1>
                        <p className="text-sm text-neutral-600 mt-1">
                            Todos los documentos generados. Todos los usuarios pueden verlos.
                        </p>
                    </div>
                </div>

                <Link
                    href="/dashboard/documentos"
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-md text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                </Link>
            </div>

            {/* Table */}
            <ClientHistoryTable entries={entries} type="suplidos" />

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-900">
                    Error: {error.message}
                </div>
            )}
        </div>
    );
}
