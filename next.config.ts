import type { NextConfig } from "next";
import os from "os";

function getLanIps() {
  const ips: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (!iface.internal && iface.family === 'IPv4') {
        ips.push(iface.address);
        ips.push(`${iface.address}:3000`);
      }
    }
  }
  return ips;
}

const configuredOrigins = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  output: "standalone",
  allowedDevOrigins: [
    'localhost',
    'localhost:3000',
    'localhost:3002',
    '127.0.0.1',
    '127.0.0.1:3000',
    'dev.kamna-erp.bid',
    '*.kamna-erp.bid',
    'kamna-erp.bid',
    '*.trycloudflare.com',
    '192.168.1.23',
    '192.168.1.23:3000',
    '192.168.1.25',
    '192.168.1.25:3002',
    ...getLanIps(),
    ...configuredOrigins,
  ],
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
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'echarts', 'recharts'],
    serverActions: {
      allowedOrigins: ['dev.kamna-erp.bid', '*.kamna-erp.bid', 'kamna-erp.bid', '*.trycloudflare.com'],
    },
  },
  turbopack: {},
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
