'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckSquare, Square, History, X } from 'lucide-react';
import { getNoteColor } from '@/lib/notes-colors';
import { format } from 'date-fns';

interface NoteVersionDetailClientProps {
  version: {
    id: string;
    noteId: string;
    versionNumber: number;
    isCurrent: boolean;
    title: string;
    noteType: string;
    content: string | null;
    checklistItems: any;
    color: string;
    visibility: string;
    editedById: string;
    editedByName: string;
    editedAt: string;
  };
}

export default function NoteVersionDetailClient({ version }: NoteVersionDetailClientProps) {
  const router = useRouter();
  const currentColor = getNoteColor(version.color);

  const formattedDate = React.useMemo(() => {
    try {
      return format(new Date(version.editedAt), 'd MMM yyyy, h:mm a');
    } catch {
      return '';
    }
  }, [version.editedAt]);

  const checklistArray = Array.isArray(version.checklistItems) ? version.checklistItems : [];

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
              onClick={() => router.push(`/mobile/notes/${version.noteId}/history`)}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white"
              aria-label="Back to history"
            >
              <ArrowLeft size={22} />
            </button>
            <span className="font-bold tracking-tight text-lg">
              Version {version.versionNumber}
            </span>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/mobile/notes/${version.noteId}/history`)}
            className="p-2 rounded-full hover:bg-white/10 text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Read-Only Notice Banner */}
      <div className="bg-slate-900/10 backdrop-blur-xs border-b border-black/5 px-4 py-2 flex items-center justify-between text-xs text-slate-800 font-semibold">
        <div className="flex items-center gap-1.5">
          <History size={14} className="text-slate-600" />
          <span>Historical Version Snapshot (Read-Only)</span>
        </div>
        {version.isCurrent && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
            Current
          </span>
        )}
      </div>

      {/* Main Snapshot Content */}
      <main className="flex-1 px-5 py-6 max-w-[430px] mx-auto w-full flex flex-col pb-24">
        {/* Title */}
        <h1
          className="text-2xl font-bold tracking-tight mb-2 leading-tight"
          style={{ color: currentColor.text }}
        >
          {version.title}
        </h1>

        {/* Metadata */}
        <div className="flex flex-col gap-0.5 text-xs text-slate-500 mb-6 pb-4 border-b border-black/8">
          <div>
            {version.versionNumber === 1 ? 'Created by' : 'Edited by'}{' '}
            <strong className="text-slate-700">{version.editedByName}</strong> on {formattedDate}
          </div>
        </div>

        {/* Body / Checklist */}
        <div className="flex-1 mb-8">
          {version.noteType === 'CHECKLIST' ? (
            <div className="flex flex-col gap-2">
              {checklistArray.map((item: any, idx: number) => (
                <div key={item.id || idx} className="flex items-start gap-2.5 py-1 text-sm font-medium">
                  <div className="shrink-0 mt-0.5 text-slate-400">
                    {item.isChecked ? (
                      <CheckSquare size={19} className="text-[#16a34a]" />
                    ) : (
                      <Square size={19} className="text-slate-400" />
                    )}
                  </div>
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
              {version.content}
            </p>
          )}
        </div>

        {/* Bottom Close Button */}
        <div className="mt-auto pt-4 flex items-center justify-center">
          <button
            type="button"
            onClick={() => router.push(`/mobile/notes/${version.noteId}/history`)}
            className="px-6 py-2.5 rounded-full bg-[#1A2766] text-white text-sm font-bold shadow-md active:scale-95 transition-transform"
          >
            Close Snapshot
          </button>
        </div>
      </main>
    </div>
  );
}
