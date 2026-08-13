import React from 'react';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ZohoCreatorIntegrationClient from '@/components/ZohoCreatorIntegrationClient';

export const metadata = {
  title: 'Zoho Creator Integration | Admin',
};

export default async function ZohoCreatorPage() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/staff?callbackUrl=%2Fadmin%2Fzoho-creator');
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Zoho Creator API</h1>
        <p className="text-gray-500 mt-1">Manage the Solar Products GET API integration endpoint and credentials.</p>
      </div>

      <ZohoCreatorIntegrationClient />
    </div>
  );
}
