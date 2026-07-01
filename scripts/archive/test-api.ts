import { GET } from './src/app/api/admin/dcr/serial-registry/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  getSession: () => Promise.resolve({ dcr_management: true, role: 'ADMIN' })
}));

async function main() {
  const req = new NextRequest('http://localhost/api/admin/dcr/serial-registry?page=1&limit=50&q=&status=ALL&vendorDcrStatus=ALL');
  const res = await GET(req);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
// wait, NextRequest is from next/server, and getSession is inside route.ts, it will use real auth which will fail without a cookie.
