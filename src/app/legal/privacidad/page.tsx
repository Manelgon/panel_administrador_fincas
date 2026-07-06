import Link from 'next/link';

export const metadata = {
    title: 'Política de Privacidad · Serincosol',
    description: 'Información sobre el tratamiento de datos personales en el panel de gestión de Serincosol S.L.',
};

// NOTA: Borrador generado automáticamente. Debe ser revisado y validado por un
// asesor legal antes de considerarse definitivo. Ajustar los apartados marcados
// con [REVISAR] a la realidad contractual y operativa de la empresa.
export default function PoliticaPrivacidadPage() {
    return (
        <main className="mx-auto max-w-3xl px-6 py-12 text-neutral-800">
            <h1 className="text-3xl font-bold text-neutral-900">Política de Privacidad</h1>
            <p className="mt-2 text-sm text-neutral-500">Última actualización: julio de 2026</p>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">1. Responsable del tratamiento</h2>
                <ul className="space-y-1">
                    <li><strong>Titular:</strong> Serincosol S.L.</li>
                    <li><strong>CIF:</strong> B09915075</li>
                    <li><strong>Domicilio:</strong> Pasaje Pezuela 1, 1º A Dcha, 29010 Málaga</li>
                    <li><strong>Correo de contacto:</strong> administracion@serincosol.com</li>
                </ul>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">2. Finalidades del tratamiento</h2>
                <p>En este panel tratamos datos personales para las siguientes finalidades:</p>
                <ul className="list-disc pl-6 space-y-1">
                    <li>Gestión administrativa de las comunidades de propietarios (incidencias, comunicaciones, morosidad, documentación).</li>
                    <li>Control horario de la jornada laboral del personal (fichajes).</li>
                    <li>Gestión de solicitudes y saldos de vacaciones del personal.</li>
                    <li>Emisión de documentos (certificados, suplidos, presupuestos) y su envío a los interesados.</li>
                </ul>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">3. Bases jurídicas</h2>
                <ul className="list-disc pl-6 space-y-1">
                    <li><strong>Gestión de comunidades:</strong> ejecución del contrato de administración de fincas y cumplimiento de la Ley de Propiedad Horizontal (art. 6.1.b y 6.1.c RGPD).</li>
                    <li><strong>Control horario:</strong> obligación legal (art. 34.9 del Estatuto de los Trabajadores; art. 6.1.c RGPD).</li>
                    <li><strong>Gestión laboral y vacaciones:</strong> ejecución de la relación laboral (art. 6.1.b RGPD).</li>
                </ul>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">4. Plazos de conservación</h2>
                <ul className="list-disc pl-6 space-y-1">
                    <li>Registros de control horario: <strong>4 años</strong> (art. 34.9 ET).</li>
                    <li>Documentación contable y fiscal: los plazos legales aplicables (con carácter general, hasta 6 años).</li>
                    <li>Datos de gestión de comunidades: mientras se mantenga la relación de administración y los plazos de prescripción de responsabilidades. [REVISAR]</li>
                </ul>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">5. Destinatarios y encargados de tratamiento</h2>
                <p>Para prestar el servicio recurrimos a proveedores que actúan como encargados de tratamiento:</p>
                <ul className="list-disc pl-6 space-y-1">
                    <li><strong>Supabase</strong> (base de datos y almacenamiento) — servidores en la Unión Europea (Irlanda).</li>
                    <li><strong>Vercel</strong> (alojamiento de la aplicación).</li>
                    <li><strong>Microsoft / OneDrive</strong> (almacenamiento de facturas de comunidades).</li>
                    <li><strong>Proveedor de automatizaciones (n8n)</strong> (envío de comunicaciones y notificaciones).</li>
                    <li><strong>OpenAI</strong> (análisis asistido de documentos con inteligencia artificial).</li>
                </ul>
                <p className="text-sm text-neutral-600">Algunos de estos proveedores pueden realizar transferencias internacionales de datos fuera del Espacio Económico Europeo, amparadas en las garantías previstas en el RGPD (Marco de Privacidad de Datos UE-EE.UU. y/o cláusulas contractuales tipo). [REVISAR el detalle de cada proveedor y sus garantías.]</p>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">6. Inteligencia artificial</h2>
                <p>Determinados documentos e informes incluyen textos elaborados con asistencia de inteligencia artificial. Dichos contenidos van identificados como tales y son revisados por una persona antes de su uso. No se adoptan decisiones con efectos jurídicos basadas únicamente en tratamientos automatizados.</p>
            </section>

            <section className="mt-8 space-y-3">
                <h2 className="text-xl font-semibold text-neutral-900">7. Derechos de las personas interesadas</h2>
                <p>Puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad dirigiéndose a <strong>administracion@serincosol.com</strong>, indicando el derecho que desea ejercer y acompañando copia de un documento que acredite su identidad.</p>
                <p>Asimismo, tiene derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (<a className="text-blue-600 underline" href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">www.aepd.es</a>).</p>
            </section>

            <div className="mt-12 border-t pt-6 text-sm">
                <Link href="/auth/login" className="text-blue-600 underline">← Volver al inicio de sesión</Link>
                <span className="mx-3 text-neutral-300">·</span>
                <Link href="/legal/aviso-legal" className="text-blue-600 underline">Aviso legal</Link>
            </div>
        </main>
    );
}
