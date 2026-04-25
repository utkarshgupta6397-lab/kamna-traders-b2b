'use client';

import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';

export default function ImageUploadClient({ 
  name = "imageUrl", 
  defaultValue = "" 
}: { 
  name?: string;
  defaultValue?: string;
}) {
  const [image, setImage] = useState(defaultValue);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // compress to webp
        const dataUrl = canvas.toDataURL('image/webp', 0.8);
        setImage(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={image} />
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
      />
      
      {image ? (
        <div className="relative w-8 h-8 group rounded border border-gray-200 overflow-hidden flex-shrink-0">
          <img src={image} alt="Thumbnail" className="w-full h-full object-cover" />
          <button 
            type="button" 
            onClick={() => setImage('')}
            className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-8 h-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex-shrink-0 transition-colors"
          title="Upload Thumbnail"
        >
          <Upload size={14} />
        </button>
      )}
    </div>
  );
}
