"use client";

import { use } from "react";
import EditorFactura from "@/components/facturacion/EditorFactura";
import { FacturacionHeader, useAdminGuard } from "@/components/facturacion/shared";

export default function BorradorFacturaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const ok = useAdminGuard();
    return (
        <div className="space-y-6">
            <FacturacionHeader titulo="Borrador de factura" />
            {ok && <EditorFactura borradorId={id} />}
        </div>
    );
}
