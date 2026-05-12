import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
