'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Info } from 'lucide-react';

interface HierarchyNode {
  level: string;
  code: string;
  name: string;
}

export default function HsnHierarchyPreview({ code }: { code: string }) {
  console.log('[DEBUG HsnHierarchyPreview] Rendered with prop code:', code);
  
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cleanCode = code.replace(/[^0-9]/g, '');
    console.log('[DEBUG HsnHierarchyPreview] useEffect triggered, cleanCode:', cleanCode);
    if (cleanCode.length < 2) {
      setHierarchy([]);
      return;
    }

    const fetchHierarchy = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('[DEBUG HsnHierarchyPreview] Fetching:', `/api/staff/hsn-helper/lookup?code=${cleanCode}`);
        const res = await fetch(`/api/staff/hsn-helper/lookup?code=${cleanCode}`);
        if (!res.ok) throw new Error('Failed to fetch hierarchy');
        const data = await res.json();
        setHierarchy(data.hierarchy || []);
      } catch (err: any) {
        setError(err.message);
        setHierarchy([]);
      } finally {
        setLoading(false);
      }
    };

    const timeout = setTimeout(fetchHierarchy, 200);
    return () => clearTimeout(timeout);
  }, [code]);

  const cleanCode = code.replace(/[^0-9]/g, '');
  if (cleanCode.length < 2) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Info size={14} className="text-gray-400" />
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Helper Lookup</h4>
        {loading && <Loader2 size={12} className="animate-spin text-gray-400 ml-auto" />}
      </div>
      
      {error && <div className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</div>}
      
      {!loading && hierarchy.length === 0 && !error && (
        <div className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">No helper data available.</div>
      )}

      {hierarchy.length > 0 && (
        <div className="space-y-1.5">
          {hierarchy.map((node) => (
            <div key={node.code} className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-md p-2 text-xs">
              <span className="font-semibold text-gray-500 min-w-[90px] mt-0.5">{node.level}:</span>
              <span className="font-mono text-gray-700 bg-white px-1.5 py-0.5 border border-gray-200 rounded mt-0.5 whitespace-nowrap">{node.code}</span>
              <span className={`flex-1 break-words ${node.name === 'Not Available' ? 'text-gray-400 italic mt-0.5' : 'text-gray-600'}`}>
                {node.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
