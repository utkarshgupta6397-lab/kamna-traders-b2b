import React from 'react';
import GatewayTestClient from './GatewayTestClient';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function GatewayTestPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/auth/login');
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Gateway Test Console</h1>
        <p className="text-sm text-gray-500 mt-1">Developer tool to test outbound template messages through Kamna Event Gateway.</p>
      </div>
      <GatewayTestClient />
    </div>
  );
}
