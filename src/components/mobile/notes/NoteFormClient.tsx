'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Users, Globe, Lock, AlertCircle, Loader2 } from 'lucide-react';
import ColorPicker from './ColorPicker';
import ChecklistEditor, { ChecklistItemData } from './ChecklistEditor';
import UserPickerModal from './UserPickerModal';
import { getNoteColor } from '@/lib/notes-colors';
import toast from 'react-hot-toast';

interface NoteFormClientProps {
  mode: 'create' | 'edit';
  initialData?: {
    id?: string;
    title?: string;
    noteType?: string;
    content?: string;
    checklistItems?: ChecklistItemData[];
    color?: string;
    visibility?: string;
    version?: number;
    shares?: Array<{ userId: string; name?: string }>;
  };
}

export default function NoteFormClient({ mode, initialData }: NoteFormClientProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData?.title || '');
  const [noteType, setNoteType] = useState<'TEXT' | 'CHECKLIST'>(
    (initialData?.noteType as any) || 'TEXT'
  );
  const [content, setContent] = useState(initialData?.content || '');
  const [checklistItems, setChecklistItems] = useState<ChecklistItemData[]>(
    initialData?.checklistItems || [
      { id: '1', text: '', isChecked: false },
    ]
  );
  const [colorId, setColorId] = useState(initialData?.color || 'soft_yellow');
  const [visibility, setVisibility] = useState<'ONLY_ME' | 'SELECTED_USERS' | 'ALL_USERS'>(
    (initialData?.visibility as any) || 'ONLY_ME'
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    initialData?.shares?.map((s) => s.userId) || []
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showAllUsersConfirm, setShowAllUsersConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<'ONLY_ME' | 'SELECTED_USERS' | 'ALL_USERS' | null>(null);

  const currentColor = getNoteColor(colorId);

  // Compute dirty state
  const isDirty = React.useMemo(() => {
    if (mode === 'create') {
      const hasTitle = title.trim().length > 0;
      const hasContent = content.trim().length > 0;
      const hasChecklist = checklistItems.some((item) => item.text.trim().length > 0);
      return hasTitle || hasContent || hasChecklist;
    }

    // Edit mode: compare against initialData
    const initTitle = initialData?.title || '';
    const initType = initialData?.noteType || 'TEXT';
    const initContent = initialData?.content || '';
    const initColor = initialData?.color || 'soft_yellow';
    const initVisibility = initialData?.visibility || 'ONLY_ME';
    const initUserIds = (initialData?.shares?.map((s) => s.userId) || []).slice().sort().join(',');
    const currentUserIds = selectedUserIds.slice().sort().join(',');

    if (title !== initTitle) return true;
    if (noteType !== initType) return true;
    if (content !== initContent) return true;
    if (colorId !== initColor) return true;
    if (visibility !== initVisibility) return true;
    if (currentUserIds !== initUserIds) return true;

    // Compare checklist items
    const initItems = initialData?.checklistItems || [];
    if (checklistItems.length !== initItems.length) return true;
    for (let i = 0; i < checklistItems.length; i++) {
      if (
        checklistItems[i].text !== initItems[i]?.text ||
        checklistItems[i].isChecked !== initItems[i]?.isChecked
      ) {
        return true;
      }
    }

    return false;
  }, [mode, initialData, title, noteType, content, colorId, visibility, selectedUserIds, checklistItems]);

  const handleBack = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      router.back();
    }
  };

  const handleVisibilityChange = (newVisibility: 'ONLY_ME' | 'SELECTED_USERS' | 'ALL_USERS') => {
    if (newVisibility === 'ALL_USERS') {
      setPendingVisibility('ALL_USERS');
      setShowAllUsersConfirm(true);
    } else if (newVisibility === 'SELECTED_USERS') {
      setVisibility('SELECTED_USERS');
      setShowUserPicker(true);
    } else {
      setVisibility('ONLY_ME');
      setSelectedUserIds([]);
    }
  };

  const confirmAllUsers = () => {
    setVisibility('ALL_USERS');
    setSelectedUserIds([]);
    setShowAllUsersConfirm(false);
    setPendingVisibility(null);
  };

  const cancelAllUsers = () => {
    setShowAllUsersConfirm(false);
    setPendingVisibility(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Title is required');
      return;
    }

    if (noteType === 'TEXT' && !content.trim()) {
      toast.error('Note body cannot be empty');
      return;
    }

    const validChecklist = checklistItems.filter((item) => item.text.trim().length > 0);
    if (noteType === 'CHECKLIST' && validChecklist.length === 0) {
      toast.error('Checklist must have at least one valid item');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        const payload = {
          title: trimmedTitle,
          noteType,
          content: noteType === 'TEXT' ? content.trim() : null,
          checklistItems: noteType === 'CHECKLIST' ? validChecklist : null,
          color: colorId,
          visibility,
          selectedUserIds: visibility === 'SELECTED_USERS' ? selectedUserIds : [],
        };

        const res = await fetch('/api/mobile/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (json.success) {
          toast.success('Note created');
          router.push(`/mobile/notes/${json.data.id}`);
          router.refresh();
        } else {
          toast.error(json.error || "Couldn't save note. Please try again.");
        }
      } else {
        // Edit mode
        const payload = {
          title: trimmedTitle,
          noteType,
          content: noteType === 'TEXT' ? content.trim() : null,
          checklistItems: noteType === 'CHECKLIST' ? validChecklist : null,
          color: colorId,
          expectedVersion: initialData?.version,
        };

        const res = await fetch(`/api/mobile/notes/${initialData?.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json();

        if (res.status === 409) {
          toast.error(
            json.error ||
              'This note was updated by another user. Please reload the latest version before saving your changes.',
            { duration: 6000 }
          );
          setIsSubmitting(false);
          return;
        }

        if (json.success) {
          // If visibility changed, update sharing
          if (
            visibility !== initialData?.visibility ||
            (visibility === 'SELECTED_USERS' &&
              JSON.stringify(selectedUserIds.sort()) !==
                JSON.stringify((initialData?.shares?.map((s) => s.userId) || []).sort()))
          ) {
            await fetch(`/api/mobile/notes/${initialData?.id}/share`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                visibility,
                selectedUserIds: visibility === 'SELECTED_USERS' ? selectedUserIds : [],
              }),
            });
          }

          toast.success('Note updated');
          router.push(`/mobile/notes/${initialData?.id}`);
          router.refresh();
        } else {
          toast.error(json.error || "Couldn't save note. Please try again.");
        }
      }
    } catch (err) {
      console.error('[Note Save]', err);
      toast.error("Couldn't save note. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
              onClick={handleBack}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white"
              aria-label="Go back"
            >
              <ArrowLeft size={22} />
            </button>
            <span className="font-bold tracking-tight text-lg">
              {mode === 'create' ? 'Create Note' : 'Edit Note'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-[#1A2766] rounded-full font-bold text-xs shadow-sm active:scale-95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin text-[#1A2766]" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check size={15} strokeWidth={3} />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 px-4 py-5 max-w-[430px] mx-auto w-full flex flex-col pb-24">
        {/* Title Input */}
        <div className="mb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-transparent text-xl font-bold tracking-tight placeholder-slate-400/80 focus:outline-hidden py-1 border-b border-black/10 focus:border-[#1A2766]"
            style={{ color: currentColor.text }}
            maxLength={200}
            required
            autoFocus={mode === 'create'}
          />
        </div>

        {/* Note Type Toggle */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
            Type:
          </span>
          <button
            type="button"
            onClick={() => setNoteType('TEXT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              noteType === 'TEXT'
                ? 'bg-[#1A2766] text-white shadow-xs'
                : 'bg-white/70 text-slate-700 hover:bg-white'
            }`}
          >
            Text Note
          </button>
          <button
            type="button"
            onClick={() => setNoteType('CHECKLIST')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              noteType === 'CHECKLIST'
                ? 'bg-[#1A2766] text-white shadow-xs'
                : 'bg-white/70 text-slate-700 hover:bg-white'
            }`}
          >
            Checklist
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 mb-6 min-h-[160px]">
          {noteType === 'TEXT' ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Take a note..."
              className="w-full h-full min-h-[180px] bg-transparent text-sm leading-relaxed placeholder-slate-400/80 focus:outline-hidden resize-none py-1"
              style={{ color: currentColor.text }}
            />
          ) : (
            <ChecklistEditor
              items={checklistItems}
              onChange={setChecklistItems}
              textColor={currentColor.text}
            />
          )}
        </div>

        {/* Color Palette Selector */}
        <div className="mb-5 pt-3 border-t border-black/5">
          <ColorPicker selectedColorId={colorId} onSelectColor={setColorId} />
        </div>

        {/* Sharing Selector */}
        <div className="mb-6 pt-3 border-t border-black/5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
            Share with
          </label>
          <div className="grid grid-cols-3 gap-2">
            {/* Only Me */}
            <button
              type="button"
              onClick={() => handleVisibilityChange('ONLY_ME')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all active:scale-95 ${
                visibility === 'ONLY_ME'
                  ? 'bg-white border-[#1A2766] shadow-sm text-[#1A2766]'
                  : 'bg-white/50 border-black/5 text-slate-600 hover:bg-white'
              }`}
            >
              <Lock size={18} className="mb-1 text-slate-500" />
              <span className="text-xs font-bold">Only Me</span>
            </button>

            {/* Selected Users */}
            <button
              type="button"
              onClick={() => handleVisibilityChange('SELECTED_USERS')}
              className={`relative flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all active:scale-95 ${
                visibility === 'SELECTED_USERS'
                  ? 'bg-white border-[#1A2766] shadow-sm text-[#1A2766]'
                  : 'bg-white/50 border-black/5 text-slate-600 hover:bg-white'
              }`}
            >
              <Users size={18} className="mb-1 text-slate-500" />
              <span className="text-xs font-bold">Selected</span>
              {visibility === 'SELECTED_USERS' && (
                <span className="text-[10px] font-semibold text-blue-600 mt-0.5">
                  ({selectedUserIds.length})
                </span>
              )}
            </button>

            {/* All Users */}
            <button
              type="button"
              onClick={() => handleVisibilityChange('ALL_USERS')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all active:scale-95 ${
                visibility === 'ALL_USERS'
                  ? 'bg-white border-[#1A2766] shadow-sm text-[#1A2766]'
                  : 'bg-white/50 border-black/5 text-slate-600 hover:bg-white'
              }`}
            >
              <Globe size={18} className="mb-1 text-slate-500" />
              <span className="text-xs font-bold">All Users</span>
            </button>
          </div>

          {visibility === 'SELECTED_USERS' && selectedUserIds.length > 0 && (
            <div className="mt-2 flex items-center justify-between px-1 text-xs text-slate-600">
              <span>{selectedUserIds.length} users selected</span>
              <button
                type="button"
                onClick={() => setShowUserPicker(true)}
                className="font-bold text-[#1A2766] hover:underline"
              >
                Change
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Selected Users Picker Modal */}
      <UserPickerModal
        isOpen={showUserPicker}
        onClose={() => setShowUserPicker(false)}
        selectedUserIds={selectedUserIds}
        onConfirm={(userIds) => {
          setSelectedUserIds(userIds);
          if (userIds.length === 0) {
            setVisibility('ONLY_ME');
          }
        }}
      />

      {/* Confirmation Dialog: Share with Everyone */}
      {showAllUsersConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[24px] p-6 max-w-xs w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-3">
              <Globe size={24} />
            </div>
            <h3 className="font-bold text-base text-slate-900">Share with everyone?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              This note will become visible to all users with permission to view Notes.
            </p>
            <div className="flex items-center gap-2 mt-6">
              <button
                type="button"
                onClick={cancelAllUsers}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAllUsers}
                className="flex-1 py-2.5 rounded-xl bg-[#1A2766] text-white text-xs font-bold shadow-md hover:bg-[#152055] active:scale-95 transition-all"
              >
                Share with All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Discard Changes */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[24px] p-6 max-w-xs w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-3">
              <AlertCircle size={24} />
            </div>
            <h3 className="font-bold text-base text-slate-900">Discard changes?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              You have unsaved changes to this note. Are you sure you want to leave?
            </p>
            <div className="flex items-center gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  router.back();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md hover:bg-red-700 active:scale-95 transition-all"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
