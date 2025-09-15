import * as Sentry from '@sentry/nextjs';

// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session Replay
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.feedbackIntegration({
      colorScheme: 'system',
      showBranding: false,
      showName: true,
      showEmail: true,
    }),
  ],
  
  // Capture Replay for 10% of all sessions,
  // plus 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Release Health
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  
  // Environment
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',

  // Disable in development
  enabled: process.env.NODE_ENV === 'production',

  // User context
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Sentry Event:', event);
      console.error('Sentry Hint:', hint);
      return null;
    }
    
    // Filter out specific errors if needed
    if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
      return null;
    }
    
    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    // Random network errors
    'Network request failed',
    'NetworkError',
    'Failed to fetch',
    // User-cancelled requests
    'AbortError',
    // Browser-specific errors
    'Non-Error promise rejection captured',
    // Third-party errors
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
  ],

  // Only allow errors from our domains
  allowUrls: [
    /https:\/\/mindscript\.app/,
    /https:\/\/.*\.mindscript\.app/,
    /https:\/\/.*\.vercel\.app/,
  ],
});