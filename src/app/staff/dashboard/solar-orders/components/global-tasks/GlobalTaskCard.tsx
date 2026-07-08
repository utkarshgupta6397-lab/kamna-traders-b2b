'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, MessageSquare, Clock, AlertTriangle, Phone, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import SnoozeModal from './SnoozeModal';
import { useGlobalTaskDrawer } from './GlobalTaskDrawerProvider';

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  const formatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return formatter.format(d).replace(/ /g, '-');
}

interface GlobalTaskCardProps {
  task: any;
  currentUserId: string;
  onRefresh: () => void;
}

export default function GlobalTaskCard({ task, currentUserId, onRefresh }: GlobalTaskCardProps) {
  const router = useRouter();
  const { closeDrawer } = useGlobalTaskDrawer();
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [expanded, setExpanded] = useState(task.status === 'PENDING');

  const now = new Date();
  const dueDate = new Date(task.dueDate);
  const isOverdue = task.status === 'PENDING' && dueDate < new Date(now.setHours(0,0,0,0));

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/solar-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' })
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await fetch(`/api/solar-tasks/${task.id}/follow-ups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: commentText })
      });
      setCommentText('');
      setIsCommentOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleOpenOrder = () => {
    closeDrawer();
    router.push(`/staff/dashboard/solar-orders/orders/${task.solarOrder.id}`);
  };

  if (task.status === 'COMPLETED' && !expanded) {
    return (
      <div 
        onClick={() => setExpanded(true)}
        className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-colors"
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 text-gray-500">
            <Check size={14} className="text-green-500" />
            <span className="text-sm font-medium line-through">{task.title}</span>
          </div>
          <p className="text-[10px] text-gray-400 pl-6">
            {task.solarOrder?.customerName} ({task.solarOrder?.orderNumber})
          </p>
        </div>
        <ChevronDown size={14} className="text-gray-400" />
      </div>
    );
  }

  return (
    <div className={`bg-white border rounded-lg shadow-sm overflow-hidden transition-all ${isOverdue ? 'border-red-300' : 'border-gray-200'}`}>
      {/* Card Header */}
      <div className={`px-4 py-3 border-b ${isOverdue ? 'bg-red-50/30 border-red-100' : 'border-gray-100'}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {isOverdue && <AlertTriangle size={14} className="text-red-500" />}
            {!isOverdue && task.title.toLowerCase().includes('call') && <Phone size={14} className="text-gray-400" />}
            <h3 className={`text-sm font-bold ${task.status === 'COMPLETED' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
              {task.title}
            </h3>
          </div>
          {task.status === 'COMPLETED' && (
            <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-600">
              <ChevronUp size={14} />
            </button>
          )}
        </div>
        {isOverdue && (
          <p className="text-[10px] font-bold text-red-600 uppercase mt-1 tracking-wider">
            Overdue
          </p>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-4">
        
        {/* Order Context */}
        <div className="flex items-center justify-between bg-blue-50/50 border border-blue-100 rounded p-2">
          <div>
            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-0.5">Order Details</p>
            <p className="text-xs font-semibold text-gray-800">{task.solarOrder?.customerName}</p>
            <p className="text-[10px] text-gray-500">{task.solarOrder?.orderNumber}</p>
          </div>
          <button
            onClick={handleOpenOrder}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 rounded text-[11px] font-semibold hover:bg-blue-50 transition-colors shadow-sm"
          >
            Open Order <ExternalLink size={12} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Assigned</p>
            <p className="text-xs font-medium text-gray-800">{task.assignedTo?.name || 'Unassigned'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Due Date</p>
            <p className={`text-xs font-medium ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-800'}`}>
              {formatDate(dueDate)}
              {task.dueTime ? ` at ${task.dueTime}` : ''}
            </p>
          </div>
          {task.latestUpdate && (
            <div className="col-span-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Latest Update</p>
              <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded border border-gray-100 italic">
                "{task.latestUpdate}"
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => setIsCommentOpen(!isCommentOpen)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded text-xs font-semibold transition-colors border border-gray-200"
          >
            <MessageSquare size={12} /> Comment
          </button>
          
          {task.status !== 'COMPLETED' && (
            <button
              onClick={() => setIsSnoozeOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded text-xs font-semibold transition-colors border border-gray-200"
            >
              <Clock size={12} /> Snooze
            </button>
          )}

          <button
            onClick={handleComplete}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition-colors border ${
              task.status === 'COMPLETED' 
                ? 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100' 
                : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
            }`}
          >
            <Check size={12} /> {task.status === 'COMPLETED' ? 'Reopen' : 'Complete'}
          </button>
        </div>

        {/* Comment Area */}
        {isCommentOpen && (
          <div className="pt-2 animate-in slide-in-from-top-2 duration-200">
            <textarea
              className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none"
              rows={2}
              placeholder="Add a follow-up comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <div className="flex justify-end mt-2 gap-2">
              <button 
                onClick={() => setIsCommentOpen(false)}
                className="px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button 
                onClick={handlePostComment}
                disabled={submittingComment || !commentText.trim()}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium disabled:opacity-50"
              >
                {submittingComment ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {isSnoozeOpen && (
        <SnoozeModal 
          task={task} 
          onClose={() => setIsSnoozeOpen(false)} 
          onSuccess={() => {
            setIsSnoozeOpen(false);
            onRefresh();
          }} 
        />
      )}
    </div>
  );
}
