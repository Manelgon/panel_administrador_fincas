import Link from 'next/link';

export const metadata = {
    title: 'Aviso Legal · Serincosol',
    description: 'Aviso legal e información del titular del panel de gestión de Serincosol S.L.',
};

// NOTA: Borrador generado automáticamente. Debe ser revisado y validado por un
// asesor legal antes de considerarse definitivo.
export default function AvisoLegalPage() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-12 text-neutral-800">
            <h1 className="text-3xl font-bold text-neutral-900">Aviso Legal</h1>
            <p className="mt-2 text-sm text-neutral-500">Última actualización: julio de 2026</p>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">1. Datos identificativos del titular</h2>
                <p>En cumplimiento del deber de información recogido en la Ley 34/2002 de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se facilitan los siguientes datos:</p>
                <ul className="space-y-1">
                    <li><strong>Titular:</strong> Serincosol S.L.</li>
                    <li><strong>CIF:</strong> B09915075</li>
                    <li><strong>Domicilio:</strong> Pasaje Pezuela 1, 1º A Dcha, 29010 Málaga</li>
                    <li><strong>Correo electrónico:</strong> administracion@serincosol.com</li>
                </ul>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">2. Objeto</h2>
                <p>Esta aplicación es una herramienta de uso interno destinada a la gestión administrativa de comunidades de propietarios por parte de Serincosol S.L. El acceso está restringido a personal autorizado mediante credenciales.</p>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">3. Condiciones de uso</h2>
                <p>El acceso y uso de esta aplicación queda limitado a las personas autorizadas por el titular. El usuario se compromete a hacer un uso diligente de las credenciales de acceso y a no realizar ninguna actividad que pueda dañar, inutilizar o sobrecargar los sistemas, ni acceder a datos para los que no esté autorizado.</p>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">4. Propiedad intelectual</h2>
                <p>Los contenidos, la estructura y el software de esta aplicación son titularidad de Serincosol S.L. o de sus proveedores, y están protegidos por la normativa de propiedad intelectual e industrial. [REVISAR según los acuerdos con el desarrollador/proveedor.]</p>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">5. Protección de datos</h2>
                <p>El tratamiento de datos personales se rige por la <Link href="/legal/privacidad" className="text-blue-600 underline">Política de Privacidad</Link>.</p>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">6. Legislación aplicable</h2>
                <p>Las presentes condiciones se rigen por la legislación española. Para la resolución de cualquier controversia, las partes se someten a los juzgados y tribunales que correspondan conforme a derecho.</p>
            </section>

            <div className="mt-12 border-t pt-6 text-sm">
                <Link href="/auth/login" className="text-blue-600 underline">← Volver al inicio de sesión</Link>
                <span className="mx-3 text-neutral-300">·</span>
                <Link href="/legal/privacidad" className="text-blue-600 underline">Política de privacidad</Link>
            </div>
        </main>
    );
}
