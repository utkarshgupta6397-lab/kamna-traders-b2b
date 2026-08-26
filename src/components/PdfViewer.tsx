'use client';
import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
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
    <TransformWrapper
      initialScale={1}
      minScale={0.5}
      maxScale={3}
      centerZoomedOut={false}
      wheel={{ wheelDisabled: true }}
      trackPadPanning={{ disabled: false }}
      pinch={{ step: 5 }}
    >
      {({ zoomIn, zoomOut, state }) => (
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
                <button onClick={() => zoomOut(0.25)} className="p-1.5 text-white hover:bg-white/20 rounded-md">
                  <ZoomOut size={16} />
                </button>
                <span className="text-white/80 text-xs font-mono w-12 text-center">{Math.round(state.scale * 100)}%</span>
                <button onClick={() => zoomIn(0.25)} className="p-1.5 text-white hover:bg-white/20 rounded-md">
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

          <div className="flex-1 overflow-hidden relative w-full h-full">
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="py-4 md:py-8 flex flex-col items-center gap-6 w-full">
                <Document
                  file={url}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<div className="text-white/50 py-10">Loading PDF...</div>}
                >
                  {Array.from(new Array(numPages || 0), (el, index) => (
                    <div key={`page_${index + 1}`} className="mb-6 shadow-2xl rounded-sm overflow-hidden bg-white mx-auto w-fit">
                      <Page 
                        pageNumber={index + 1} 
                        scale={1.0}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        width={Math.min(typeof window !== 'undefined' ? window.innerWidth - 32 : 800, 1000)}
                      />
                    </div>
                  ))}
                </Document>
              </div>
            </TransformComponent>
          </div>
        </div>
      )}
    </TransformWrapper>
  );

}
