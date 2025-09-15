import * as Sentry from '@sentry/nextjs';

// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Enable profiling for performance monitoring
  profilesSampleRate: 0.1,

  // Release Health
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  
  // Environment
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',

  // Disable in development
  enabled: process.env.NODE_ENV === 'production',

  // Capture console errors
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ['error', 'warn'],
    }),
  ],

  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Sentry Event:', event);
      console.error('Sentry Hint:', hint);
      return null;
    }
    
    // Filter out specific errors
    if (event.exception?.values?.[0]?.type === 'FetchError') {
      // Log but don't send upstream fetch errors
      console.error('FetchError captured:', event);
      return null;
    }
    
    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Supabase transient errors
    'PGRST',
    'JWT',
    // Next.js build errors
    'ENOENT',
    'ECONNREFUSED',
    // User cancellations
    'AbortError',
  ],
});