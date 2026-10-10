import type { Metadata } from 'next'
import './globals.css'
import { getEmisor } from '@/lib/getEmisor'

export async function generateMetadata(): Promise<Metadata> {
  const { nombre } = await getEmisor()
  const empresa = nombre && nombre !== 'EMPRESA' ? nombre : ''
  return {
    title: empresa ? `Panel de Gestión de Fincas — ${empresa}` : 'Panel de Gestión de Fincas',
    description: empresa
      ? `Panel de administración y gestión de fincas para ${empresa}`
      : 'Panel de administración y gestión de fincas',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
