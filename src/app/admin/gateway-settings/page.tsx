import React from 'react';
import GatewayConfigurationClient from './GatewayConfigurationClient';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function GatewaySettingsPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/auth/login');
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Gateway Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage Kamna Event Gateway connection details.</p>
      </div>
      <GatewayConfigurationClient />
    </div>
  );
}
