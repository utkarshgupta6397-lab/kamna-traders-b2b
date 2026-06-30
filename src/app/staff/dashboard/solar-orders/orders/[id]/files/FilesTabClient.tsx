'use client';

import { useState, useMemo } from 'react';
import { FileText, Download, Trash2, Search, Filter, Maximize2, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import FilePreviewModal from './FilePreviewModal';

interface SolarFile {
  id: string;
  fileCategory: string;
  documentType?: string | null;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSizeBytes?: number | null;
  uploadedBy: { name: string };
  createdAt: Date | string;
  // Computed on client
  logicalName?: string; 
}

interface FilesTabClientProps {
  orderId: string;
  files: SolarFile[];
  canUpload: boolean;
}

export default function FilesTabClient({ orderId, files: initialFiles, canUpload }: FilesTabClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // 1. Process files (add logical names)
  const processedFiles = useMemo(() => {
    let siteImageCounter = 1;
    let otherCounter = 1;

    return initialFiles.map(file => {
      let logicalName = file.fileName;
      
      if (file.fileCategory === 'DOCUMENTATION' && file.documentType) {
        // e.g. ELECTRICITY_BILL -> Electricity Bill
        logicalName = file.documentType
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      } else if (file.fileCategory === 'SITE_IMAGE') {
        logicalName = `Site Image ${siteImageCounter++}`;
      } else if (file.fileCategory === 'INSTALLATION') {
        logicalName = `Installation Image ${otherCounter++}`;
      }

      // Add extension back for context if needed, but the prompt said "Electricity Bill.jpg"
      const ext = file.fileName.split('.').pop();
      if (ext && !logicalName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
        logicalName = `${logicalName}.${ext}`;
      }

      return { ...file, logicalName };
    });
  }, [initialFiles]);

  // 2. Filter & Search
  const filteredFiles = useMemo(() => {
    return processedFiles.filter(f => {
      // Search
      const matchesSearch = f.logicalName?.toLowerCase().includes(search.toLowerCase()) || 
                            f.fileName.toLowerCase().includes(search.toLowerCase());
      
      // Filter
      let matchesFilter = true;
      if (activeFilter !== 'All') {
        if (activeFilter === 'Site Images' && f.fileCategory !== 'SITE_IMAGE') matchesFilter = false;
        if (activeFilter === 'Documentation' && f.fileCategory !== 'DOCUMENTATION') matchesFilter = false;
        if (activeFilter === 'Installation' && f.fileCategory !== 'INSTALLATION') matchesFilter = false;
        if (activeFilter === 'Finance' && f.fileCategory !== 'FINANCE') matchesFilter = false;
        if (activeFilter === 'Generated' && f.fileCategory !== 'GENERATED') matchesFilter = false;
      }

      return matchesSearch && matchesFilter;
    });
  }, [processedFiles, search, activeFilter]);

  // 3. Grouping for display
  const groupedFiles = useMemo(() => {
    const groups: Record<string, SolarFile[]> = {};
    filteredFiles.forEach(f => {
      let groupName = 'Other';
      if (f.fileCategory === 'SITE_IMAGE') groupName = 'Site Images';
      if (f.fileCategory === 'DOCUMENTATION') groupName = 'Documentation';
      if (f.fileCategory === 'INSTALLATION') groupName = 'Installation';
      if (f.fileCategory === 'FINANCE') groupName = 'Financial';
      if (f.fileCategory === 'GENERATED') groupName = 'Generated';
      
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(f);
    });
    return groups;
  }, [filteredFiles]);

  const formatBytes = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file? This will remove it from the entire system.')) return;
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/files?fileId=${fileId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('File deleted');
      router.refresh();
    } catch (e) {
      toast.error('Could not delete file');
    }
  };

  // Preview handles global filtered list for next/prev
  const openPreview = (file: SolarFile) => {
    const idx = filteredFiles.findIndex(f => f.id === file.id);
    if (idx !== -1) setPreviewIndex(idx);
  };

  const getBadgeColor = (category: string) => {
    switch(category) {
      case 'SITE_IMAGE': return 'bg-amber-100 text-amber-800';
      case 'DOCUMENTATION': return 'bg-blue-100 text-blue-800';
      case 'INSTALLATION': return 'bg-emerald-100 text-emerald-800';
      case 'FINANCE': return 'bg-purple-100 text-purple-800';
      case 'GENERATED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const filterOptions = ['All', 'Site Images', 'Documentation', 'Installation', 'Finance', 'Generated'];

  return (
    <div className="space-y-6">
      
      {/* Top Action Bar (Search & Filter) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-96 flex-shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50"
            placeholder="Search documents by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Chips */}
        <div className="flex-1 w-full overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
          <div className="flex items-center gap-2 md:justify-end min-w-max">
            {filterOptions.map(opt => (
              <button
                key={opt}
                onClick={() => setActiveFilter(opt)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors border ${
                  activeFilter === opt 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredFiles.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <ImageIcon size={32} className="text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No files found</h3>
          <p className="text-gray-500 max-w-md">
            This repository is currently empty for this view. Files uploaded during standard workflows (like Order Creation or Documentation) will automatically appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedFiles).map(([groupName, files]) => (
            <div key={groupName}>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  {groupName}
                </h3>
                <span className="bg-gray-200 text-gray-700 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {files.length}
                </span>
                <div className="h-px bg-gray-200 flex-1 ml-4" />
              </div>

              {/* Responsive Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {files.map(file => {
                  const imagePreview = isImage(file.fileType, file.fileName);
                  const pdfPreview = isPdf(file.fileType, file.fileName);

                  return (
                    <div key={file.id} className="group flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                      
                      {/* Thumbnail Area */}
                      <div 
                        className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer"
                        onClick={() => openPreview(file)}
                      >
                        {imagePreview ? (
                          <img 
                            src={file.fileUrl} 
                            alt={file.logicalName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : pdfPreview ? (
                          <div className="w-full h-full relative flex flex-col items-center justify-center bg-red-50">
                             <FileText size={48} className="text-red-400 mb-2" />
                             <span className="text-red-700 font-bold text-sm bg-red-100 px-2 py-1 rounded">PDF Document</span>
                          </div>
                        ) : (
                          <FileText size={48} className="text-gray-400" />
                        )}

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[2px]">
                          <button className="w-12 h-12 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors" title="Preview">
                            <Maximize2 size={20} />
                          </button>
                        </div>

                        {/* Category Badge */}
                        <div className="absolute top-2 left-2">
                          <span className={`text-[10px] font-black tracking-wider uppercase px-2 py-1 rounded-md shadow-sm ${getBadgeColor(file.fileCategory)}`}>
                            {file.fileCategory.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Details Area */}
                      <div className="p-4 flex flex-col flex-1">
                        <h4 className="font-bold text-gray-900 text-sm mb-1 line-clamp-1" title={file.logicalName}>
                          {file.logicalName}
                        </h4>
                        
                        <div className="flex flex-col gap-1 mt-auto pt-2 text-[11px] text-gray-500 font-medium">
                          <div className="flex justify-between items-center">
                            <span className="truncate pr-2">By {file.uploadedBy?.name || 'System'}</span>
                            <span>{formatBytes(file.fileSizeBytes)}</span>
                          </div>
                          <div>
                            {new Date(file.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                          <a 
                            href={file.fileUrl} 
                            download 
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                          >
                            <Download size={14} /> Download
                          </a>
                          {canUpload && (
                            <button 
                              onClick={() => handleDelete(file.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete File"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewIndex !== null && (
        <FilePreviewModal 
          files={filteredFiles}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
          canDownload={true}
        />
      )}
    </div>
  );
}
