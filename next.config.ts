import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Frame-Options',          value: 'DENY' },
  { key: 'X-Content-Type-Options',   value: 'nosniff' },
  { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-eval removed from production; Next.js needs it only in dev (HMR).
      // If runtime errors appear after this, set NEXT_PUBLIC_CSP_UNSAFE_EVAL=true and add it back.
      process.env.NODE_ENV === 'development'
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    // Hostname hardcoded — env vars NEXT_PUBLIC_* não estão disponíveis no
    // build do EasyPanel/Nixpacks. Para mover de projeto Supabase, trocar aqui.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'sfzuoqnzdhknmqtprfly.supabase.co',
        pathname: '/storage/v1/object/public/portal-fotos/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
