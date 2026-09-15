'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Search, Bell, X, CheckCircle2, RotateCw } from 'lucide-react';
import NoteCard, { NoteCardData } from './NoteCard';
import NotesEmptyState from './NotesEmptyState';
import toast from 'react-hot-toast';

interface NotesListingClientProps {
  permissions: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canArchive: boolean;
  };
  currentUser: {
    id: string;
    name: string;
  };
}

export default function NotesListingClient({
  permissions,
  currentUser,
}: NotesListingClientProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'my' | 'shared' | 'archived'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState<NoteCardData[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<NoteCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Notification state
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  const fetchNotes = useCallback(async (isSilentRefresh = false) => {
    if (!isSilentRefresh) {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams();
      params.set('filter', filter);
      if (searchTerm.trim()) {
        params.set('q', searchTerm.trim());
      }

      const res = await fetch(`/api/mobile/notes?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setNotes(json.data || []);
        setPinnedNotes(json.pinnedNotes || []);
      } else {
        toast.error(json.error || "Couldn't refresh notes. Please try again.");
      }
    } catch (err) {
      console.error('[Notes Listing]', err);
      toast.error("Couldn't refresh notes. Please try again.");
    } finally {
      if (!isSilentRefresh) {
        setLoading(false);
      }
    }
  }, [filter, searchTerm]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([fetchNotes(true), fetchNotifications()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/mobile/notes/notifications');
      const json = await res.json();
      if (json.success) {
        setUnreadNotifications(json.unreadCount || 0);
        setNotifications(json.data || []);
      }
    } catch (err) {
      console.warn('Failed to load notifications', err);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleTogglePin = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic update
    const isCurrentlyPinned = pinnedNotes.some((n) => n.id === id);

    if (isCurrentlyPinned) {
      const unpinnedItem = pinnedNotes.find((n) => n.id === id);
      if (unpinnedItem) {
        setPinnedNotes((prev) => prev.filter((n) => n.id !== id));
        setNotes((prev) => [{ ...unpinnedItem, isPinned: false }, ...prev]);
      }
    } else {
      const newlyPinnedItem = notes.find((n) => n.id === id);
      if (newlyPinnedItem) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        setPinnedNotes((prev) => [{ ...newlyPinnedItem, isPinned: true }, ...prev]);
      }
    }

    try {
      const res = await fetch(`/api/mobile/notes/${id}/pin`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) {
        // Revert on failure
        fetchNotes();
      }
    } catch (err) {
      fetchNotes();
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await fetch('/api/mobile/notes/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadNotifications(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const hasPinned = filter !== 'archived' && pinnedNotes.length > 0;
  const hasNoNotesAtAll = !loading && notes.length === 0 && pinnedNotes.length === 0;

  return (
    <div className="flex-1 flex flex-col font-sans bg-[#F8F9FB] min-h-screen">
      {/* Sticky Mobile Header */}
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-4 min-h-[56px] py-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/mobile')}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white"
              aria-label="Back to home"
            >
              <ArrowLeft size={22} />
            </button>
            <span className="font-bold tracking-tight text-lg">Notes</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white/90 disabled:opacity-50"
              aria-label="Refresh notes"
            >
              <RotateCw size={19} className={isRefreshing ? 'animate-spin' : ''} />
            </button>

            {/* Notifications Bell */}
            <button
              type="button"
              onClick={() => setShowNotificationModal(true)}
              className="relative p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white/90"
              aria-label="View notifications"
            >
              <Bell size={20} />
              {unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-[#1A2766]" />
              )}
            </button>

            {/* Create Button */}
            {permissions.canCreate && (
              <Link
                href="/mobile/notes/create"
                className="flex items-center justify-center w-9 h-9 rounded-full bg-white text-[#1A2766] shadow-sm active:scale-90 transition-transform font-bold"
                aria-label="Create note"
              >
                <Plus size={20} strokeWidth={2.5} />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-4 max-w-[430px] mx-auto w-full flex flex-col pb-24">
        {/* Search Bar */}
        <div className="relative mb-3.5">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notes..."
            className="w-full bg-white pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200/80 shadow-xs text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#1A2766] focus:ring-1 focus:ring-[#1A2766]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-0.5 no-scrollbar -mx-4 px-4">
          {[
            { id: 'all', label: 'All Notes' },
            { id: 'my', label: 'My Notes' },
            { id: 'shared', label: 'Shared with Me' },
            { id: 'archived', label: 'Archived' },
          ].map((tab) => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as any)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-tight transition-all active:scale-95 ${
                  isActive
                    ? 'bg-[#1A2766] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-2 gap-3 mt-2 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-36 rounded-[22px] bg-white border border-slate-100 p-4 flex flex-col justify-between shadow-xs"
              >
                <div className="h-4 w-3/4 bg-slate-200 rounded-md" />
                <div className="flex flex-col gap-1.5 my-auto">
                  <div className="h-3 w-full bg-slate-100 rounded-md" />
                  <div className="h-3 w-4/5 bg-slate-100 rounded-md" />
                </div>
                <div className="h-3 w-1/2 bg-slate-200 rounded-md" />
              </div>
            ))}
          </div>
        )}

        {/* Empty States */}
        {!loading && hasNoNotesAtAll && (
          <NotesEmptyState
            type={searchTerm ? 'search' : filter}
            canCreate={permissions.canCreate}
          />
        )}

        {/* Pinned Section */}
        {!loading && hasPinned && (
          <div className="mb-5">
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
              Pinned
            </div>
            <div className="grid grid-cols-2 gap-3">
              {pinnedNotes.map((note) => (
                <NoteCard key={note.id} note={note} onTogglePin={handleTogglePin} />
              ))}
            </div>
          </div>
        )}

        {/* All / Filtered Notes Section */}
        {!loading && notes.length > 0 && (
          <div>
            {hasPinned && (
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                Others
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onTogglePin={filter !== 'archived' ? handleTogglePin : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Notifications Modal / Bottom Sheet */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-xs p-0 sm:p-4">
          <div className="bg-white w-full max-w-[430px] rounded-t-[28px] sm:rounded-[28px] max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-[#1A2766]" />
                <h3 className="font-bold text-base text-[#1A2766]">Notifications</h3>
              </div>
              <div className="flex items-center gap-2">
                {unreadNotifications > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsRead}
                    className="text-xs font-semibold text-[#2563eb] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNotificationModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-50">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      setShowNotificationModal(false);
                      if (n.referenceId) router.push(`/mobile/notes/${n.referenceId}`);
                    }}
                    className={`p-3 rounded-xl flex items-start gap-3 cursor-pointer transition-colors ${
                      !n.isRead ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#1A2766]/10 text-[#1A2766] flex items-center justify-center shrink-0 mt-0.5">
                      <Bell size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-800">{n.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5 leading-snug">{n.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(n.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
