'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Activity, Settings, MessageSquare, Webhook, FileText, Send } from 'lucide-react';

export default function WhatsAppIntegrationTabs({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const tabCls = (tab: string) =>
    `flex items-center gap-1.5 pb-3 text-sm font-semibold transition-colors border-b-2 ${
      activeTab === tab
        ? 'border-[#1A2766] text-[#1A2766]'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 border-b border-gray-200 overflow-x-auto whitespace-nowrap" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <Link href="/admin/whatsapp-integration?tab=overview" className={tabCls('overview')}>
          <Activity size={16} strokeWidth={1.8} />
          Overview
        </Link>
        <Link href="/admin/whatsapp-integration?tab=configuration" className={tabCls('configuration')}>
          <Settings size={16} strokeWidth={1.8} />
          Configuration
        </Link>
        <Link href="/admin/whatsapp-integration?tab=templates" className={tabCls('templates')}>
          <MessageSquare size={16} strokeWidth={1.8} />
          Templates
        </Link>
        <Link href="/admin/whatsapp-integration?tab=webhooks" className={tabCls('webhooks')}>
          <Webhook size={16} strokeWidth={1.8} />
          Webhooks
        </Link>
        <Link href="/admin/whatsapp-integration?tab=logs" className={tabCls('logs')}>
          <FileText size={16} strokeWidth={1.8} />
          Logs
        </Link>
        <Link href="/admin/whatsapp-integration?tab=test-messaging" className={tabCls('test-messaging')}>
          <Send size={16} strokeWidth={1.8} />
          Test Messaging
        </Link>
      </div>

      <div>{children}</div>
    </div>
  );
}
