'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, Loader2 } from 'lucide-react';

interface GlobalNewTaskModalProps {
  users: any[];
  currentUserId: string;
  prefilledOrder?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const ALLOWED_TIMES = [
  'No Time',
  '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', 
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', 
  '05:00 PM', '06:00 PM'
];

export default function GlobalNewTaskModal({ users, currentUserId, prefilledOrder, onClose, onSuccess }: GlobalNewTaskModalProps) {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(prefilledOrder || null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Set default due date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const defaultAssignee = prefilledOrder?.salesman?.id 
    || prefilledOrder?.callingExecutive?.id 
    || prefilledOrder?.subVendor?.id 
    || currentUserId;

  const [formData, setFormData] = useState({
    title: '',
    assignedToId: defaultAssignee,
    dueDate: tomorrowStr,
    dueTime: 'No Time',
    description: '',
    status: 'PENDING'
  });

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/solar-tasks/search-orders?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out inactive orders from search results
          const activeOrders = (data.orders || []).filter((o: any) => !['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'].includes(o.status));
          setSearchResults(activeOrders);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const handleSubmit = async () => {
    if (!selectedOrder) {
      alert("Please select an order first.");
      return;
    }
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/solar-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dueTime: formData.dueTime === 'No Time' ? null : formData.dueTime,
          solarOrderId: selectedOrder.id
        })
      });
      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create task');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (document.activeElement?.tagName !== 'TEXTAREA' && selectedOrder && formData.title.trim()) {
          e.preventDefault();
          handleSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder, formData]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[520px] relative z-[111] overflow-visible border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 tracking-tight">New Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Order Selection */}
          {!prefilledOrder && (
            <div className="relative">
              {selectedOrder ? (
                <div className="flex items-center justify-between border border-blue-100 bg-blue-50/50 px-4 py-2.5 rounded-xl">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedOrder.customerName}</p>
                    <p className="text-[11px] text-gray-500 font-medium">{selectedOrder.orderNumber} • {selectedOrder.status.replace(/_/g, ' ')}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedOrder(null)}
                    disabled={loading}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    autoFocus
                    disabled={loading}
                    className="w-full text-sm border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all shadow-sm"
                    placeholder="Search active order by customer or ID..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                  />
                  {searching && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                  
                  {showDropdown && searchQuery.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                      {searchResults.length === 0 && !searching ? (
                        <div className="px-4 py-4 text-sm text-gray-500 text-center font-medium">No active orders found.</div>
                      ) : (
                        searchResults.map(order => (
                          <div 
                            key={order.id}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                            onClick={() => {
                              setSelectedOrder(order);
                              setShowDropdown(false);
                              setSearchQuery('');
                            }}
                          >
                            <p className="text-sm font-bold text-gray-900">{order.customerName}</p>
                            <p className="text-xs text-gray-500 font-medium">{order.orderNumber} • {order.status.replace(/_/g, ' ')}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Task</label>
            <input
              required
              type="text"
              disabled={loading}
              autoFocus={!!prefilledOrder}
              className="w-full text-base font-medium border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder-gray-400 transition-all shadow-sm"
              placeholder="e.g. Schedule Installation Visit"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Assign To</label>
            <select
              required
              disabled={loading}
              className="w-full text-sm font-medium border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none bg-white transition-all shadow-sm"
              value={formData.assignedToId}
              onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Due</label>
              <input
                required
                type="date"
                min={todayStr}
                disabled={loading}
                className="w-full text-sm font-medium border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all shadow-sm bg-white"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide opacity-0">Time</label>
              <select
                disabled={loading}
                className="w-full text-sm font-medium border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none bg-white transition-all shadow-sm"
                value={formData.dueTime}
                onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
              >
                {ALLOWED_TIMES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Description</label>
            <textarea
              disabled={loading}
              className="w-full text-sm font-medium border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none resize-none transition-all shadow-sm"
              rows={2}
              placeholder="Optional notes for the assignee..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-400 flex items-center gap-1 hidden sm:flex">
              Press <kbd className="font-sans px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded-md">Enter</kbd> to save
            </span>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 sm:flex-none px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !selectedOrder || !formData.title.trim()}
                className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
              >
                {loading ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
