import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import IncomingSOClient from './IncomingSOClient';

import { prisma } from '@/lib/db';

export default async function IncomingSOPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/staff/dashboard');
  }

  const configs = await prisma.integrationConfig.findMany({
    where: { key: { in: ['INCOMING_SO_PUBLIC_BASE_URL', 'INCOMING_SO_API_KEY'] } }
  });
  const configMap = configs.reduce((acc: Record<string, string>, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});

  const configuredKey = configMap['INCOMING_SO_API_KEY'] || process.env.INCOMING_SO_API_KEY || 'NOT_CONFIGURED';
  
  // Do not fallback to localhost. Zoho Books requires a publicly reachable URL.
  let publicBaseUrl = configMap['INCOMING_SO_PUBLIC_BASE_URL'] || process.env.INCOMING_SO_PUBLIC_BASE_URL;
  let endpoint = '';
  let hasValidPublicUrl = false;

  if (publicBaseUrl && publicBaseUrl.trim() !== '') {
    // Remove trailing slash if present
    publicBaseUrl = publicBaseUrl.replace(/\/+$/, '');
    // Prevent accidental inclusion of API path
    if (publicBaseUrl.endsWith('/api/dispatch/incoming-so')) {
      publicBaseUrl = publicBaseUrl.replace('/api/dispatch/incoming-so', '');
    }
    endpoint = `${publicBaseUrl}/api/dispatch/incoming-so`;
    hasValidPublicUrl = true;
  } else {
    endpoint = 'https://CONFIGURE_INCOMING_SO_PUBLIC_BASE_URL/api/dispatch/incoming-so';
  }

  const isProduction = process.env.NODE_ENV === 'production';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Incoming Sales Orders</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor Sales Order requests received from Zoho Books.</p>
      </div>

      <IncomingSOClient 
        endpoint={endpoint} 
        apiKey={configuredKey} 
        hasValidPublicUrl={hasValidPublicUrl}
        isProduction={isProduction}
        initialBaseUrl={publicBaseUrl || ''}
      />
    </div>
  );
}
