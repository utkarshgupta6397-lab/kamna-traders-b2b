'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, History, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export interface VersionSummary {
  id: string;
  versionNumber: number;
  isCurrent: boolean;
  title: string;
  noteType: string;
  color: string;
  editedById: string;
  editedByName: string;
  editedAt: string;
}

interface NoteHistoryClientProps {
  noteId: string;
  versions: VersionSummary[];
  currentVersionNumber: number;
}

export default function NoteHistoryClient({
  noteId,
  versions,
  currentVersionNumber,
}: NoteHistoryClientProps) {
  const router = useRouter();

  return (
    <div className="flex-1 flex flex-col font-sans bg-[#F8F9FB] min-h-screen">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#1A2766] text-white shadow-md pt-[env(safe-area-inset-top)] shrink-0">
        <div className="flex items-center justify-between px-4 min-h-[56px] py-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/mobile/notes/${noteId}`)}
              className="p-1.5 -ml-1.5 rounded-full hover:bg-white/10 active:scale-95 transition-all text-white"
              aria-label="Back to note"
            >
              <ArrowLeft size={22} />
            </button>
            <span className="font-bold tracking-tight text-lg">Version History</span>
          </div>
        </div>
      </header>

      {/* Main Timeline Body */}
      <main className="flex-1 px-4 py-6 max-w-[430px] mx-auto w-full flex flex-col pb-24">
        <div className="mb-4 px-1">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
            All Edit Versions ({versions.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every content update is saved as an immutable version snapshot.
          </p>
        </div>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
          {versions.map((ver) => {
            let formattedDate = '';
            try {
              formattedDate = format(new Date(ver.editedAt), 'd MMM yyyy, h:mm a');
            } catch {}

            const isCurrent = ver.versionNumber === currentVersionNumber;

            return (
              <div key={ver.id} className="relative group">
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-6 top-3.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isCurrent
                      ? 'bg-[#1A2766] border-[#1A2766] text-white'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-white' : 'bg-slate-300'}`} />
                </div>

                {/* Version Card */}
                <Link
                  href={`/mobile/notes/${noteId}/history/${ver.versionNumber}`}
                  className="block p-4 rounded-2xl bg-white border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:border-slate-300 active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#1A2766]">
                        Version {ver.versionNumber}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                          Current
                        </span>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>

                  <div className="text-xs font-semibold text-slate-700 truncate mb-1">
                    {ver.title}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {ver.versionNumber === 1 ? 'Created by' : 'Edited by'}{' '}
                      <strong className="text-slate-600">{ver.editedByName}</strong>
                    </span>
                    <span>{formattedDate}</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
