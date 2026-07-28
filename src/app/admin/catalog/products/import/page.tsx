'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DownloadCloud, Play, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ImportProductsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<{ totalSkus: number; eligibleCount: number; migratedCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/catalog/products/import');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!confirm('Are you sure you want to run the import migration? This will create new Product records for all eligible SKUs.')) return;
    
    setMigrating(true);
    try {
      const res = await fetch('/api/admin/catalog/products/import', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      
      setResult(data);
      toast.success('Migration completed');
      fetchStats();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DownloadCloud className="text-blue-600" />
          Legacy SKU Migration
        </h1>
        <p className="text-gray-500 mt-2">
          Convert existing legacy SKUs into the new Product + Default Variant architecture.
          This process is idempotent and will skip SKUs that have already been migrated.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
          Loading statistics...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Total Legacy SKUs</p>
              <p className="text-3xl font-bold text-gray-900">{stats?.totalSkus || 0}</p>
            </div>
            <div className="bg-green-50 p-6 rounded-xl border border-green-200 shadow-sm">
              <p className="text-sm font-medium text-green-700 uppercase tracking-wider mb-2">Already Migrated</p>
              <p className="text-3xl font-bold text-green-700">{stats?.migratedCount || 0}</p>
            </div>
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm">
              <p className="text-sm font-medium text-blue-700 uppercase tracking-wider mb-2">Eligible for Import</p>
              <p className="text-3xl font-bold text-blue-700">{stats?.eligibleCount || 0}</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Run Migration</h3>
            
            {stats?.eligibleCount === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
                <CheckCircle2 size={20} />
                <p>All legacy SKUs have been successfully migrated. No action required.</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 p-4 bg-orange-50 text-orange-800 rounded-lg border border-orange-200 mb-6">
                  <AlertCircle size={20} className="flex-shrink-0" />
                  <p className="text-sm">
                    This will create <strong>{stats?.eligibleCount}</strong> new Product records and their corresponding Default Variants. 
                    The legacy Sku IDs will be retained in the Variant SKU field for mapping. This process may take a moment.
                  </p>
                </div>
                
                <button
                  onClick={handleImport}
                  disabled={migrating}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  <Play size={18} />
                  {migrating ? 'Migrating...' : 'Execute Import'}
                </button>
              </div>
            )}
          </div>

          {result && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">Import Results</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 text-green-700 rounded-lg">
                  <span className="flex items-center gap-2"><CheckCircle2 size={16} /> Successfully Created</span>
                  <span className="font-bold">{result.createdCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 text-gray-700 rounded-lg">
                  <span className="flex items-center gap-2"><AlertCircle size={16} /> Skipped (Already Migrated)</span>
                  <span className="font-bold">{result.skippedCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 text-red-700 rounded-lg">
                  <span className="flex items-center gap-2"><XCircle size={16} /> Failed</span>
                  <span className="font-bold">{result.failedCount}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
