import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // mcpServer desactivado — causa crash de Turbopack "Next.js package not found"
    // en rutas con Server Actions (bug Next.js 16.1.1)
    // mcpServer: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Punto 2: Content-Security-Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // Punto 5: X-Frame-Options
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Punto 6: Referrer-Policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Punto 7: Permissions-Policy
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          // Extra: protecciones adicionales
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig
