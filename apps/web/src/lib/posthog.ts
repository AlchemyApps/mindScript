import posthog from 'posthog-js';
import { PostHogConfig } from 'posthog-js';

export const posthogConfig: Partial<PostHogConfig> = {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: {
    dom_event_allowlist: ['click', 'submit', 'change'],
    css_selector_allowlist: [
      '[data-track]',
      '[data-analytics]',
      'button',
      'a',
      'form',
      'input[type="submit"]',
    ],
  },
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: '[data-sensitive]',
  },
  persistence: 'localStorage+cookie',
  loaded: (posthog) => {
    if (process.env.NODE_ENV === 'development') {
      posthog.debug();
    }
  },
  sanitize_properties: (properties, eventName) => {
    // Remove sensitive data from properties
    const sanitized = { ...properties };
    delete sanitized.password;
    delete sanitized.email;
    delete sanitized.ssn;
    delete sanitized.creditCard;
    return sanitized;
  },
};

export function initPostHog() {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    if (!posthog.__loaded) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, posthogConfig);
    }
    return posthog;
  }
  return null;
}

// Analytics helper functions
export const analytics = {
  track: (eventName: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined' && posthog.__loaded) {
      posthog.capture(eventName, properties);
    }
  },
  
  identify: (userId: string, traits?: Record<string, any>) => {
    if (typeof window !== 'undefined' && posthog.__loaded) {
      posthog.identify(userId, traits);
    }
  },
  
  reset: () => {
    if (typeof window !== 'undefined' && posthog.__loaded) {
      posthog.reset();
    }
  },
  
  pageView: (url?: string) => {
    if (typeof window !== 'undefined' && posthog.__loaded) {
      posthog.capture('$pageview', { url });
    }
  },
  
  setUserProperties: (properties: Record<string, any>) => {
    if (typeof window !== 'undefined' && posthog.__loaded) {
      posthog.people.set(properties);
    }
  },
};

// Event constants for consistency
export const ANALYTICS_EVENTS = {
  // Auth events
  SIGN_UP: 'user_signed_up',
  SIGN_IN: 'user_signed_in',
  SIGN_OUT: 'user_signed_out',
  PASSWORD_RESET: 'password_reset_requested',
  
  // Track events
  TRACK_CREATED: 'track_created',
  TRACK_PLAYED: 'track_played',
  TRACK_DOWNLOADED: 'track_downloaded',
  TRACK_SHARED: 'track_shared',
  TRACK_DELETED: 'track_deleted',
  
  // Purchase events
  CHECKOUT_STARTED: 'checkout_started',
  PURCHASE_COMPLETED: 'purchase_completed',
  SUBSCRIPTION_STARTED: 'subscription_started',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  
  // Builder events
  BUILDER_OPENED: 'builder_opened',
  SCRIPT_CREATED: 'script_created',
  VOICE_SELECTED: 'voice_selected',
  BACKGROUND_MUSIC_SELECTED: 'background_music_selected',
  FREQUENCY_APPLIED: 'frequency_applied',
  
  // Error events
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',
  RENDER_FAILED: 'render_failed',
} as const;