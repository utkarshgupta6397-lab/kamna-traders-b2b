import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ['localhost', 'localhost:3002', '192.168.1.23', '192.168.1.23:3000', '192.168.1.25', '192.168.1.25:3002'],
  async redirects() {
    return [
      {
        source: '/staff/accounts',
        destination: '/staff/dashboard/accounts',
        permanent: true, // Will cache the redirect and preserve query params natively
      },
      {
        source: '/staff/dashboard/carts',
        destination: '/staff/dashboard/operations/carts',
        permanent: true,
      },
      {
        source: '/staff/dashboard/inventory/history',
        destination: '/staff/dashboard/operations/inventory-history',
        permanent: true,
      },
      {
        source: '/staff/dashboard/current-stock',
        destination: '/staff/dashboard/operations/current-stock',
        permanent: true,
      },
      {
        source: '/staff/dashboard/transfers',
        destination: '/staff/dashboard/operations/transfers',
        permanent: true,
      },
      {
        source: '/staff/dashboard/transfers/:path*',
        destination: '/staff/dashboard/operations/transfers/:path*',
        permanent: true,
      },
    ];
  },
  /* config options here */
  turbopack: {
    rules: {
      "*.md": ["ignore"],
      "*.log": ["ignore"],
    },
  }, 
  experimental: {
    // Other experimental options can go here
  },
  // Ensure markdown and logs don't trigger HMR/rebuild loops
  webpack: (config) => {
    config.watchOptions = {
      ignored: [
        '**/.gemini/**',
        '**/node_modules/**',
        '**/.next/**',
        '**/*.md',
        '**/*.log',
        '**/task_log.json',
        '**/brain/**',
        '**/scratch/**',
        '**/artifacts/**',
        '**/.tempmediaStorage/**'
      ],
    };
    return config;
  },
};

export default nextConfig;
