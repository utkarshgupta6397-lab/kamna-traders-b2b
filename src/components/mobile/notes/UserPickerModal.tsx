'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Check, Users, UserCheck } from 'lucide-react';

export interface EligibleUser {
  id: string;
  name: string;
  role: string;
}

interface UserPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUserIds: string[];
  onConfirm: (userIds: string[]) => void;
}

export default function UserPickerModal({
  isOpen,
  onClose,
  selectedUserIds,
  onConfirm,
}: UserPickerModalProps) {
  const [users, setUsers] = useState<EligibleUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedUserIds));

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(selectedUserIds));
      fetchUsers();
    }
  }, [isOpen, selectedUserIds]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mobile/notes/users');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setUsers(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch eligible users:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUser = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  };

  const handleDone = () => {
    onConfirm(Array.from(selected));
    onClose();
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[430px] rounded-t-[28px] sm:rounded-[28px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-[#1A2766]" />
            <h3 className="font-bold text-base text-[#1A2766]">
              Share with Selected Users ({selected.size})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 active:scale-90 transition-transform"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 bg-slate-50 border-b border-slate-100">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users..."
              className="w-full bg-white pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#1A2766]"
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-50">
          {loading ? (
            <div className="p-2 space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-28 bg-slate-200 rounded-md" />
                      <div className="h-2.5 w-16 bg-slate-100 rounded-md" />
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-lg bg-slate-100 shrink-0" />
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No matching users found
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isChecked = selected.has(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUser(user.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors ${
                    isChecked ? 'bg-blue-50/60' : 'hover:bg-slate-50 active:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#1A2766]/10 text-[#1A2766] font-bold text-xs flex items-center justify-center shrink-0">
                      {getInitials(user.name)}
                    </div>
                    <div className="truncate">
                      <div className="font-semibold text-sm text-slate-800 truncate">
                        {user.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {user.role}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                      isChecked
                        ? 'bg-[#1A2766] border-[#1A2766] text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check size={14} strokeWidth={2.5} />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white">
          <span className="text-xs font-semibold text-slate-500">
            {selected.size} user{selected.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="px-5 py-2 bg-[#1A2766] text-white text-sm font-bold rounded-full shadow-md active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
