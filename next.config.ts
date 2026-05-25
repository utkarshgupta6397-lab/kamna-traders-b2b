import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ['192.168.1.23', '192.168.1.23:3000'],
  async redirects() {
    return [
      {
        source: '/staff/accounts',
        destination: '/staff/dashboard/accounts',
        permanent: true, // Will cache the redirect and preserve query params natively
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
