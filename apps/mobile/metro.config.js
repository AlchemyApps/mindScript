const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch shared packages in monorepo
config.watchFolders = [monorepoRoot];

// Resolve node_modules from both app and monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force single copies of react and react-native from mobile's node_modules.
// This prevents shared packages (e.g. @mindscript/schemas) from pulling
// the root React 18 instead of mobile's React 19.
// Must handle both exact 'react' AND sub-paths like 'react/jsx-runtime'.
const forcedPackages = ['react', 'react-native', 'react/jsx-runtime', 'react/jsx-dev-runtime'];
const mobileNodeModules = path.resolve(projectRoot, 'node_modules');

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Check if the import is for react or react-native (exact or sub-path)
  if (
    moduleName === 'react' ||
    moduleName === 'react-native' ||
    moduleName.startsWith('react/') ||
    moduleName.startsWith('react-native/')
  ) {
    // Resolve from mobile's node_modules
    const resolved = require.resolve(moduleName, { paths: [mobileNodeModules] });
    return { filePath: resolved, type: 'sourceFile' };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
