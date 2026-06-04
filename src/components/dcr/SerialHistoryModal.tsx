'use client';

import { useState, useEffect } from 'react';
import { X, Clock, Package, CheckCircle, ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SerialHistoryModal({ 
  serialNumber, 
  isOpen, 
  onClose 
}: { 
  serialNumber: string; 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const [historyData, setHistoryData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && serialNumber) {
      fetchHistory();
    }
  }, [isOpen, serialNumber]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/dcr/serials/${serialNumber}/history`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHistoryData(data.serial);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch serial history');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <Package size={18} className="text-[#1A2766]" />
              Serial Number History
            </h3>
            <p className="text-sm font-mono text-gray-600 mt-1">{serialNumber}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1A2766]"></div>
            </div>
          ) : !historyData ? (
            <div className="text-center text-gray-500 py-10">
              <Clock size={32} className="mx-auto mb-2 text-gray-300" />
              <p>No history found for this serial number.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Status Badge */}
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Status</span>
                <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded border bg-blue-50 text-[#1A2766] border-blue-200">
                  {historyData.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Timeline */}
              <div className="relative pl-4 border-l-2 border-gray-200 space-y-8 mt-6">
                {historyData.history.length === 0 ? (
                  <p className="text-sm text-gray-500 ml-4">No events recorded.</p>
                ) : (
                  historyData.history.map((event: any, index: number) => (
                    <div key={event.id} className="relative">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[21px] bg-white p-1 rounded-full border-2 border-[#1A2766]">
                        {event.eventType === 'INVENTORY_ADD' ? (
                          <Package size={12} className="text-[#1A2766]" />
                        ) : event.eventType === 'ALLOCATED' ? (
                          <CheckCircle size={12} className="text-green-600" />
                        ) : (
                          <ArrowRightLeft size={12} className="text-orange-500" />
                        )}
                      </div>
                      
                      {/* Event Content */}
                      <div className="ml-4">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-gray-800 text-sm">{event.eventType.replace(/_/g, ' ')}</h4>
                          <span className="text-[10px] text-gray-500 font-medium">
                            {new Date(event.createdAt).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {event.eventDescription}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
