/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mindscript/ui', '@mindscript/schemas', '@mindscript/types', '@mindscript/auth'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    domains: ['localhost', process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '') || ''],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/analytics',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig