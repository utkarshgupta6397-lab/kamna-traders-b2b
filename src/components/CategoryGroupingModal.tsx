'use client';

import React, { useState, useEffect } from 'react';
import { X, GripVertical, Check, Settings2, RotateCcw } from 'lucide-react';

interface CategoryGroupingModalProps {
  categoryId: string;
  categoryName: string;
  availableAttributes: Array<{ id: string; attributeName: string }>;
  currentGroupBy: string[]; // ordered list: attributeId | 'brand'
  onApply: (categoryId: string, newGroupBy: string[]) => void;
  onClose: () => void;
}

export default function CategoryGroupingModal({
  categoryId,
  categoryName,
  availableAttributes,
  currentGroupBy,
  onApply,
  onClose
}: CategoryGroupingModalProps) {
  // We'll maintain the selected items as an array of IDs in order
  const [selected, setSelected] = useState<string[]>(currentGroupBy);
  
  // Combine all available dimensions (Brand + category attributes)
  const allDimensions = [
    { id: 'brand', name: 'Brand' },
    ...availableAttributes.map(a => ({ id: a.id, name: a.attributeName }))
  ];

  // Map for easy name lookup
  const dimensionMap = new Map(allDimensions.map(d => [d.id, d.name]));

  // Handle checking/unchecking a dimension
  const toggleDimension = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(item => item !== id));
    } else {
      if (selected.length >= 4) return; // Enforce max 4
      setSelected([...selected, id]);
    }
  };

  const removeDimension = (id: string) => {
    setSelected(selected.filter(item => item !== id));
  };

  // Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Small timeout to allow the dragged image to capture the element before we style it as 'dragging'
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.add('opacity-50');
      }
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    
    if (draggedIndex !== index) {
      const newSelected = [...selected];
      const draggedItem = newSelected[draggedIndex];
      newSelected.splice(draggedIndex, 1);
      newSelected.splice(index, 0, draggedItem);
      setSelected(newSelected);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null);
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove('opacity-50');
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 text-gray-800">
            <Settings2 size={18} className="text-gray-500" />
            <h2 className="text-lg font-bold">Configure Grouping</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-gray-600 mb-6">
            Select up to 4 dimensions to group <strong className="font-semibold text-gray-900">{categoryName}</strong> items. Drag to reorder hierarchy levels.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left: Available Dimensions */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Available Dimensions</h3>
              <div className="space-y-2">
                {allDimensions.map(dim => {
                  const isSelected = selected.includes(dim.id);
                  const isDisabled = !isSelected && selected.length >= 4;
                  
                  return (
                    <label 
                      key={dim.id} 
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer
                        ${isSelected ? 'bg-blue-50/50 border-blue-200 text-blue-900' : 
                          isDisabled ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50' : 
                          'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                        ${isSelected ? 'bg-[#1A2766] border-[#1A2766]' : 'border-gray-300 bg-white'}
                      `}>
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="sr-only"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggleDimension(dim.id)}
                      />
                      <span className="text-sm font-medium">{dim.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Right: Selected & Ordered */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hierarchy Order</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{selected.length}/4</span>
              </div>
              
              {selected.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-gray-200 rounded-lg text-center bg-gray-50/50">
                  <p className="text-sm text-gray-400">No dimensions selected.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selected.map((id, index) => (
                    <div 
                      key={id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className="flex items-center gap-3 p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing group"
                    >
                      <GripVertical size={16} className="text-gray-400 cursor-grab active:cursor-grabbing" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Level {index + 1}</div>
                        <div className="text-sm font-bold text-gray-900 truncate">{dimensionMap.get(id) || id}</div>
                      </div>
                      <button 
                        onClick={() => removeDimension(id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove dimension"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button 
            onClick={() => setSelected(['brand'])}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <RotateCcw size={14} />
            Reset to Default
          </button>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => onApply(categoryId, selected)}
              className="px-6 py-2 text-sm font-bold text-white bg-[#1A2766] rounded-lg hover:bg-[#AE1B1E] transition-colors shadow-sm"
            >
              Apply Grouping
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
