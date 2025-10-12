import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_ENABLE_TESTNET: process.env.NEXT_PUBLIC_ENABLE_TESTNET,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
        port: "",
        pathname: "/**",
      },
    ],
  },
  webpack: (config, { webpack }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve("buffer"),
      process: require.resolve("process/browser"),
      stream: false,
      crypto: false,
      fs: false,
      net: false,
      tls: false,
      // Handle optional pino-pretty dependency
      "pino-pretty": false,
    };

    // Ignore optional dependencies that aren't needed for production
    config.resolve.alias = {
      ...config.resolve.alias,
      "pino-pretty": false,
    };

    // Provide Buffer global
    config.plugins = [
      ...config.plugins,
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      }),
    ];

    return config;
  },
};

export default nextConfig;