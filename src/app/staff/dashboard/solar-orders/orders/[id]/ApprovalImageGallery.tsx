'use client';

import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';

export default function ApprovalImageGallery({ images }: { images: string[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.map((src, idx) => (
          <div 
            key={idx} 
            onClick={() => setSelectedIndex(idx)}
            className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square cursor-pointer bg-gray-50 hover:shadow-md transition-all"
          >
            <img src={src} alt={`Site Image ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Full Screen Overlay */}
      {selectedIndex !== null && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200">
          
          <div className="absolute top-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent z-10">
            <span className="text-white/80 font-medium text-sm px-4">
              Image {selectedIndex + 1} of {images.length}
            </span>
            <button 
              onClick={() => setSelectedIndex(null)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="flex-1 flex items-center justify-center relative p-4 md:p-12">
            
            {/* Previous Button */}
            {images.length > 1 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex((prev) => (prev! > 0 ? prev! - 1 : images.length - 1));
                }}
                className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
              >
                <ChevronLeft size={32} />
              </button>
            )}

            <div className="w-full h-full flex items-center justify-center">
              <img 
                src={images[selectedIndex]} 
                alt={`Site Image ${selectedIndex + 1} Full`} 
                className="max-w-full max-h-full object-contain drop-shadow-2xl"
              />
            </div>

            {/* Next Button */}
            {images.length > 1 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex((prev) => (prev! < images.length - 1 ? prev! + 1 : 0));
                }}
                className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
              >
                <ChevronRight size={32} />
              </button>
            )}
          </div>
          
          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="bg-black/50 p-4 overflow-x-auto flex gap-2 justify-center pb-8">
              {images.map((src, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIndex(idx)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${
                    idx === selectedIndex ? 'border-white opacity-100 scale-110' : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <img src={src} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

        </div>
      )}
    </>
  );
}
