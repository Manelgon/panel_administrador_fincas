"use client";

import EditorFactura from "@/components/facturacion/EditorFactura";
import { FacturacionHeader, useAdminGuard } from "@/components/facturacion/shared";

export default function NuevaFacturaPage() {
    const ok = useAdminGuard();
    return (
        <div className="space-y-6">
            <FacturacionHeader titulo="Nueva factura" />
            {ok && <EditorFactura />}
        </div>
    );
}
