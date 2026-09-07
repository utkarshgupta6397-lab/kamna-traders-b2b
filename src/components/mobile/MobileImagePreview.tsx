'use client';

import React, { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface MobileImagePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
  subtitle?: string;
  altText?: string;
}

export default function MobileImagePreview({
  isOpen,
  onClose,
  imageUrl,
  title,
  subtitle,
  altText = 'Truck Photo Preview',
}: MobileImagePreviewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Prevent background body scroll when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Reset loaded state when image URL changes
  useEffect(() => {
    setImageLoaded(false);
  }, [imageUrl]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image Preview"
    >
      {/* Header with safe area padding */}
      <div
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-[max(env(safe-area-inset-top,16px),16px)] shrink-0 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-w-0 pr-3">
          {title && (
            <h3 className="text-white font-bold text-base truncate tracking-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-white/70 text-xs truncate mt-0.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all border border-white/20"
            title="Open original image"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={16} />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 text-white flex items-center justify-center transition-all border border-white/20"
            title="Close preview"
            aria-label="Close image preview"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        className="flex-1 flex items-center justify-center p-4 min-h-0 relative overflow-hidden"
        onClick={onClose}
      >
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={imageUrl}
            alt={altText}
            onLoad={() => setImageLoaded(true)}
            className={`max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl transition-all duration-300 ${
              imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          />
        </div>
      </div>

      {/* Footer / Hint */}
      <div
        className="w-full text-center py-3 pb-[max(env(safe-area-inset-bottom,16px),16px)] text-white/50 text-xs font-medium bg-gradient-to-t from-black/80 via-black/40 to-transparent shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span>Tap anywhere outside or tap close to dismiss</span>
      </div>
    </div>
  );
}
