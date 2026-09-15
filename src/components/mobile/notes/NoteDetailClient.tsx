'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit2,
  Share2,
  History,
  Archive,
  Pin,
  MoreVertical,
  Users,
  Globe,
  Lock,
  ArchiveRestore,
  CheckSquare,
  Square,
} from 'lucide-react';
import { getNoteColor } from '@/lib/notes-colors';
import UserPickerModal from './UserPickerModal';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

interface NoteDetailClientProps {
  note: {
    id: string;
    title: string;
    noteType: string;
    content: string | null;
    checklistItems: any;
    color: string;
    visibility: string;
    isArchived: boolean;
    archivedAt: string | null;
    archivedByName: string | null;
    version: number;
    isPinned: boolean;
    createdById: string;
    createdByName: string;
    createdAt: string;
    updatedById: string;
    updatedByName: string;
    updatedAt: string;
    shares: Array<{ userId: string; name: string }>;
  };
  permissions: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canArchive: boolean;
  };
  currentUserId: string;
}

export default function NoteDetailClient({
  note: initialNote,
  permissions,
  currentUserId,
}: NoteDetailClientProps) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote);
  const [isPinned, setIsPinned] = useState(initialNote.isPinned);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const currentColor = getNoteColor(note.color);

  const formattedCreated = React.useMemo(() => {
    try {
      return format(new Date(note.createdAt), 'd MMM yyyy, h:mm a');
    } catch {
      return '';
    }
  }, [note.createdAt]);

  const formattedUpdated = React.useMemo(() => {
    try {
      return format(new Date(note.updatedAt), 'd MMM yyyy, h:mm a');
    } catch {
      return '';
    }
  }, [note.updatedAt]);

  const handleTogglePin = async () => {
    const nextPin = !isPinned;
    setIsPinned(nextPin);
    try {
      await fetch(`/api/mobile/notes/${note.id}/pin`, { method: 'POST' });
    } catch (err) {
      setIsPinned(!nextPin);
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      const res = await fetch(`/api/mobile/notes/${note.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unarchive: note.isArchived }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(note.isArchived ? 'Note unarchived' : 'Note archived');
        router.push('/mobile/notes');
        router.refresh();
      } else {
        toast.error(json.error || 'Failed to archive');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setIsArchiving(false);
      setShowArchiveConfirm(false);
    }
  };

  const handleChecklistToggle = async (index: number) => {
    if (!permissions.canEdit || note.isArchived) return;

    const currentItems = Array.isArray(note.checklistItems) ? [...note.checklistItems] : [];
    if (!currentItems[index]) return;

    currentItems[index] = {
      ...currentItems[index],
      isChecked: !currentItems[index].isChecked,
    };

    // Optimistic
    setNote((prev) => ({ ...prev, checklistItems: currentItems }));

    try {
      const res = await fetch(`/api/mobile/notes/${note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklistItems: currentItems,
          expectedVersion: note.version,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setNote((prev) => ({
          ...prev,
          version: json.data.version,
          updatedAt: json.data.updatedAt,
          updatedByName: json.data.updatedBy?.name || prev.updatedByName,
        }));
      }
    } catch (err) {
      console.error('Failed to toggle checklist', err);
    }
  };

  const handleSaveShares = async (userIds: string[]) => {
    try {
      const res = await fetch(`/api/mobile/notes/${note.id}/share`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility: userIds.length > 0 ? 'SELECTED_USERS' : 'ONLY_ME',
          selectedUserIds: userIds,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setNote((prev) => ({
          ...prev,
          visibility: json.data.visibility,
          shares: json.data.shares.map((s: any) => ({
            userId: s.userId,
            name: s.user?.name || 'Staff',
          })),
        }));
        toast.success('Sharing updated');
      }
    } catch (err) {
      toast.error('Failed to update sharing');
    }
  };

  const checklistArray = Array.isArray(note.checklistItems) ? note.checklistItems : [];

  return (
    <div
      className="flex-1 flex flex-col font-sans min-h-screen transition-colors duration-200"
      style={{ backgroundColor: currentColor.bg }}
    >
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-4 min-h-[56px] py-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/mobile/notes')}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white"
              aria-label="Back to notes"
            >
              <ArrowLeft size={22} />
            </button>
            <span className="font-bold tracking-tight text-lg">Note Detail</span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Pin / Unpin Button */}
            {!note.isArchived && (
              <button
                type="button"
                onClick={handleTogglePin}
                className="p-2 rounded-full hover:bg-white/10 active:scale-90 transition-transform text-white"
                title={isPinned ? 'Unpin note' : 'Pin note'}
              >
                <Pin size={19} className={isPinned ? 'fill-white text-white' : 'text-white/80'} />
              </button>
            )}

            {/* Edit Button */}
            {permissions.canEdit && !note.isArchived && (
              <Link
                href={`/mobile/notes/${note.id}/edit`}
                className="p-2 rounded-full hover:bg-white/10 active:scale-90 transition-transform text-white"
                title="Edit note"
              >
                <Edit2 size={19} />
              </Link>
            )}

            {/* Overflow Options Button */}
            <button
              type="button"
              onClick={() => setShowActionSheet(true)}
              className="p-2 rounded-full hover:bg-white/10 active:scale-90 transition-transform text-white"
              title="More options"
            >
              <MoreVertical size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Archived Banner */}
      {note.isArchived && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-900 font-semibold">
          <span>This note is archived (Read-only)</span>
          {permissions.canArchive && (
            <button
              type="button"
              onClick={() => setShowArchiveConfirm(true)}
              className="underline font-bold"
            >
              Restore
            </button>
          )}
        </div>
      )}

      {/* Note Content Container */}
      <main className="flex-1 px-5 py-6 max-w-[430px] mx-auto w-full flex flex-col pb-28">
        {/* Title */}
        <h1
          className="text-2xl font-bold tracking-tight mb-2 leading-tight"
          style={{ color: currentColor.text }}
        >
          {note.title}
        </h1>

        {/* Metadata Bar */}
        <div className="flex flex-col gap-0.5 text-xs text-slate-500 mb-6 pb-4 border-b border-black/8">
          <div>
            Created by <strong className="text-slate-700">{note.createdByName}</strong> on{' '}
            {formattedCreated}
          </div>
          {note.updatedAt && (
            <div className="text-[11px] text-slate-400">
              Last updated by <strong className="text-slate-600">{note.updatedByName}</strong> on{' '}
              {formattedUpdated}
            </div>
          )}
        </div>

        {/* Body Section */}
        <div className="flex-1 mb-8">
          {note.noteType === 'CHECKLIST' ? (
            <div className="flex flex-col gap-2">
              {checklistArray.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="flex items-start gap-2.5 py-1 text-sm font-medium"
                >
                  <button
                    type="button"
                    disabled={!permissions.canEdit || note.isArchived}
                    onClick={() => handleChecklistToggle(idx)}
                    className="shrink-0 mt-0.5 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-80"
                  >
                    {item.isChecked ? (
                      <CheckSquare size={19} className="text-[#16a34a]" />
                    ) : (
                      <Square size={19} className="text-slate-400" />
                    )}
                  </button>
                  <span
                    className={`leading-normal ${
                      item.isChecked ? 'line-through text-slate-400' : ''
                    }`}
                    style={{ color: item.isChecked ? undefined : currentColor.text }}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p
              className="text-sm font-normal leading-relaxed whitespace-pre-wrap"
              style={{ color: currentColor.text, opacity: 0.95 }}
            >
              {note.content}
            </p>
          )}
        </div>

        {/* Sharing Details Footer */}
        <div className="mt-auto pt-4 border-t border-black/8 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            {note.visibility === 'ALL_USERS' ? (
              <>
                <Globe size={15} className="text-blue-600" />
                <span>Visible to all users</span>
              </>
            ) : note.visibility === 'SELECTED_USERS' ? (
              <>
                <Users size={15} className="text-blue-600" />
                <span>Shared with {note.shares.length} user{note.shares.length === 1 ? '' : 's'}</span>
              </>
            ) : (
              <>
                <Lock size={15} className="text-slate-500" />
                <span>Only you</span>
              </>
            )}
          </div>

          <Link
            href={`/mobile/notes/${note.id}/history`}
            className="flex items-center gap-1 font-bold text-[#1A2766] hover:underline"
          >
            <History size={14} />
            <span>v{note.version} History</span>
          </Link>
        </div>
      </main>

      {/* Action Sheet (Bottom Drawer) */}
      {showActionSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs p-0 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-[430px] rounded-t-[28px] p-5 shadow-2xl flex flex-col gap-2 animate-in slide-in-from-bottom-5">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />

            <button
              type="button"
              onClick={() => {
                setShowActionSheet(false);
                handleTogglePin();
              }}
              className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors"
            >
              <Pin size={18} className={isPinned ? 'fill-[#1A2766] text-[#1A2766]' : ''} />
              <span>{isPinned ? 'Unpin Note' : 'Pin to Top'}</span>
            </button>

            {permissions.canEdit && !note.isArchived && (
              <button
                type="button"
                onClick={() => {
                  setShowActionSheet(false);
                  setShowShareModal(true);
                }}
                className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors"
              >
                <Share2 size={18} />
                <span>Share Note</span>
              </button>
            )}

            <Link
              href={`/mobile/notes/${note.id}/history`}
              onClick={() => setShowActionSheet(false)}
              className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors"
            >
              <History size={18} />
              <span>View Version History</span>
            </Link>

            {permissions.canArchive && (
              <button
                type="button"
                onClick={() => {
                  setShowActionSheet(false);
                  setShowArchiveConfirm(true);
                }}
                className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-red-50 text-red-600 font-semibold text-sm transition-colors"
              >
                <Archive size={18} />
                <span>{note.isArchived ? 'Unarchive Note' : 'Archive Note'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowActionSheet(false)}
              className="mt-2 w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[24px] p-6 max-w-xs w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-3">
              <Archive size={24} />
            </div>
            <h3 className="font-bold text-base text-slate-900">
              {note.isArchived ? 'Restore this note?' : 'Archive this note?'}
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {note.isArchived
                ? 'This note will return to active Notes.'
                : 'This note will be removed from active Notes but its history will be preserved.'}
            </p>
            <div className="flex items-center gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(false)}
                disabled={isArchiving}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={isArchiving}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isArchiving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{note.isArchived ? 'Restoring...' : 'Archiving...'}</span>
                  </>
                ) : (
                  <span>{note.isArchived ? 'Restore' : 'Archive'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <UserPickerModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        selectedUserIds={note.shares.map((s) => s.userId)}
        onConfirm={handleSaveShares}
      />
    </div>
  );
}
