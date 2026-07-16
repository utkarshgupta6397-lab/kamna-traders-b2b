'use client';

import React from 'react';
import { X, CheckCircle2, Clock, AlertTriangle, XCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface TemplateDrawerProps {
  template: any | null;
  onClose: () => void;
}

export default function TemplateDrawer({ template, onClose }: TemplateDrawerProps) {
  if (!template) return null;

  // Extract variables from body
  const varRegex = /\{\{(\d+)\}\}/g;
  const variables = Array.from(template.body?.matchAll(varRegex) || []).map((m: any) => m[1]);
  const uniqueVariables = Array.from(new Set(variables));

  // Generate preview
  let previewBody = template.body || '';
  uniqueVariables.forEach((v: any, index) => {
    // Provide some nice placeholder values for visualization
    const placeholders = ['Utkarsh', 'INV-1045', '₹45,000', '12-Jul-2026', 'Paid'];
    const placeholder = placeholders[index % placeholders.length];
    previewBody = previewBody.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), `[${placeholder}]`);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-200"><CheckCircle2 size={12}/> Approved</span>;
      case 'PENDING': return <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200"><Clock size={12}/> Pending</span>;
      case 'REJECTED': return <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-md border border-red-200"><XCircle size={12}/> Rejected</span>;
      case 'DISABLED': return <span className="flex items-center gap-1 text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded-md border border-gray-200"><AlertTriangle size={12}/> Disabled</span>;
      default: return <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-md">{status}</span>;
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      
      <div className="fixed top-0 right-0 h-full w-[500px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform border-l border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <FileText size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{template.name}</h2>
              <p className="text-xs text-gray-500">{template.category} • {template.language}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/50">
          
          {/* Status & Meta Info */}
          <div className="flex items-center gap-4">
            {getStatusBadge(template.status)}
            <div className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
              ID: {template.metaTemplateId}
            </div>
          </div>

          {/* Variables Detected */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detected Variables ({uniqueVariables.length})</h3>
            {uniqueVariables.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {uniqueVariables.map((v: any) => (
                  <div key={v} className="text-xs font-mono font-medium text-[#1A2766] bg-blue-50 border border-blue-100 px-2 py-1 rounded-md">
                    {'{{'}{v}{'}}'}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No variables detected in body.</p>
            )}
          </div>

          {/* Live Preview UI */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Message Preview</h3>
            
            <div className="relative mx-auto w-full max-w-sm rounded-[2rem] border-8 border-gray-900 bg-gray-100 shadow-xl overflow-hidden aspect-[9/16] flex flex-col">
              {/* Fake WhatsApp Header */}
              <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3 shrink-0">
                <div className="w-8 h-8 rounded-full bg-white/20" />
                <div className="font-semibold text-sm">Kamna Traders</div>
              </div>
              
              {/* WhatsApp Chat Background */}
              <div className="flex-1 p-4 bg-[#efeae2] overflow-y-auto flex flex-col">
                <div className="bg-white rounded-xl rounded-tl-sm p-2 shadow-sm max-w-[90%] space-y-1 relative">
                  
                  {/* Header */}
                  {template.header && (
                    <div className="font-bold text-gray-900 mb-1 text-[13px] leading-tight">
                      {template.headerType === 'TEXT' ? template.header : `[${template.headerType} Header]`}
                    </div>
                  )}

                  {/* Body */}
                  <div className="text-[13px] text-gray-900 leading-relaxed whitespace-pre-wrap">
                    {previewBody}
                  </div>

                  {/* Footer */}
                  {template.footer && (
                    <div className="text-[11px] text-gray-500 mt-1">
                      {template.footer}
                    </div>
                  )}
                </div>

                {/* Buttons (if any) */}
                {template.buttons && Array.isArray(template.buttons) && template.buttons.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1 max-w-[90%]">
                    {template.buttons.map((btn: any, idx: number) => (
                      <div key={idx} className="bg-white text-[#00a884] font-medium text-sm text-center py-2 rounded-xl shadow-sm border border-gray-100">
                        {btn.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <p className="text-[10px] text-gray-400 text-center mt-2">Preview is generated using sample placeholder data for visualization only.</p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white shrink-0 flex items-center justify-between text-xs text-gray-500">
          <span>Synced: {format(new Date(template.lastSyncedAt), 'PPp')}</span>
          {template.qualityRating && (
            <span className="font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Quality: {template.qualityRating}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
