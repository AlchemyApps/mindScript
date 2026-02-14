/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  transpilePackages: ["@mindscript/ui", "@mindscript/types", "@mindscript/schemas", "@mindscript/email"],
  experimental: {
    typedRoutes: false,
    optimizePackageImports: ['lucide-react', '@heroicons/react', '@radix-ui/*'],
    instrumentationHook: true, // Enable instrumentation for Sentry
    missingSuspenseWithCSRBailout: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    // Security: Limit image sizes to prevent abuse
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60, // 1 minute
    formats: ['image/webp', 'image/avif'],
    // Performance: Optimize image loading
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Performance optimizations
  compress: true,
  generateEtags: true,
  productionBrowserSourceMaps: false, // Disable source maps in production for smaller bundle
  
  // Security configurations
  poweredByHeader: false, // Remove X-Powered-By header
  
  // Strict runtime configuration
  reactStrictMode: true,

  // Skip ESLint during build (run separately via npm run lint)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Enable SWC minification for better performance and security
  swcMinify: true,
  
  // Headers configuration (additional to middleware)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0'
          }
        ]
      }
    ];
  },
  
  // Redirects for security
  async redirects() {
    return [
      {
        source: '/.env',
        destination: '/404',
        permanent: false,
      },
      {
        source: '/.env.local',
        destination: '/404',
        permanent: false,
      },
      {
        source: '/.git/:path*',
        destination: '/404',
        permanent: false,
      },
    ];
  },
  
  // Environment variable validation
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  
  // Webpack configuration for security
  webpack: (config, { isServer }) => {
    // Add security plugins or modifications here if needed
    if (!isServer) {
      // Ensure no sensitive server-side code is bundled for the client
      config.resolve.alias = {
        ...config.resolve.alias,
        'server-only$': 'empty-module',
      };
    }
    return config;
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG || 'mindscript',
  project: process.env.SENTRY_PROJECT || 'mindscript-web',

  // Only upload source maps in production
  silent: true,

  // Upload source maps during production build
  widenClientFileUpload: true,

  // Automatically instrument your code for performance monitoring
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route errors to the correct transaction
  tunnelRoute: "/monitoring",

  // Hide source maps from being visible in production
  hideSourceMaps: true,

  // Disable source map uploading in development
  disableLogger: true,
};

// Export with Sentry wrapper for automatic error tracking
module.exports = withSentryConfig(
  withBundleAnalyzer(nextConfig),
  sentryWebpackPluginOptions
);