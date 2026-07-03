'use client';

import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, ChevronLeft, ChevronRight, Upload, Loader2, AlertCircle } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(true);

  const file = files[currentIndex];
  
  // Reset view state when changing files
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setIsLoading(true);
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
  }, [currentIndex, files.length, onClose]);

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

  // Cache-busting URL to bypass Next.js static asset 404 caching after fresh uploads
  const getSafeUrl = (url: string) => {
    if (!url) return '';
    const hasQuery = url.includes('?');
    return `${url}${hasQuery ? '&' : '?'}t=${Date.now()}`;
  };

  const safeFileUrl = getSafeUrl(file?.fileUrl);
  const isImg = file ? isImage(file.fileType, file.fileName) : false;
  const isPdfFile = file ? isPdf(file.fileType, file.fileName) : false;
  const isHeic = file?.fileUrl?.toLowerCase().endsWith('.heic');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in">
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between text-white z-10 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex flex-col">
          <span className="font-bold text-lg pr-4 truncate max-w-[300px] md:max-w-2xl">{file?.logicalName || file?.fileName || 'Preview'}</span>
          <span className="text-xs text-gray-400">
            {currentIndex + 1} of {files.length} {file?.fileCategory ? `• ${file.fileCategory.replace('_', ' ')}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          {isImg && !isHeic && (
            <>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block" title="Zoom Out">
                <ZoomOut size={20} />
              </button>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block" title="Zoom In">
                <ZoomIn size={20} />
              </button>
              <button onClick={() => setRotation(r => r + 90)} className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block" title="Rotate">
                <RotateCw size={20} />
              </button>
            </>
          )}
          {canDownload && (
            <a href={file?.fileUrl} download className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center gap-2 bg-white/10" title="Download">
              <Download size={18} />
              <span className="text-sm font-bold hidden sm:inline">Download</span>
            </a>
          )}
          {onReplace && (
            <button 
              onClick={() => {
                onClose();
                onReplace();
              }} 
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-blue-400 flex items-center gap-2" 
              title="Replace File"
            >
              <Upload size={18} />
              <span className="text-sm font-bold hidden sm:inline">Replace</span>
            </button>
          )}
          <button onClick={onClose} className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-full transition-colors ml-2 md:ml-4 flex items-center gap-2" title="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Navigation Areas */}
      {currentIndex > 0 && (
        <button 
          onClick={prevFile}
          className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors z-10"
        >
          <ChevronLeft size={32} />
        </button>
      )}
      
      {currentIndex < files.length - 1 && (
        <button 
          onClick={nextFile}
          className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-2 md:p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors z-10"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Content Area */}
      <div className="w-full h-full pt-20 pb-4 px-4 md:px-20 flex items-center justify-center overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-0">
            <Loader2 size={48} className="animate-spin text-gray-500 opacity-50" />
            <span className="text-gray-400 font-medium tracking-widest uppercase text-sm">Loading Preview</span>
          </div>
        )}

        {isImg ? (
          isHeic ? (
            <div className="flex flex-col items-center justify-center text-gray-400 gap-4 bg-gray-900 rounded-2xl p-10 max-w-md w-full text-center z-10">
              <AlertCircle size={48} className="text-gray-500" />
              <div>
                <p className="font-bold text-white mb-2">HEIC preview not supported in browser</p>
                <p className="text-sm">Please download the file to view it.</p>
              </div>
              {canDownload && (
                <a href={file?.fileUrl} download className="px-6 py-3 mt-4 bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-xl font-bold flex items-center gap-2 shadow-sm">
                  <Download size={18} />
                  Download File
                </a>
              )}
            </div>
          ) : (
            <img 
              src={safeFileUrl} 
              alt={file?.logicalName || 'Preview'}
              className="max-w-full max-h-full object-contain transition-all duration-200 z-10 rounded-lg shadow-2xl"
              style={{ 
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                cursor: zoom > 1 ? 'grab' : 'default',
                opacity: isLoading ? 0 : 1
              }}
              onLoad={() => setIsLoading(false)}
              onError={() => setIsLoading(false)}
            />
          )
        ) : isPdfFile ? (
          <iframe 
            src={safeFileUrl} 
            className="w-full h-full max-w-6xl bg-white rounded-xl shadow-2xl z-10 border-0"
            title="PDF Preview"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
          />
        ) : (
          <div className="text-white text-center bg-gray-900 rounded-2xl p-10 max-w-md w-full z-10 shadow-2xl">
            <div className="w-20 h-20 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={32} className="text-gray-500" />
            </div>
            <h3 className="text-xl font-bold mb-3">Unable to preview this file.</h3>
            <p className="text-gray-400 mb-8 text-sm">This file type cannot be previewed natively in the browser.</p>
            {canDownload && (
              <a href={file?.fileUrl} download className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                <Download size={20} /> Download File
              </a>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

