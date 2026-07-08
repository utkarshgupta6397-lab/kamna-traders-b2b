'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import { useGlobalTaskDrawer } from './GlobalTaskDrawerProvider';
import GlobalTaskCard from './GlobalTaskCard';

interface GlobalTaskDrawerProps {
  currentUserId: string;
}

export default function GlobalTaskDrawer({ currentUserId }: GlobalTaskDrawerProps) {
  const { isOpen, closeDrawer, openNewTaskModal } = useGlobalTaskDrawer();
  const [filter, setFilter] = useState<'ALL' | 'MINE' | 'TODAY' | 'OVERDUE' | 'COMPLETED'>('ALL');
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const fetchTasks = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/solar-tasks?filter=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        if (data.users) setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to load global tasks', error);
    } finally {
      setLoading(false);
    }
  }, [isOpen, filter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 z-[100] transition-opacity backdrop-blur-sm"
        onClick={closeDrawer}
      />
      
      <div className="fixed top-0 right-0 h-full w-full max-w-[540px] bg-white shadow-2xl z-[101] flex flex-col transform transition-transform duration-300 ease-in-out border-l border-gray-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#1A2766] text-white">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold">My Task Inbox</h2>
          </div>
          <button 
            onClick={closeDrawer}
            className="p-2 -mr-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action & Filter Bar */}
        <div className="p-4 bg-white border-b border-gray-100 shadow-sm z-10 sticky top-0">
          <button
            onClick={() => openNewTaskModal()}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-semibold text-sm transition-colors mb-4 shadow-sm"
          >
            <Plus size={16} /> New Task
          </button>

          <div className="flex flex-wrap gap-2">
            {['ALL', 'MINE', 'TODAY', 'OVERDUE', 'COMPLETED'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === f
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50/30 p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center text-gray-400 py-10">
              <Loader2 className="animate-spin mb-4" size={24} />
              <p className="text-sm">Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              No tasks found for this filter.
            </div>
          ) : (
            tasks.map((task) => (
              <GlobalTaskCard 
                key={task.id} 
                task={task} 
                currentUserId={currentUserId}
                onRefresh={fetchTasks} 
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
