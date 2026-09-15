'use client';

import React, { useState, useRef } from 'react';
import { Plus, X, CheckSquare, Square } from 'lucide-react';

export interface ChecklistItemData {
  id: string;
  text: string;
  isChecked: boolean;
}

interface ChecklistEditorProps {
  items: ChecklistItemData[];
  onChange: (items: ChecklistItemData[]) => void;
  textColor?: string;
  readOnly?: boolean;
}

export default function ChecklistEditor({
  items,
  onChange,
  textColor = '#1A2766',
  readOnly = false,
}: ChecklistEditorProps) {
  const lastAddedIdRef = useRef<string | null>(null);

  const handleToggle = (index: number) => {
    if (readOnly) return;
    const next = [...items];
    next[index] = { ...next[index], isChecked: !next[index].isChecked };
    onChange(next);
  };

  const handleTextChange = (index: number, newText: string) => {
    if (readOnly) return;
    const next = [...items];
    next[index] = { ...next[index], text: newText };
    onChange(next);
  };

  const handleDelete = (index: number) => {
    if (readOnly) return;
    const next = items.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleAddNewItem = () => {
    if (readOnly) return;

    // Generate stable unique ID
    const newId = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    lastAddedIdRef.current = newId;

    const newItem: ChecklistItemData = {
      id: newId,
      text: '',
      isChecked: false,
    };

    onChange([...items, newItem]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewItem();
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-col gap-1.5 w-full">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center gap-2.5 py-1 px-1 rounded-lg group transition-colors"
          >
            <button
              type="button"
              disabled={readOnly}
              onClick={() => handleToggle(index)}
              className="shrink-0 text-slate-500 hover:text-[#1A2766] focus:outline-hidden active:scale-95 transition-transform"
              aria-label={item.isChecked ? 'Uncheck item' : 'Check item'}
            >
              {item.isChecked ? (
                <CheckSquare size={20} className="text-[#16a34a]" />
              ) : (
                <Square size={20} className="text-slate-400" />
              )}
            </button>

            {readOnly ? (
              <span
                className={`flex-1 text-sm font-medium leading-normal ${
                  item.isChecked ? 'line-through text-slate-400' : ''
                }`}
                style={{ color: item.isChecked ? undefined : textColor }}
              >
                {item.text}
              </span>
            ) : (
              <input
                type="text"
                value={item.text}
                autoFocus={item.id === lastAddedIdRef.current}
                onChange={(e) => handleTextChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                placeholder="List item..."
                className={`flex-1 bg-transparent text-sm font-medium focus:outline-hidden border-b border-transparent focus:border-slate-300 py-0.5 ${
                  item.isChecked ? 'line-through text-slate-400' : ''
                }`}
                style={{ color: item.isChecked ? undefined : textColor }}
              />
            )}

            {!readOnly && (
              <button
                type="button"
                onClick={() => handleDelete(index)}
                className="shrink-0 p-1 text-slate-300 hover:text-red-500 rounded-full active:scale-90 transition-all"
                aria-label="Delete item"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="pt-2 border-t border-black/5">
          <button
            type="button"
            onClick={handleAddNewItem}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#1A2766] py-1.5 px-2 rounded-xl hover:bg-black/5 active:scale-95 transition-all"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Item</span>
          </button>
        </div>
      )}
    </div>
  );
}
