import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // mcpServer desactivado — causa crash de Turbopack "Next.js package not found"
    // en rutas con Server Actions (bug Next.js 16.1.1)
    // mcpServer: true,
  },
}

export default nextConfig
