'use client';

import React, { useState } from 'react';
import { Send, X, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TestMessagingClient() {
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [templateName, setTemplateName] = useState('hello_world');
  const [language, setLanguage] = useState('en_US');
  const [isSending, setIsSending] = useState(false);

  const fullPhoneNumber = `${countryCode.replace('+', '')}${phoneNumber}`;

  const handleSend = async () => {
    if (!phoneNumber) {
      toast.error('Phone number is required');
      return;
    }
    
    if (!/^\d+$/.test(phoneNumber)) {
      toast.error('Phone number must contain only digits');
      return;
    }

    setIsSending(true);

    try {
      const res = await fetch('/api/admin/whatsapp-integration/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: fullPhoneNumber,
          templateName,
          language
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(
          <div>
            <p className="font-bold">Test message sent successfully.</p>
            <p className="text-xs mt-1 break-all text-gray-100">Message ID: {data.messageId}</p>
          </div>,
          { duration: 5000 }
        );
      } else {
        toast.error(`Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message || 'Unknown network error'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    setPhoneNumber('');
    setTemplateName('hello_world');
    setLanguage('en_US');
  };

  return (
    <div className="grid grid-cols-3 gap-6 max-w-5xl">
      <div className="col-span-2 space-y-6">
        {/* Recipient */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[#1A2766] border-b border-gray-100 pb-2">Recipient</h3>
          
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 w-1/4">
              <label className="text-xs font-bold text-gray-700">Country Code</label>
              <select 
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-gray-50 outline-none focus:border-[#1A2766] transition-colors"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={isSending}
              >
                <option value="+91">+91 (India)</option>
                <option value="+1">+1 (US/Canada)</option>
                <option value="+44">+44 (UK)</option>
                <option value="+971">+971 (UAE)</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1 w-3/4">
              <label className="text-xs font-bold text-gray-700">Phone Number</label>
              <input 
                type="text" 
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 outline-none focus:border-[#1A2766] focus:ring-1 focus:ring-[#1A2766] transition-all"
                placeholder="9876543210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isSending}
              />
            </div>
          </div>
        </div>

        {/* Template & Language */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[#1A2766] border-b border-gray-100 pb-2">Message Template</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">Template</label>
              <select 
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:border-[#1A2766] transition-colors"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                disabled={isSending}
              >
                <option value="hello_world">hello_world</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">Language</label>
              <select 
                className="w-full text-sm border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:border-[#1A2766] transition-colors"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isSending}
              >
                <option value="en_US">English (en_US)</option>
                <option value="hi_IN">Hindi (hi_IN)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 items-center">
          <button 
            className="flex items-center gap-2 bg-[#1A2766] hover:bg-[#121c4a] text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSend}
            disabled={isSending || !phoneNumber}
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {isSending ? 'Sending...' : 'Send Test Message'}
          </button>
          
          <button 
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleClear}
            disabled={isSending}
          >
            <X size={16} />
            Clear
          </button>
        </div>
      </div>

      {/* Preview Pane */}
      <div className="col-span-1">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-6">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
            <Eye size={16} className="text-gray-500" />
            <h3 className="text-sm font-bold text-[#1A2766]">Payload Preview</h3>
          </div>
          <div className="p-5 bg-gray-50 h-full">
            <div className="bg-[#1e1e1e] rounded-lg p-4 font-mono text-[11px] text-[#d4d4d4] overflow-x-auto shadow-inner leading-relaxed">
              <pre>
{`{
  "messaging_product": "whatsapp",
  "to": "${fullPhoneNumber}",
  "type": "template",
  "template": {
    "name": "${templateName}",
    "language": {
      "code": "${language}"
    }
  }
}`}
              </pre>
            </div>
            <p className="text-[10px] text-gray-400 mt-4 text-center">
              This exact payload will be sent to the Meta Cloud API.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
