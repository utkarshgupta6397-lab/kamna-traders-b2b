'use client';

import { useState } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function OrderDateEditor({
  orderId,
  currentDate,
  canEdit
}: {
  orderId: string;
  currentDate: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDate, setNewDate] = useState(() => {
    try {
      return new Date(currentDate).toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  });

  const today = new Date().toISOString().split('T')[0];
  const maxPastDate = new Date();
  maxPastDate.setDate(maxPastDate.getDate() - 365);
  const minDateStr = maxPastDate.toISOString().split('T')[0];

  const handleSave = async () => {
    if (!newDate) {
      toast.error('Date is required');
      return;
    }
    if (newDate > today) {
      toast.error('Cannot be in the future');
      return;
    }
    if (newDate < minDateStr) {
      toast.error('Cannot be older than one year');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/order-date`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderDate: newDate })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Order date updated successfully');
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(data.error || 'Failed to update date');
      }
    } catch (e) {
      toast.error('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const displayDate = new Date(currentDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900">{displayDate}</span>
        {canEdit && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit Order Date"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={newDate}
        max={today}
        min={minDateStr}
        onChange={(e) => setNewDate(e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
        disabled={loading}
      />
      <button
        onClick={handleSave}
        disabled={loading}
        className="text-green-600 hover:text-green-700 bg-green-50 p-1.5 rounded disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
      </button>
      <button
        onClick={() => {
          setIsEditing(false);
          try {
            setNewDate(new Date(currentDate).toISOString().split('T')[0]);
          } catch {}
        }}
        disabled={loading}
        className="text-red-600 hover:text-red-700 bg-red-50 p-1.5 rounded disabled:opacity-50"
      >
        <X size={14} />
      </button>
    </div>
  );
}
