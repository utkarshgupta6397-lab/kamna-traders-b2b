'use client';

import React, { useState } from 'react';
import { Camera, ImageOff } from 'lucide-react';

interface MobileTruckImageThumbnailProps {
  imageUrl: string;
  alt: string;
  onClick: () => void;
  className?: string;
}

export default function MobileTruckImageThumbnail({
  imageUrl,
  alt,
  onClick,
  className = '',
}: MobileTruckImageThumbnailProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-16 h-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative group active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-[#1A2766]/30 cursor-pointer ${className}`}
      title="Tap to preview truck photo"
      aria-label={alt}
    >
      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse flex items-center justify-center">
          <Camera size={14} className="text-slate-400" />
        </div>
      )}

      {/* Error Fallback */}
      {error && (
        <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center text-slate-400 p-1">
          <ImageOff size={16} />
          <span className="text-[8px] font-bold mt-0.5">Failed</span>
        </div>
      )}

      {/* Actual Image */}
      {!error && (
        <img
          src={imageUrl}
          alt={alt}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-200 ${
            loading ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}

      {/* Overlay indicator */}
      {!loading && !error && (
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-center">
          <span className="p-1 rounded-full bg-black/60 text-white shadow-sm">
            <Camera size={12} />
          </span>
        </div>
      )}
    </button>
  );
}
