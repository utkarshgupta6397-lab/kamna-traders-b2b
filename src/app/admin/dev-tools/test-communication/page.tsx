'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { sendTestCommunication } from './actions';
import { Terminal, Send, CheckCircle2, XCircle } from 'lucide-react';

export default function TestCommunicationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  const samplePayload = {
    channel: 'whatsapp' as const,
    recipient: '+918744832318',
    template: 'dcr_issued_v1',
    variables: {
      invoice_number: 'KT/26-27/1234'
    },
    metadata: {
      customerId: 'CUST-001',
      orderId: 'ORD-999',
      invoiceId: 'INV-1234'
    },
    requestedBy: 'admin',
    source: 'kamna-erp'
  };

  const handleSendTest = async () => {
    setIsLoading(true);
    setResponse(null);
    try {
      const res = await sendTestCommunication(samplePayload);
      setResponse(res);
      
      if (res.success) {
        toast.success('Communication event created successfully');
      } else {
        toast.error(res.error || 'Failed to send communication');
      }
    } catch (err: any) {
      toast.error('Unexpected error occurred');
      setResponse({ success: false, error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
        <Terminal className="text-blue-600" size={24} />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Test Communication</h1>
          <p className="text-sm text-gray-500">
            Developer tools to test the Kamna Event Gateway integration.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Sample Payload</h2>
          <pre className="bg-slate-50 p-4 rounded-lg text-xs overflow-auto font-mono text-slate-700 border border-slate-100 h-[300px]">
            {JSON.stringify(samplePayload, null, 2)}
          </pre>
          <button
            onClick={handleSendTest}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={18} />
            )}
            Send Test WhatsApp
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Gateway Response</h2>
          
          {!response ? (
            <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm italic">
              Awaiting request...
            </div>
          ) : (
            <div className="space-y-4">
              {response.success ? (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg border border-green-100">
                  <CheckCircle2 size={20} />
                  <span className="font-medium">Success</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                  <XCircle size={20} />
                  <span className="font-medium">Failed</span>
                </div>
              )}

              {response.eventId && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Event ID</label>
                  <div className="bg-gray-50 px-3 py-2 rounded border text-sm font-mono text-gray-800">
                    {response.eventId}
                  </div>
                </div>
              )}

              {response.messageId && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Provider Message ID</label>
                  <div className="bg-gray-50 px-3 py-2 rounded border text-sm font-mono text-gray-800">
                    {response.messageId}
                  </div>
                </div>
              )}

              {response.error && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Error Message</label>
                  <div className="bg-red-50 px-3 py-2 rounded border border-red-100 text-sm font-mono text-red-700 break-words">
                    {response.error}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
