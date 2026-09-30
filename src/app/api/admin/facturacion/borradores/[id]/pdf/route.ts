import { NextResponse } from "next/server";
import { safeApiError } from "@/lib/errorMessage";
import { requireAdmin } from "@/lib/facturacion/server";
import { datosPdfBorrador } from "@/lib/facturacion/emitir";
import { construirFacturaPdf } from "@/lib/facturacion/pdf";

export const dynamic = "force-dynamic";

// GET — vista previa del PDF de un borrador (marca "BORRADOR", sin número ni QR)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdmin();
        if ("res" in auth) return auth.res;
        const { id } = await ctx.params;
        const datos = await datosPdfBorrador(id);
        if (!datos) return NextResponse.json({ error: "El borrador no existe" }, { status: 404 });
        const pdf = await construirFacturaPdf(datos);
        return new NextResponse(Buffer.from(pdf), {
            headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=borrador.pdf", "Cache-Control": "no-store" },
        });
    } catch (err: unknown) {
        return NextResponse.json({ error: safeApiError(err, "facturacion/borrador/pdf") }, { status: 500 });
    }
}
