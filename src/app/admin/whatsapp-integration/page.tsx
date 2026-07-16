import { prisma } from '@/lib/db';
import { CheckCircle2, XCircle, Eye, EyeOff, Copy, Save, Plug, MessageSquare, FileText } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import WhatsAppConfigurationClient from './WhatsAppConfigurationClient';
import TestMessagingClient from './TestMessagingClient';
import WebhooksMonitorClient from './WebhooksMonitorClient';

export default async function WhatsAppIntegrationPage(
  props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }
) {
  const searchParams = await props.searchParams;
  const tab = searchParams.tab || 'overview';
  
  // Fetch Integration settings
  const config = await prisma.whatsAppConfiguration.findUnique({
    where: { id: 'singleton' }
  });

  if (tab === 'overview') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Connection Status</p>
            <div className="mt-2 flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${config?.connectionStatus === 'CONNECTED' ? 'bg-green-500' : config?.connectionStatus === 'FAILED' ? 'bg-red-500' : 'bg-gray-400'}`}></div>
              <p className="text-lg font-black text-gray-900">
                {config?.connectionStatus === 'CONNECTED' ? 'Connected' : config?.connectionStatus === 'FAILED' ? 'Failed' : 'Not Tested'}
              </p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Business Account</p>
            <p className="mt-2 text-lg font-black text-gray-900">{config?.businessAccountId || '-'}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone Number</p>
            <p className="mt-2 text-lg font-black text-gray-900">{config?.displayPhoneNumber || config?.phoneNumberId || '-'}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">API Version</p>
            <p className="mt-2 text-lg font-black text-gray-900">{config?.apiVersion || '-'}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-bold text-[#1A2766]">Integration Checklist</h3>
          </div>
          <div className="p-6">
            <ul className="space-y-4">
              {[
                'Meta App Created',
                'Access Token Configured',
                'Phone Number Connected',
                'Webhook Configured',
                'Webhook Verified',
                'Test Message Successful'
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-3 text-sm font-medium text-gray-700">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200">
                    <span className="text-[10px] font-bold">{idx + 1}</span>
                  </div>
                  {item}
                  <span className="ml-auto text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">Pending</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'configuration') {
    return <WhatsAppConfigurationClient />;
  }

  if (tab === 'templates') {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 flex flex-col items-center justify-center text-center shadow-sm">
        <MessageSquare size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Template Synchronization</h2>
        <p className="text-gray-500 mt-2 max-w-sm">
          Template synchronization will be implemented in a future release.
        </p>
      </div>
    );
  }

  if (tab === 'webhooks') {
    const webhooks = await prisma.incomingWebhook.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 100
    });

    const lastWebhook = webhooks[0]?.receivedAt || null;

    const timelineEvents = await prisma.communicationTimeline.findMany({
      orderBy: { timestamp: 'desc' },
      take: 500
    });

    const lastDelivery = timelineEvents.find(e => e.status === 'delivered')?.timestamp || null;
    const lastRead = timelineEvents.find(e => e.status === 'read')?.timestamp || null;
    const lastError = timelineEvents.find(e => e.status === 'failed')?.timestamp || null;
    
    return (
      <div className="space-y-6">
        <WebhooksMonitorClient 
          webhooks={webhooks} 
          config={{
            webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || null,
            cloudflareUrl: process.env.CLOUDFLARE_PUBLIC_URL || null,
            environment: process.env.NODE_ENV || 'development',
            verifyToken: config?.webhookVerifyToken || null,
          }}
          stats={{
            lastWebhook,
            lastDelivery,
            lastRead,
            lastError
          }}
        />
      </div>
    );
  }

  if (tab === 'logs') {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-16 flex flex-col items-center justify-center text-center shadow-sm">
        <FileText size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Integration Logs</h2>
        <p className="text-gray-500 mt-2 max-w-sm">
          No logs available.
        </p>
      </div>
    );
  }

  if (tab === 'test-messaging') {
    return <TestMessagingClient />;
  }

  // Fallback
  redirect('/admin/whatsapp-integration?tab=overview');
}
