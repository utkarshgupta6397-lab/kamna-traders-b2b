'use client';

import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight, Upload } from 'lucide-react';

interface FilePreviewModalProps {
  files: any[];
  initialIndex: number;
  onClose: () => void;
  canDownload: boolean;
  onReplace?: () => void;
}

export default function FilePreviewModal({ files, initialIndex, onClose, canDownload, onReplace }: FilePreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const file = files[currentIndex];
  
  // Reset view state when changing files
  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [currentIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') nextFile();
      if (e.key === 'ArrowLeft') prevFile();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const nextFile = () => {
    setCurrentIndex(prev => (prev < files.length - 1 ? prev + 1 : prev));
  };

  const prevFile = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const isImage = (type: string, name: string) => {
    if (type.startsWith('image/')) return true;
    const ext = name.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext || '');
  };

  const isPdf = (type: string, name: string) => {
    if (type === 'application/pdf') return true;
    return name.toLowerCase().endsWith('.pdf');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between text-white z-10 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex flex-col">
          <span className="font-bold text-lg">{file.logicalName}</span>
          <span className="text-xs text-gray-400">
            {currentIndex + 1} of {files.length} • {file.fileCategory}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isImage(file.fileType, file.fileName) && (
            <>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Zoom Out">
                <ZoomOut size={20} />
              </button>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Zoom In">
                <ZoomIn size={20} />
              </button>
              <button onClick={() => setRotation(r => r + 90)} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Rotate">
                <RotateCw size={20} />
              </button>
            </>
          )}
          {canDownload && (
            <a href={file.fileUrl} download className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Download">
              <Download size={20} />
            </a>
          )}
          {onReplace && (
            <button 
              onClick={() => {
                onClose();
                onReplace();
              }} 
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-blue-400" 
              title="Replace File"
            >
              <Upload size={20} />
            </button>
          )}
          <button onClick={onClose} className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-full transition-colors ml-4" title="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Navigation Areas */}
      {currentIndex > 0 && (
        <button 
          onClick={prevFile}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors z-10"
        >
          <ChevronLeft size={32} />
        </button>
      )}
      
      {currentIndex < files.length - 1 && (
        <button 
          onClick={nextFile}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors z-10"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Content Area */}
      <div className="w-full h-full p-20 flex items-center justify-center overflow-hidden">
        {isImage(file.fileType, file.fileName) ? (
          <img 
            src={file.fileUrl} 
            alt={file.logicalName}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ 
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              cursor: zoom > 1 ? 'grab' : 'default'
            }}
          />
        ) : isPdf(file.fileType, file.fileName) ? (
          <object 
            data={file.fileUrl} 
            type="application/pdf" 
            className="w-full h-full max-w-5xl bg-white rounded-xl shadow-2xl"
          >
            <p className="text-white text-center p-8">
              Your browser does not support PDF previews. 
              <a href={file.fileUrl} className="text-blue-400 hover:underline ml-2">Download instead.</a>
            </p>
          </object>
        ) : (
          <div className="text-white text-center">
            <div className="w-24 h-24 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-black text-gray-500">?</span>
            </div>
            <h3 className="text-xl font-bold mb-2">No Preview Available</h3>
            <p className="text-gray-400 mb-6">This file type cannot be previewed in the browser.</p>
            {canDownload && (
              <a href={file.fileUrl} download className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
                <Download size={20} /> Download File
              </a>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
