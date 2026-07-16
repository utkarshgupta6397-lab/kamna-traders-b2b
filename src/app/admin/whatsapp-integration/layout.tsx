import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WhatsAppIntegrationTabs from './WhatsAppIntegrationTabs';

export default async function WhatsAppIntegrationLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  // Strict permission check
  if (!session || !session.whatsapp_integration) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">You do not have permission to access the WhatsApp Integration module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A2766]">WhatsApp Integration</h1>
        <p className="text-sm text-gray-500 mt-1">Manage Meta Cloud API connection, templates and messaging configuration.</p>
      </div>

      {/* Tabs and Content */}
      <WhatsAppIntegrationTabs>
        {children}
      </WhatsAppIntegrationTabs>
    </div>
  );
}
