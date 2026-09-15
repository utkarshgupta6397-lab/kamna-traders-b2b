'use client';

import React from 'react';
import Link from 'next/link';
import { getNoteColor } from '@/lib/notes-colors';
import { Pin, Users, Globe, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';

export interface NoteCardData {
  id: string;
  title: string;
  noteType: string;
  contentPreview?: string;
  checklistPreview?: Array<{ id: string; text: string; isChecked: boolean }>;
  totalChecklistItems?: number;
  color: string;
  visibility: string;
  isArchived: boolean;
  isPinned: boolean;
  version: number;
  shareCount: number;
  createdById: string;
  createdByName: string;
  createdAt: string | Date;
  updatedById: string;
  updatedByName: string;
  updatedAt: string | Date;
}

interface NoteCardProps {
  note: NoteCardData;
  onTogglePin?: (id: string, e: React.MouseEvent) => void;
}

export default function NoteCard({ note, onTogglePin }: NoteCardProps) {
  const color = getNoteColor(note.color);

  const formattedDate = React.useMemo(() => {
    try {
      const date = new Date(note.updatedAt);
      return format(date, 'd MMM, h:mm a');
    } catch {
      return '';
    }
  }, [note.updatedAt]);

  const creatorShortName = note.createdByName?.split(' ')[0] || 'Staff';

  return (
    <Link
      href={`/mobile/notes/${note.id}`}
      className="group relative flex flex-col rounded-[22px] p-4 text-left transition-all active:scale-[0.97] shadow-[0_2px_10px_rgba(0,0,0,0.03)] border"
      style={{
        backgroundColor: color.bg,
        borderColor: color.border,
      }}
    >
      {/* Top row: Title and Pin */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3
          className="font-bold text-[15px] leading-tight tracking-tight line-clamp-2"
          style={{ color: color.text }}
        >
          {note.title}
        </h3>

        {onTogglePin && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePin(note.id, e);
            }}
            className={`shrink-0 p-1 rounded-full transition-colors ${
              note.isPinned
                ? 'text-[#1A2766] opacity-100'
                : 'text-slate-400 opacity-30 hover:opacity-100'
            }`}
            title={note.isPinned ? 'Unpin note' : 'Pin note'}
            aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
          >
            <Pin
              size={16}
              className={note.isPinned ? 'fill-[#1A2766] text-[#1A2766]' : ''}
            />
          </button>
        )}
      </div>

      {/* Content Preview */}
      <div className="flex-1 mb-3">
        {note.noteType === 'CHECKLIST' && note.checklistPreview ? (
          <div className="flex flex-col gap-1">
            {note.checklistPreview.slice(0, 3).map((item, idx) => (
              <div key={item.id || idx} className="flex items-center gap-1.5 text-xs">
                {item.isChecked ? (
                  <CheckSquare size={13} className="shrink-0 text-emerald-600" />
                ) : (
                  <Square size={13} className="shrink-0 text-slate-400" />
                )}
                <span
                  className={`truncate leading-snug ${
                    item.isChecked ? 'line-through text-slate-400' : ''
                  }`}
                  style={{ color: item.isChecked ? undefined : color.text }}
                >
                  {item.text}
                </span>
              </div>
            ))}
            {(note.totalChecklistItems || 0) > 3 && (
              <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                +{(note.totalChecklistItems || 0) - 3} more items
              </span>
            )}
          </div>
        ) : (
          <p
            className="text-xs font-normal leading-relaxed line-clamp-4 whitespace-pre-wrap"
            style={{ color: color.text, opacity: 0.88 }}
          >
            {note.contentPreview || 'Empty note'}
          </p>
        )}
      </div>

      {/* Footer: Creator, date, sharing */}
      <div className="mt-auto pt-2 border-t border-black/5 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex flex-col truncate">
          <span className="font-semibold truncate" style={{ color: color.text }}>
            {creatorShortName}
          </span>
          <span className="text-[10px] text-slate-500 font-medium">
            {formattedDate}
          </span>
        </div>

        {/* Sharing indicator */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {note.visibility === 'ALL_USERS' && (
            <span
              className="p-1 rounded-md bg-black/5 text-slate-600"
              title="Visible to All Users"
            >
              <Globe size={13} />
            </span>
          )}
          {note.visibility === 'SELECTED_USERS' && note.shareCount > 0 && (
            <span
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/5 text-[10px] font-semibold text-slate-600"
              title={`Shared with ${note.shareCount} users`}
            >
              <Users size={12} />
              <span>{note.shareCount}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
