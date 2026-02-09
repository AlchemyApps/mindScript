const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Performance optimizations
config.transformer = {
  ...config.transformer,
  minifierPath: 'metro-minify-terser',
  minifierConfig: {
    ecma: 8,
    keep_fnames: false,
    keep_classnames: false,
    module: true,
    mangle: {
      keep_fnames: false,
    },
    compress: {
      drop_console: true,
      drop_debugger: true,
      pure_funcs: ['console.log', 'console.info', 'console.debug'],
      passes: 2,
    },
  },
  // Enable Hermes bytecode generation
  hermesParser: true,
};

// Optimize resolver
config.resolver = {
  ...config.resolver,
  // Add performance-optimized extensions
  sourceExts: [...config.resolver.sourceExts, 'cjs'],
};

// Cache configuration for faster rebuilds
config.cacheStores = [
  {
    store: require('metro-cache'),
    options: {
      max: 2000,
      ttl: 86400, // 24 hours
    },
  },
];

// Optimize serializer for production builds
config.serializer = {
  ...config.serializer,
  processModuleFilter: (module) => {
    // Remove test files from production bundle
    if (module.path.includes('__tests__') || module.path.includes('.test.')) {
      return false;
    }
    return true;
  },
};

module.exports = config;