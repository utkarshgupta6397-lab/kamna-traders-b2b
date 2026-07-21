'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Image as ImageIcon, FileText as FileTextIcon, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

interface TemplateTestModalProps {
  template: any;
  isOpen: boolean;
  onClose: () => void;
  testPhoneNumber: string | null;
}

const sampleVariables = [
  'Utkarsh Gupta',
  `INV-${format(new Date(), 'yyyyMMdd')}-4832`,
  '₹42,850',
  format(new Date(), 'dd MMM yyyy'),
  'Meerut',
  'Kamna Traders',
  'Solar Panel',
  'Order #SO-10293',
  '9812345678',
  'Approved',
  'Premium Quality',
  'Thank You'
];

export default function TemplateTestModal({ template, isOpen, onClose, testPhoneNumber }: TemplateTestModalProps) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && template) {
      generateVariables();
      generateMedia();
    }
  }, [isOpen, template]);

  const generateVariables = () => {
    if (!template?.body) return;
    
    // Extract only numeric variables like {{1}}, {{2}} (Meta standard)
    const regex = /\{\{(\d+)\}\}/g;
    const matches = [...template.body.matchAll(regex)];
    const orderedVars: string[] = [];
    matches.forEach(m => {
      if (!orderedVars.includes(m[1])) {
        orderedVars.push(m[1]);
      }
    });
    
    const newVars: Record<string, string> = {};
    orderedVars.forEach((varName, index) => {
      // All extracted variables are now guaranteed to be numeric (positional)
      const sampleIndex = parseInt(varName) - 1;
      newVars[varName] = sampleVariables[sampleIndex % sampleVariables.length];
    });
    setVariables(newVars);
  };

  const generateMedia = async () => {
    if (!template?.headerType) return;
    const type = template.headerType.toUpperCase();
    
    if (type === 'DOCUMENT') {
      try {
        const doc = new jsPDF();
        doc.setFontSize(22);
        doc.text('Kamna Traders', 105, 40, { align: 'center' });
        doc.setFontSize(16);
        doc.text('Sample Document', 105, 60, { align: 'center' });
        doc.setFontSize(12);
        doc.text('Generated automatically for WhatsApp Template Testing.', 105, 80, { align: 'center' });
        doc.text(`Generated at: ${new Date().toLocaleString()}`, 105, 100, { align: 'center' });
        
        const pdfDataUri = doc.output('datauristring');
        setMediaBase64(pdfDataUri);
      } catch (e) {
        console.error('PDF generation error', e);
      }
    } else if (type === 'IMAGE') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 628;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 1200, 628);
          
          ctx.fillStyle = '#1A2766';
          ctx.font = '900 72px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('KAMNA TRADERS', 600, 250);
          
          ctx.fillStyle = '#ff6600';
          ctx.font = '700 48px sans-serif';
          ctx.fillText('TEST IMAGE', 600, 350);
          
          ctx.fillStyle = '#666666';
          ctx.font = '32px sans-serif';
          ctx.fillText('Generated automatically by ERP', 600, 450);
          
          const dataUrl = canvas.toDataURL('image/png');
          setMediaBase64(dataUrl);
        }
      } catch (e) {
        console.error('Canvas image generation error', e);
      }
    }
  };

  const handleSend = async () => {
    if (!testPhoneNumber) {
      toast.error('Please configure Test Recipient Number under WhatsApp Integration.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/communications/templates/${template.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables, mediaBase64 })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          <div>
            <p className="font-bold">Test message sent successfully.</p>
            <p className="text-xs mt-1">ID: {data.messageId}</p>
            <p className="text-xs">Time: {new Date().toLocaleTimeString()}</p>
          </div>,
          { duration: 5000 }
        );
        onClose();
      } else {
        toast.error(`Meta API Error: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !template) return null;

  const headerType = template.headerType?.toUpperCase() || 'NONE';
  const isVideo = headerType === 'VIDEO';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-black text-gray-900">Test Message</h2>
            <p className="text-xs text-gray-500 font-medium">Send test template to admin</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Template</p>
              <p className="text-sm font-bold text-gray-900">{template.name}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Recipient</p>
              {testPhoneNumber ? (
                <p className="text-sm font-bold text-[#1A2766]">{testPhoneNumber}</p>
              ) : (
                <p className="text-[10px] font-medium text-red-500">Please configure Test Recipient Number under WhatsApp Integration.</p>
              )}
            </div>
          </div>

          {headerType !== 'NONE' && (
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase mb-3">Header Media</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                {headerType === 'IMAGE' && <ImageIcon size={24} className="text-blue-500" />}
                {headerType === 'DOCUMENT' && <FileTextIcon size={24} className="text-red-500" />}
                {headerType === 'VIDEO' && <Video size={24} className="text-purple-500" />}
                
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800">{headerType}</p>
                  {headerType === 'VIDEO' ? (
                    <p className="text-xs text-red-500 font-medium">Video testing is not supported yet.</p>
                  ) : !mediaBase64 ? (
                    <p className="text-xs text-gray-500 font-medium">Generating sample media...</p>
                  ) : (
                    <p className="text-xs text-green-600 font-bold flex items-center gap-1">Generated Sample Media ✓</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {Object.keys(variables).length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase mb-3">Variables Map</h3>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(variables).map(([key, val]) => (
                      <tr key={key}>
                        <td className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-500 w-16">
                          {`{{${key}}}`}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-800">
                          {val}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || isVideo || !testPhoneNumber || (headerType !== 'NONE' && headerType !== 'VIDEO' && !mediaBase64)}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-[#1A2766] hover:bg-[#121c4a] transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} className={sending ? 'animate-bounce' : ''} />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
