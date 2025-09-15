module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3001/',
        'http://localhost:3001/library',
        'http://localhost:3001/builder',
        'http://localhost:3001/marketplace',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
        screenEmulation: {
          mobile: false,
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
        },
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'interactive': ['error', { maxNumericValue: 3800 }],
        'speed-index': ['error', { maxNumericValue: 3400 }],
        'resource-summary:script:size': ['error', { maxNumericValue: 200000 }],
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 40000 }],
        'resource-summary:document:size': ['error', { maxNumericValue: 18000 }],
        'resource-summary:font:size': ['error', { maxNumericValue: 100000 }],
        'resource-summary:image:size': ['error', { maxNumericValue: 500000 }],
        'resource-summary:third-party:size': ['error', { maxNumericValue: 100000 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 1000000 }],
        'uses-optimized-images': 'error',
        'uses-text-compression': 'error',
        'uses-rel-preconnect': 'warn',
        'uses-rel-preload': 'warn',
        'efficient-animated-content': 'warn',
        'modern-image-formats': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};