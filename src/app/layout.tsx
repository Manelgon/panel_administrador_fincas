import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Panel de Gestión de Fincas — Serincosol',
  description: 'Panel de administración y gestión de fincas para Serincosol',
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
