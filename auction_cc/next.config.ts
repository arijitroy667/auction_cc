// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   webpack: (config, { isServer }) => {
//     if (!isServer) {
//       config.resolve.fallback = {
//         ...config.resolve.fallback,
//         '@react-native-async-storage/async-storage': false,
//         'react-native': false,
//         'fs': false,
//         'net': false,
//         'tls': false,
//         'indexedDB': false, // Add this to suppress indexedDB warnings
//       };
//     }
    
//     config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
//     // Ignore MetaMask SDK warnings
//     config.ignoreWarnings = [
//       /Critical dependency: the request of a dependency is an expression/,
//       /Module not found: Can't resolve '@react-native-async-storage\/async-storage'/,
//       /ReferenceError: indexedDB is not defined/,
//     ];
    
//     return config;
//   },
//   transpilePackages: ['@avail-project/nexus-core'],
//   // Remove the experimental.esmExternals option as suggested
//   eslint: {
//     // Only run ESLint on these directories during production builds
//     dirs: ['src'],
//     // Don't fail build on ESLint errors/warnings
//     ignoreDuringBuilds: true,
//   },
//   typescript: {
//     // Don't fail build on TypeScript errors/warnings  
//     ignoreBuildErrors: true,
//   },
//   // Suppress build warnings
//   onDemandEntries: {
//     // Period (in ms) where the server will keep pages in the buffer
//     maxInactiveAge: 25 * 1000,
//     // Number of pages that should be kept simultaneously without being disposed
//     pagesBufferLength: 2,
//   },
//   // Suppress specific warnings
//   compiler: {
//     removeConsole: process.env.NODE_ENV === "production" ? {
//       exclude: ["error"]
//     } : false,
//   },
// };

// export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
        'react-native': false,
        'fs': false,
        'net': false,
        'tls': false,
        'crypto': require.resolve('crypto-browserify'),
        'stream': require.resolve('stream-browserify'),
        'buffer': require.resolve('buffer'),
        'process': require.resolve('process/browser'),
      };
    } else {
      // Server-side polyfills
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'indexedDB': false,
        'localStorage': false,
        'sessionStorage': false,
        'crypto': false,
      };
    }
    
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    // Suppress specific warnings and errors
    config.ignoreWarnings = [
      /Critical dependency: the request of a dependency is an expression/,
      /Module not found: Can't resolve '@react-native-async-storage\/async-storage'/,
      /ReferenceError: indexedDB is not defined/,
      /ReferenceError: localStorage is not defined/,
      /ReferenceError: sessionStorage is not defined/,
      { module: /node_modules\/@metamask\/sdk/ },
      { file: /node_modules\/@metamask\/sdk/ },
    ];
    
    // Add global polyfills
    config.plugins = config.plugins || [];
    const webpack = require('webpack');
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      })
    );
    
    return config;
  },
  transpilePackages: ['@avail-project/nexus-core'],
  eslint: {
    dirs: ['src'],
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Suppress Node.js deprecation warnings
  experimental: {
    serverComponentsExternalPackages: ['@metamask/sdk'],
  },
  // Output configuration to suppress build warnings
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  trailingSlash: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error"]
    } : false,
  },
};

export default nextConfig;