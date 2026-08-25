'use client';
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set worker to match react-pdf version
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  onClose: () => void;
  filename?: string;
}

export default function PdfViewer({ url, onClose, filename = 'Report.pdf' }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col backdrop-blur-sm">
      <div 
        className="flex-none pb-4 px-4 flex items-center justify-between border-b border-white/10 bg-black/50"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
          <div className="text-white font-medium text-sm">
            {numPages ? `${numPages} Pages` : 'Loading...'}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/10 rounded-lg p-1 mr-2">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-1.5 text-white hover:bg-white/20 rounded-md">
              <ZoomOut size={16} />
            </button>
            <span className="text-white/80 text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3.0, s + 0.25))} className="p-1.5 text-white hover:bg-white/20 rounded-md">
              <ZoomIn size={16} />
            </button>
          </div>
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-lg"
          >
            <Download size={16} />
            Download PDF
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8 flex flex-col items-center gap-6" style={{ WebkitOverflowScrolling: 'touch' }}>
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="text-white/50 py-10">Loading PDF...</div>}
        >
          {Array.from(new Array(numPages || 0), (el, index) => (
            <div key={`page_${index + 1}`} className="mb-6 shadow-2xl rounded-sm overflow-hidden bg-white">
              <Page 
                pageNumber={index + 1} 
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={Math.min(typeof window !== 'undefined' ? window.innerWidth - 32 : 800, 1000)}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}
