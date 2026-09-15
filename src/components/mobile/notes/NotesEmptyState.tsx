'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

interface NotesEmptyStateProps {
  type: 'all' | 'my' | 'shared' | 'archived' | 'search';
  canCreate?: boolean;
}

export default function NotesEmptyState({ type, canCreate = false }: NotesEmptyStateProps) {
  let title = 'Nothing here yet';
  let description = 'Create a note to keep important information handy.';
  let showCreateButton = canCreate && (type === 'all' || type === 'my');

  if (type === 'search') {
    title = 'No notes found';
    description = 'Try a different search term.';
    showCreateButton = false;
  } else if (type === 'archived') {
    title = 'No archived notes';
    description = 'Notes you archive will be safely stored here.';
    showCreateButton = false;
  } else if (type === 'shared') {
    title = 'No shared notes';
    description = 'No notes have been shared with you yet.';
    showCreateButton = false;
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 flex items-center justify-center mb-4 text-slate-300">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      </div>

      <h3 className="text-base font-semibold text-[#1A2766] tracking-tight">{title}</h3>
      <p className="text-sm text-slate-400 mt-1 max-w-[260px] leading-relaxed">{description}</p>

      {showCreateButton && (
        <Link
          href="/mobile/notes/create"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1A2766] text-white text-sm font-semibold shadow-md active:scale-95 transition-all"
        >
          <Plus size={16} />
          <span>Create Note</span>
        </Link>
      )}
    </div>
  );
}
