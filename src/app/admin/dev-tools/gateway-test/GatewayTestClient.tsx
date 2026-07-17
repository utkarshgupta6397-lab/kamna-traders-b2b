'use client';

import React, { useState, useEffect } from 'react';
import { Send, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GatewayTestClient() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [recipient, setRecipient] = useState('');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [language, setLanguage] = useState('en');
  const [variables, setVariables] = useState<string[]>(['']);
  
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<any>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/communications/gateway/templates');
      const data = await res.json();
      if (res.ok) {
        setTemplates(data.templates || []);
      } else {
        toast.error(data.error || 'Failed to fetch templates');
      }
    } catch (error) {
      toast.error('Error connecting to template API');
    } finally {
      setLoading(false);
    }
  };

  // When template changes, try to infer variables if possible.
  // As a fallback, we allow dynamic variable inputs.
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tName = e.target.value;
    setSelectedTemplateName(tName);
    const template = templates.find(t => t.name === tName);
    if (template) {
      setLanguage(template.language || 'en');
      // If template object has components, try to count variables
      let varCount = 0;
      if (template.components) {
        template.components.forEach((c: any) => {
          const matches = c.text?.match(/\{\{\d+\}\}/g);
          if (matches) varCount += matches.length;
        });
      }
      
      // Fallback: If we couldn't parse or it's 0, default to 1 empty variable just in case,
      // or set it to exact count if found.
      if (varCount > 0) {
        setVariables(Array(varCount).fill(''));
      } else {
        setVariables(['']);
      }
    }
  };

  const handleVariableChange = (index: number, value: string) => {
    const newVars = [...variables];
    newVars[index] = value;
    setVariables(newVars);
  };

  const addVariable = () => setVariables([...variables, '']);
  const removeVariable = () => setVariables(variables.slice(0, -1));

  // The final payload
  const payloadPreview = {
    recipient,
    channel: 'whatsapp',
    template: selectedTemplateName,
    language,
    variables: variables.filter(v => v.trim() !== ''),
    metadata: {
      source: 'erp',
      requestedBy: 'current_user'
    }
  };

  const handleSend = async () => {
    if (!recipient || !selectedTemplateName) {
      toast.error('Recipient and Template are required');
      return;
    }
    
    setSending(true);
    setResponse(null);
    try {
      const res = await fetch('/api/communications/gateway/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient,
          template: selectedTemplateName,
          language,
          // Convert array to object or pass as array depending on API expectation.
          // Gateway usually expects object or array. We'll pass array as that's what preview shows.
          variables: variables.filter(v => v.trim() !== ''),
        })
      });
      const data = await res.json();
      setResponse(data);
      if (data.success) {
        toast.success('Message sent via Gateway!');
      } else {
        toast.error(data.error || 'Failed to send message');
      }
    } catch (error) {
      toast.error('Error sending message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><RefreshCw className="animate-spin mx-auto text-blue-600" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Configure Message</h2>
          <p className="text-sm text-gray-500">Send an outbound template message via Gateway.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Recipient</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="+91..."
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Template</label>
            <select
              value={selectedTemplateName}
              onChange={handleTemplateChange}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select a template...</option>
              {templates.map((t, i) => (
                <option key={i} value={t.name}>{t.name} ({t.language})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Language</label>
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-gray-700">Variables</label>
              <div className="flex gap-2">
                <button type="button" onClick={removeVariable} disabled={variables.length === 0} className="text-xs text-red-600 disabled:opacity-50 font-semibold">- Remove</button>
                <button type="button" onClick={addVariable} className="text-xs text-blue-600 font-semibold">+ Add Variable</button>
              </div>
            </div>
            {variables.map((val, i) => (
              <div key={i} className="mb-2">
                <input
                  type="text"
                  value={val}
                  onChange={(e) => handleVariableChange(i, e.target.value)}
                  placeholder={`Variable ${i + 1}`}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !recipient || !selectedTemplateName}
            className="w-full py-2.5 bg-[#1A2766] hover:bg-[#121c4a] text-white rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {sending ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
            Send Message
          </button>
        </div>
      </div>

      {/* Preview & Response */}
      <div className="space-y-6">
        <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 p-6 text-gray-100">
          <h2 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">Payload Preview</h2>
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {JSON.stringify(payloadPreview, null, 2)}
          </pre>
        </div>

        {response && (
          <div className={`rounded-xl shadow-sm border p-6 ${response.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <h2 className={`text-sm font-bold mb-4 uppercase tracking-wider flex items-center gap-2 ${response.success ? 'text-green-800' : 'text-red-800'}`}>
              {response.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              Response
            </h2>
            <div className={`text-sm ${response.success ? 'text-green-900' : 'text-red-900'} space-y-2`}>
              {response.success ? (
                <>
                  <p><strong>Status:</strong> Success</p>
                  <p><strong>Message ID:</strong> {response.messageId}</p>
                </>
              ) : (
                <>
                  <p><strong>Status:</strong> Failed</p>
                  <p><strong>Error:</strong> {response.error}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
