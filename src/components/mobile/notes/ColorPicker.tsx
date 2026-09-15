'use client';

import React from 'react';
import { NOTE_COLORS } from '@/lib/notes-colors';
import { Check } from 'lucide-react';

interface ColorPickerProps {
  selectedColorId: string;
  onSelectColor: (colorId: string) => void;
}

export default function ColorPicker({ selectedColorId, onSelectColor }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
        Note Color
      </label>
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-1 px-1">
        {NOTE_COLORS.map((color) => {
          const isSelected = selectedColorId === color.id;
          return (
            <button
              key={color.id}
              type="button"
              onClick={() => onSelectColor(color.id)}
              className="relative shrink-0 w-9 h-9 rounded-full transition-transform active:scale-90 flex items-center justify-center shadow-xs"
              style={{
                backgroundColor: color.bg,
                border: `2px solid ${isSelected ? color.previewBorder : color.border}`,
              }}
              title={color.name}
              aria-label={`Select ${color.name}`}
            >
              {isSelected && (
                <Check
                  size={16}
                  strokeWidth={2.5}
                  style={{ color: color.text }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
