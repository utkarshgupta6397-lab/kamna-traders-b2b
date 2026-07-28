'use client';

import React, { useState, useEffect } from 'react';
import { Database, Play, Loader2, CheckCircle2, AlertCircle, Wrench, Search, RefreshCw, Calculator, Link as LinkIcon, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SystemUtilitiesPage() {
  const [stats, setStats] = useState<{ totalSkus: number; eligibleCount: number; migratedCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState<{ created: number; skipped: number; failed: number }>({ created: 0, skipped: 0, failed: 0 });
  const [statusText, setStatusText] = useState('');
  const [completed, setCompleted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [executionTime, setExecutionTime] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/catalog/products/import');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
    } catch (e: any) {
      toast.error(e.message || 'Error fetching stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (migrating && startTime) {
      interval = setInterval(() => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        setExecutionTime(`${mins}m ${secs}s`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [migrating, startTime]);

  const handleStartMigration = async () => {
    if (!stats || stats.eligibleCount === 0) return;
    
    setShowConfirm(false);
    setMigrating(true);
    setCompleted(false);
    setStatusText('Scanning existing SKUs...');
    setProgress({ created: 0, skipped: 0, failed: 0 });
    setStartTime(Date.now());
    
    let remaining = stats.eligibleCount;
    let localCreated = 0;
    let localFailed = 0;
    
    try {
      while (remaining > 0) {
        setStatusText(`Creating Products & Variants... (${stats.eligibleCount - remaining} / ${stats.eligibleCount})`);
        
        const res = await fetch('/api/admin/catalog/products/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 50 }),
        });
        
        if (!res.ok) {
          throw new Error('Migration batch failed');
        }
        
        const data = await res.json();
        
        localCreated += data.createdCount || 0;
        localFailed += data.failedCount || 0;
        
        setProgress(prev => ({
          ...prev,
          created: localCreated,
          failed: localFailed
        }));
        
        if (data.createdCount === 0 && data.failedCount === 0 && data.skippedCount === 0) {
           break;
        }
        
        remaining = data.remainingCount || 0;
      }
      
      setStatusText('Updating Relationships...');
      await new Promise(r => setTimeout(r, 1000));
      
      setCompleted(true);
      setStatusText('Migration Completed Successfully');
      toast.success('Product Master Initialized');
      await fetchStats();
    } catch (e: any) {
      console.error(e);
      toast.error('Migration halted due to error');
      setStatusText('Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  const renderInitializeProductMaster = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-gray-500 p-4">
          <Loader2 className="animate-spin" size={16} />
          <span>Loading state...</span>
        </div>
      );
    }

    if (!stats) return <div className="text-red-500 p-4">Failed to load statistics.</div>;

    if (migrating || completed) {
      return (
        <div className="mt-4 border border-gray-200 rounded-lg p-5 bg-gray-50/50">
          <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            {migrating ? <Loader2 className="animate-spin text-blue-600" size={18} /> : <CheckCircle2 className="text-emerald-500" size={18} />}
            Migration Progress
          </h4>
          
          <div className="mb-2 flex justify-between text-sm font-medium">
            <span className="text-blue-600">{statusText}</span>
            <span className="text-gray-600">
              {Math.min(100, Math.round(((progress.created + progress.failed) / (progress.created + progress.failed + stats.eligibleCount || 1)) * 100))}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6 overflow-hidden">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.round(((progress.created + progress.failed) / (progress.created + progress.failed + stats.eligibleCount || 1)) * 100))}%` }}
            ></div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="flex flex-col p-3 bg-white rounded border border-gray-100">
              <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">Products</span>
              <span className="font-semibold text-gray-900 text-lg">{progress.created}</span>
            </div>
            <div className="flex flex-col p-3 bg-white rounded border border-gray-100">
              <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">Variants</span>
              <span className="font-semibold text-gray-900 text-lg">{progress.created}</span>
            </div>
            <div className="flex flex-col p-3 bg-white rounded border border-gray-100">
              <span className="text-gray-500 text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
                Failed {progress.failed > 0 && <AlertCircle size={14} className="text-red-500" />}
              </span>
              <span className={`font-semibold text-lg ${progress.failed > 0 ? 'text-red-600' : 'text-gray-900'}`}>{progress.failed}</span>
            </div>
            <div className="flex flex-col p-3 bg-white rounded border border-gray-100">
              <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">Skipped</span>
              <span className="font-semibold text-gray-900 text-lg">{progress.skipped}</span>
            </div>
            <div className="flex flex-col p-3 bg-white rounded border border-gray-100">
              <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">Time</span>
              <span className="font-semibold text-gray-900 text-lg">{executionTime || '-'}</span>
            </div>
          </div>
        </div>
      );
    }

    if (stats.eligibleCount === 0) {
      return (
        <div className="mt-4 p-4 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 flex items-center gap-3">
          <CheckCircle2 size={20} className="flex-shrink-0" />
          <div>
            <p className="font-medium">All SKUs have been migrated.</p>
            <p className="text-sm opacity-90">The Product Master is fully initialized and up to date.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          <div className="bg-gray-50 rounded p-3 border border-gray-100 flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Legacy SKUs</span>
            <span className="text-lg font-bold text-gray-900">{stats.totalSkus}</span>
          </div>
          <div className="bg-blue-50 rounded p-3 border border-blue-100 flex flex-col">
            <span className="text-xs text-blue-600 uppercase tracking-wider">To Create (Prd)</span>
            <span className="text-lg font-bold text-blue-700">{stats.eligibleCount}</span>
          </div>
          <div className="bg-blue-50 rounded p-3 border border-blue-100 flex flex-col">
            <span className="text-xs text-blue-600 uppercase tracking-wider">To Create (Var)</span>
            <span className="text-lg font-bold text-blue-700">{stats.eligibleCount}</span>
          </div>
          <div className="bg-emerald-50 rounded p-3 border border-emerald-100 flex flex-col">
            <span className="text-xs text-emerald-600 uppercase tracking-wider">Initialized</span>
            <span className="text-lg font-bold text-emerald-700">{stats.migratedCount}</span>
          </div>
          <div className="bg-gray-50 rounded p-3 border border-gray-100 flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Skipped</span>
            <span className="text-lg font-bold text-gray-700">0</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Play size={16} />
            Initialize
          </button>
          <button
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Preview
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fb]">
      <div className="p-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Wrench className="text-gray-400" />
          System Utilities
        </h1>
        <p className="text-sm text-gray-500 mt-1">Administrative maintenance, migrations and system initialization tools.</p>
      </div>

      <div className="p-6 max-w-5xl space-y-8">
        
        {/* Section 1: Catalog */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Catalog</h2>
          
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 flex items-start justify-between">
              <div className="flex gap-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg h-fit">
                  <Database size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900 text-lg">Initialize Product Master</h3>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">Ready</span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Info size={12} />
                      Safe (Idempotent)
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 max-w-3xl">
                    Create Product and Default Variant records from all existing legacy SKUs.
                  </p>
                  
                  {renderInitializeProductMaster()}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Future Utilities */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Future Utilities</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm opacity-70">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 text-gray-500 rounded-lg">
                    <Search size={18} />
                  </div>
                  <h3 className="font-medium text-gray-900">Rebuild Search Index</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Coming Soon</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm opacity-70">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 text-gray-500 rounded-lg">
                    <RefreshCw size={18} />
                  </div>
                  <h3 className="font-medium text-gray-900">Refresh Catalog Cache</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Coming Soon</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm opacity-70">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 text-gray-500 rounded-lg">
                    <Calculator size={18} />
                  </div>
                  <h3 className="font-medium text-gray-900">Recalculate Inventory</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Coming Soon</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm opacity-70">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 text-gray-500 rounded-lg">
                    <LinkIcon size={18} />
                  </div>
                  <h3 className="font-medium text-gray-900">Repair Product Relationships</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Coming Soon</span>
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Initialize Product Master</h3>
              <p className="text-sm text-gray-600 mb-6">
                This operation will create Product and Default Variant records from all existing legacy SKUs. Existing operational data will not be modified.
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartMigration}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Initialize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
