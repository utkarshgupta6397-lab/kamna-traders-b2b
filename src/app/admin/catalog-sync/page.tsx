'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, ShieldCheck, ShieldAlert, Info, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, ChevronRight, PlayCircle,
  Eye, Loader2, Package, Layers, Tag, BarChart3, ImageOff,
  AlertCircle, Database, Zap, Clock, Activity, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type CatalogHealth = {
  totalProducts: number;
  totalFamilies: number;
  standaloneProducts: number;
  totalVariants: number;
  totalSkus: number;
  draftProducts: number;
  pendingApproval: number;
  inactiveProducts: number;
  missingImages: number;
  missingDefaultVariants: number;
  duplicateAttributeSets: number;
  brokenReferences: number;
};

type ValidationSeverity = 'Error' | 'Warning' | 'Info';

type ValidationIssue = {
  check: string;
  severity: ValidationSeverity;
  count: number;
  samples: string[];
};

type ValidationReport = {
  checks: ValidationIssue[];
  totalErrors: number;
  totalWarnings: number;
  totalInfo: number;
  isHealthy: boolean;
};

type AnalysisReport = {
  skusWithoutVariantMapping: number;
  productsWithoutDefaultVariant: number;
  variantsWithoutSkuMapping: number;
  sampleOrphanSkus: string[];
  sampleMissingVariantProducts: string[];
  sampleOrphanVariants: string[];
};

type ImportPreviewRow = {
  skuId: string;
  productName: string;
  brand: string | null;
  category: string | null;
  isActive: boolean;
  action: 'Create' | 'Skip';
};

type VariantRepairPreviewRow = {
  productId: string;
  productCode: string;
  productName: string;
  currentVariantCount: number;
  hasMissingDefault: boolean;
  proposedAction: string;
};

type SkuRepairPreviewRow = {
  variantId: string;
  variantSku: string;
  productName: string;
  hasExistingSkuMapping: boolean;
  status: 'OK' | 'Missing';
  proposedAction: string;
};

type ExecuteResult = {
  action: string;
  dryRun: boolean;
  recordsAnalysed: number;
  recordsCreated: number;
  recordsSkipped: number;
  recordsFailed: number;
  errors: string[];
  durationMs: number;
};

type ActiveTab = 'health' | 'readiness' | 'resolverHealth' | 'validate' | 'actions' | 'output';

type ResolverHealthReport = {
  totalProducts: number;
  totalVariants: number;
  totalSkus: number;
  healthScore: number;
  issues: {
    duplicateSkus: { count: number; samples: string[] };
    duplicateZohoIds: { count: number; samples: string[] };
    duplicateBarcodes: { count: number; samples: string[] };
    productsWithoutVariant: { count: number; samples: string[] };
    variantsWithoutProduct: { count: number; samples: string[] };
    orphanSkus: { count: number; samples: string[] };
    orphanVariants: { count: number; samples: string[] };
    inactiveDefaultVariant: { count: number; samples: string[] };
    missingDefaultVariant: { count: number; samples: string[] };
    duplicateAttributes: { count: number; samples: string[] };
    brokenSkuMapping: { count: number; samples: string[] };
    missingZohoMapping: { count: number; samples: string[] };
  };
};

type SyncHealthReport = {
  health: {
    totalProducts: number;
    totalVariants: number;
    totalSkus: number;
    productsWithoutSku: number;
    skusWithoutProduct: number;
    variantsWithoutSku: number;
    duplicateSku: number;
    duplicateZohoIds: number;
    status: string;
    score: number;
  };
};

type SyncPreviewRow = {
  id: string;
  title: string;
  action: 'Create' | 'Update' | 'Skip' | 'Error';
  details: string;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<ValidationSeverity, { color: string; icon: React.ElementType; bg: string }> = {
  Error: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle },
  Warning: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle },
  Info: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Info },
};

// ─── Utility Components ───────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent = false, warn = false }: {
  label: string; value: number | string; icon: React.ElementType; accent?: boolean; warn?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow ${warn && Number(value) > 0 ? 'border-amber-300' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`p-1.5 rounded-lg ${accent ? 'bg-indigo-100' : warn && Number(value) > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
          <Icon size={15} className={accent ? 'text-indigo-600' : warn && Number(value) > 0 ? 'text-amber-600' : 'text-gray-500'} />
        </div>
      </div>
      <span className={`text-2xl font-bold ${warn && Number(value) > 0 ? 'text-amber-700' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Spinner() {
  return <Loader2 size={16} className="animate-spin text-indigo-500" />;
}

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{text}</span>;
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────

function ConfirmModal({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
        <div className="flex items-start gap-4 mb-5">
          <div className="p-2 bg-amber-100 rounded-xl flex-shrink-0">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
            <p className="text-gray-500 text-sm mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
            Confirm Execute
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CatalogMaintenancePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('health');
  const [health, setHealth] = useState<CatalogHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // Validate
  const [validating, setValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  // Analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);

  // Sync Health
  const [syncHealthLoading, setSyncHealthLoading] = useState(false);
  const [syncHealthData, setSyncHealthData] = useState<SyncHealthReport | null>(null);

  // Previews
  const [syncPreview, setSyncPreview] = useState<SyncPreviewRow[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  // Resolver Health
  const [resolverHealth, setResolverHealth] = useState<ResolverHealthReport | null>(null);
  const [resolverHealthLoading, setResolverHealthLoading] = useState(false);

  // Execute
  const [executing, setExecuting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ExecuteResult | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ action: string; title: string; message: string } | null>(null);

  // ── API Helper ──────────────────────────────────────────────────────────────

  async function callApi(method: 'GET' | 'POST', body?: Record<string, unknown>) {
    const res = await fetch('/api/admin/catalog-sync', {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  }

  // ── Load Health ─────────────────────────────────────────────────────────────

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const data = await callApi('GET');
      setHealth(data.health);
    } catch (err: any) {
      toast.error(`Health load failed: ${err.message}`);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  // ── Validate ────────────────────────────────────────────────────────────────

  async function runValidation() {
    setValidating(true);
    setValidationReport(null);
    try {
      const data = await callApi('POST', { action: 'validate' });
      setValidationReport(data.report);
      setActiveTab('validate');
      toast.success('Validation complete');
    } catch (err: any) {
      toast.error(`Validation failed: ${err.message}`);
    } finally {
      setValidating(false);
    }
  }

  // ── Analyze ─────────────────────────────────────────────────────────────────

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalysisReport(null);
    try {
      const data = await callApi('POST', { action: 'analyze' });
      setAnalysisReport(data.report);
      setActiveTab('actions');
      toast.success('Analysis complete');
    } catch (err: any) {
      toast.error(`Analysis failed: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  // ── Sync Health ─────────────────────────────────────────────────────────────────

  async function loadSyncHealth() {
    setSyncHealthLoading(true);
    setSyncHealthData(null);
    try {
      const res = await fetch('/api/admin/catalog-sync/readiness');
      if (!res.ok) throw new Error('Failed to load sync health');
      const dataJson = await res.json();
      setSyncHealthData(dataJson);
      setActiveTab('readiness');
    } catch (err: any) {
      toast.error(`Sync health failed: ${err.message}`);
    } finally {
      setSyncHealthLoading(false);
    }
  }

  // ── Resolver Health ─────────────────────────────────────────────────────────────

  async function loadResolverHealth() {
    setResolverHealthLoading(true);
    setResolverHealth(null);
    try {
      const res = await fetch('/api/admin/catalog-resolver/health');
      if (!res.ok) throw new Error('Failed to load resolver health');
      const dataJson = await res.json();
      setResolverHealth(dataJson);
      setActiveTab('resolverHealth');
    } catch (err: any) {
      toast.error(`Resolver health failed: ${err.message}`);
    } finally {
      setResolverHealthLoading(false);
    }
  }

  // ── Preview ─────────────────────────────────────────────────────────────────

  async function loadPreview(action: string) {
    setLoadingPreview(action);
    try {
      const data = await callApi('POST', { action, dryRun: true });
      if (action === 'syncProductToSku' || action === 'syncSkuToProduct') {
        setSyncPreview(data.result.rows);
      }
      setActiveTab('actions');
    } catch (err: any) {
      toast.error(`Preview failed: ${err.message}`);
    } finally {
      setLoadingPreview(null);
    }
  }

  // ── Execute ─────────────────────────────────────────────────────────────────

  function requestExecute(action: string, title: string, message: string) {
    setConfirmModal({ action, title, message });
  }

  async function executeAction(action: string) {
    setConfirmModal(null);
    setExecuting(action);
    try {
      const data = await callApi('POST', { action, dryRun: false, confirmed: true });
      const result: ExecuteResult = data.result;
      setLastResult(result);
      setActiveTab('output');
      toast.success(`${action} completed — ${result.recordsCreated} created, ${result.recordsFailed} failed`);
      // Refresh health stats after a write
      loadHealth();
    } catch (err: any) {
      toast.error(`Execution failed: ${err.message}`);
    } finally {
      setExecuting(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'health', label: 'Catalog Health' },
    { id: 'readiness', label: 'Catalog Synchronization Health' },
    { id: 'resolverHealth', label: 'Resolver Health' },
    { id: 'validate', label: 'Consistency Report' },
    { id: 'actions', label: 'Maintenance Actions' },
    { id: 'output', label: 'Execution Output' },
  ];

  return (
    <div className="space-y-0 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Catalog Maintenance Console</h1>
          <p className="text-sm text-gray-500 mt-0.5">Read-only health analysis and manual repair. Every write requires explicit confirmation.</p>
        </div>
        <button
          onClick={loadHealth}
          disabled={healthLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {healthLoading ? <Spinner /> : <RefreshCw size={14} />}
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/40'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
            {tab.id === 'output' && lastResult && (
              <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full font-bold ${lastResult.recordsFailed > 0 ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                ●
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Catalog Health ── */}
      {activeTab === 'health' && (
        <div>
          <SectionHeader title="Catalog Health" subtitle="Live statistics from the database. Use Refresh to reload." />
          {healthLoading && !health ? (
            <div className="flex items-center justify-center h-40 text-gray-400 gap-2">
              <Spinner /> Loading health data...
            </div>
          ) : health ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              <StatCard label="Total Products" value={health.totalProducts} icon={Package} accent />
              <StatCard label="Product Families" value={health.totalFamilies} icon={Layers} accent />
              <StatCard label="Standalone Products" value={health.standaloneProducts} icon={Package} />
              <StatCard label="Variants" value={health.totalVariants} icon={Tag} accent />
              <StatCard label="Legacy SKUs" value={health.totalSkus} icon={Database} />
              <StatCard label="Draft Products" value={health.draftProducts} icon={Clock} warn />
              <StatCard label="Approval Pending" value={health.pendingApproval} icon={AlertCircle} warn />
              <StatCard label="Inactive Products" value={health.inactiveProducts} icon={XCircle} warn />
              <StatCard label="Missing Images" value={health.missingImages} icon={ImageOff} warn />
              <StatCard label="Missing Default Variants" value={health.missingDefaultVariants} icon={AlertTriangle} warn />
              <StatCard label="Duplicate Attribute Sets" value={health.duplicateAttributeSets} icon={Activity} warn />
              <StatCard label="Broken References" value={health.brokenReferences} icon={AlertCircle} warn />
            </div>
          ) : (
            <div className="text-center text-gray-400 py-12">No data loaded.</div>
          )}

          {/* Quick-action strip */}
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={runAnalysis} disabled={analyzing} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {analyzing ? <Spinner /> : <BarChart3 size={15} />} Analyze Catalog
            </button>
            <button onClick={runValidation} disabled={validating} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors">
              {validating ? <Spinner /> : <ShieldCheck size={15} />} Run Validation
            </button>
            <button onClick={loadSyncHealth} disabled={syncHealthLoading} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors">
              {syncHealthLoading ? <Spinner /> : <ArrowRight size={15} />} Catalog Sync Health
            </button>
            <button onClick={loadResolverHealth} disabled={resolverHealthLoading} className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors">
              {resolverHealthLoading ? <Spinner /> : <Activity size={15} />} Resolver Health
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Catalog Synchronization Health ── */}
      {activeTab === 'readiness' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Catalog Synchronization Health" subtitle="Real-time synchronization metrics between Products and legacy SKUs." />
            <button onClick={loadSyncHealth} disabled={syncHealthLoading} className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {syncHealthLoading ? <Spinner /> : <RefreshCw size={14} />} Refresh
            </button>
          </div>
          
          {syncHealthLoading && !syncHealthData && (
            <div className="flex items-center gap-2 text-gray-500 py-12 justify-center"><Spinner /> Loading metrics...</div>
          )}

          {syncHealthData && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-center">
                <h3 className="text-lg font-bold text-indigo-900 mb-2">Overall Health Score</h3>
                <div className={`text-4xl font-extrabold ${syncHealthData.health.score === 100 ? 'text-green-600' : syncHealthData.health.score > 80 ? 'text-amber-500' : 'text-red-500'}`}>
                  {syncHealthData.health.score}%
                </div>
                <div className="text-sm font-medium mt-1 text-indigo-700">{syncHealthData.health.status}</div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Products" value={syncHealthData.health.totalProducts} icon={Package} />
                <StatCard label="Variants" value={syncHealthData.health.totalVariants} icon={Tag} />
                <StatCard label="SKUs" value={syncHealthData.health.totalSkus} icon={Database} />
                <StatCard label="Duplicate Zoho IDs" value={syncHealthData.health.duplicateZohoIds} icon={AlertCircle} warn />
                <StatCard label="Products without SKU" value={syncHealthData.health.productsWithoutSku} icon={AlertCircle} warn />
                <StatCard label="Variants without SKU" value={syncHealthData.health.variantsWithoutSku} icon={AlertCircle} warn />
                <StatCard label="SKUs without Product" value={syncHealthData.health.skusWithoutProduct} icon={AlertCircle} warn />
                <StatCard label="Duplicate SKUs" value={syncHealthData.health.duplicateSku} icon={AlertTriangle} warn />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Resolver Health ── */}
      {activeTab === 'resolverHealth' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Catalog Resolver Health" subtitle="Real-time diagnostics of the unified Catalog Resolver cache and mapping layer." />
            <button onClick={loadResolverHealth} disabled={resolverHealthLoading} className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {resolverHealthLoading ? <Spinner /> : <RefreshCw size={14} />} Refresh
            </button>
          </div>
          
          {resolverHealthLoading && !resolverHealth && (
            <div className="flex items-center gap-2 text-gray-500 py-12 justify-center"><Spinner /> Loading metrics...</div>
          )}

          {resolverHealth && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-center">
                <h3 className="text-lg font-bold text-indigo-900 mb-2">Resolver Health Score</h3>
                <div className={`text-4xl font-extrabold ${resolverHealth.healthScore === 100 ? 'text-green-600' : resolverHealth.healthScore > 80 ? 'text-amber-500' : 'text-red-500'}`}>
                  {resolverHealth.healthScore}%
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Total Products" value={resolverHealth.totalProducts} icon={Package} accent />
                <StatCard label="Total Variants" value={resolverHealth.totalVariants} icon={Tag} accent />
                <StatCard label="Total SKUs" value={resolverHealth.totalSkus} icon={Database} accent />
                
                <StatCard label="Orphan SKUs" value={resolverHealth.issues.orphanSkus.count} icon={AlertTriangle} warn />
                <StatCard label="Orphan Variants" value={resolverHealth.issues.orphanVariants.count} icon={AlertTriangle} warn />
                <StatCard label="Duplicate SKUs" value={resolverHealth.issues.duplicateSkus.count} icon={AlertCircle} warn />
                <StatCard label="Duplicate Barcodes" value={resolverHealth.issues.duplicateBarcodes.count} icon={AlertCircle} warn />
                <StatCard label="Duplicate Zoho IDs" value={resolverHealth.issues.duplicateZohoIds.count} icon={AlertCircle} warn />
                <StatCard label="Broken SKU Mapping" value={resolverHealth.issues.brokenSkuMapping.count} icon={AlertTriangle} warn />
                <StatCard label="Missing Zoho Mapping" value={resolverHealth.issues.missingZohoMapping.count} icon={AlertTriangle} warn />
                <StatCard label="Missing Default Variant" value={resolverHealth.issues.missingDefaultVariant.count} icon={AlertTriangle} warn />
                <StatCard label="Duplicate Attributes" value={resolverHealth.issues.duplicateAttributes.count} icon={AlertTriangle} warn />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Consistency Report ── */}
      {activeTab === 'validate' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Catalog Consistency Report" subtitle="18 integrity checks classified by severity." />
            <button onClick={runValidation} disabled={validating} className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {validating ? <Spinner /> : <RefreshCw size={14} />} Re-run
            </button>
          </div>

          {validating && (
            <div className="flex items-center gap-2 text-gray-500 py-12 justify-center"><Spinner /> Running 18 checks...</div>
          )}

          {!validating && !validationReport && (
            <div className="text-center py-16 text-gray-400">
              <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Run Validation to see a full consistency report.</p>
              <button onClick={runValidation} className="mt-4 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                Run Validation
              </button>
            </div>
          )}

          {validationReport && (
            <>
              {/* Summary badges */}
              <div className="flex gap-3 mb-5 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-sm font-medium text-red-700">
                  <XCircle size={14} /> {validationReport.totalErrors} Errors
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-700">
                  <AlertTriangle size={14} /> {validationReport.totalWarnings} Warnings
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm font-medium text-blue-700">
                  <Info size={14} /> {validationReport.totalInfo} Info
                </div>
                {validationReport.isHealthy && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm font-medium text-green-700">
                    <CheckCircle2 size={14} /> Catalog Healthy
                  </div>
                )}
              </div>

              {/* Issue list */}
              <div className="space-y-2">
                {['Error', 'Warning', 'Info'].map((sev) => {
                  const checks = validationReport.checks.filter((c) => c.severity === sev);
                  const cfg = SEVERITY_CONFIG[sev as ValidationSeverity];
                  const SevIcon = cfg.icon;
                  return checks.map((check) => (
                    <div key={check.check} className={`border rounded-xl overflow-hidden ${cfg.bg}`}>
                      <button
                        onClick={() => setExpandedCheck(expandedCheck === check.check ? null : check.check)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <SevIcon size={15} className={cfg.color} />
                          <span className={`text-sm font-medium ${cfg.color}`}>{check.check}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${cfg.color}`}>{check.count}</span>
                          {expandedCheck === check.check ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                        </div>
                      </button>
                      {expandedCheck === check.check && check.samples.length > 0 && (
                        <div className="px-4 pb-3 border-t border-current/10">
                          <p className="text-xs text-gray-500 mb-1.5 mt-2">Sample affected records:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {check.samples.map((s) => (
                              <code key={s} className="text-xs bg-white/70 border border-gray-200 rounded px-1.5 py-0.5 text-gray-700">{s}</code>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ));
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Maintenance Actions ── */}
      {activeTab === 'actions' && (
        <div className="space-y-6">
          <SectionHeader title="Maintenance Actions" subtitle="Each action requires a Preview before Execute. No data is written during dry-run." />

          {/* Analysis summary strip */}
          {analysisReport && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-indigo-700">{analysisReport.skusWithoutVariantMapping}</div>
                <div className="text-xs text-indigo-500 mt-0.5">SKUs without variant mapping</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-indigo-700">{analysisReport.productsWithoutDefaultVariant}</div>
                <div className="text-xs text-indigo-500 mt-0.5">Products missing default variant</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-indigo-700">{analysisReport.variantsWithoutSkuMapping}</div>
                <div className="text-xs text-indigo-500 mt-0.5">Variants without SKU mapping</div>
              </div>
            </div>
          )}

          {/* ── Action Card: Product to SKU Sync ── */}
          <ActionCard
            title="Product → SKU Synchronization"
            description="The primary synchronization direction. Ensures all Product Variants have a corresponding SKU record, and updates existing SKUs with any changes to ERP-owned fields (Name, Price, Category, etc.)."
            previewAction="syncProductToSku"
            executeAction="syncProductToSku"
            loadingPreview={loadingPreview}
            executing={executing}
            onPreview={() => loadPreview('syncProductToSku')}
            onExecute={() => requestExecute('syncProductToSku', 'Execute Product → SKU Sync', 'This will create missing SKUs and update existing SKUs based on the Master Product catalog. Continue?')}
          >
            {syncPreview && loadingPreview !== 'syncSkuToProduct' && (
              <PreviewTable
                title="Product → SKU Preview"
                total={syncPreview.length}
                toCreate={syncPreview.filter((r) => r.action === 'Create').length}
                toSkip={syncPreview.filter((r) => r.action === 'Skip').length}
              >
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500">
                      <th className="text-left py-2 pr-4 font-medium">Record ID</th>
                      <th className="text-left py-2 pr-4 font-medium">Title</th>
                      <th className="text-left py-2 pr-4 font-medium">Details</th>
                      <th className="text-left py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncPreview.slice(0, 20).map((row, idx) => (
                      <tr key={row.id + idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-1.5 pr-4 font-mono text-gray-600">{row.id}</td>
                        <td className="py-1.5 pr-4 text-gray-700 max-w-[200px] truncate">{row.title}</td>
                        <td className="py-1.5 pr-4 text-gray-500">{row.details}</td>
                        <td className="py-1.5">
                          <Badge
                            text={row.action}
                            color={row.action === 'Create' ? 'bg-green-100 text-green-700' : row.action === 'Update' ? 'bg-blue-100 text-blue-700' : row.action === 'Error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {syncPreview.length > 20 && (
                  <p className="text-xs text-gray-400 mt-2">Showing 20 of {syncPreview.length} rows.</p>
                )}
              </PreviewTable>
            )}
          </ActionCard>

          {/* ── Action Card: SKU to Product Sync ── */}
          <ActionCard
            title="SKU → Product Synchronization"
            description="Syncs approved external fields (like Zoho Item ID) from the legacy SKU table back to the Master Product Catalog. Will never overwrite ERP-owned fields like Product Name or Price."
            previewAction="syncSkuToProduct"
            executeAction="syncSkuToProduct"
            loadingPreview={loadingPreview}
            executing={executing}
            onPreview={() => loadPreview('syncSkuToProduct')}
            onExecute={() => requestExecute('syncSkuToProduct', 'Execute SKU → Product Sync', 'This will sync Zoho metadata and create minimal Product stubs for orphaned legacy SKUs. Continue?')}
          >
            {syncPreview && loadingPreview !== 'syncProductToSku' && (
              <PreviewTable
                title="SKU → Product Preview"
                total={syncPreview.length}
                toCreate={syncPreview.filter((r) => r.action === 'Create').length}
                toSkip={syncPreview.filter((r) => r.action === 'Skip').length}
              >
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500">
                      <th className="text-left py-2 pr-4 font-medium">Record ID</th>
                      <th className="text-left py-2 pr-4 font-medium">Title</th>
                      <th className="text-left py-2 pr-4 font-medium">Details</th>
                      <th className="text-left py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncPreview.slice(0, 20).map((row, idx) => (
                      <tr key={row.id + idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-1.5 pr-4 font-mono text-gray-600">{row.id}</td>
                        <td className="py-1.5 pr-4 text-gray-700 max-w-[200px] truncate">{row.title}</td>
                        <td className="py-1.5 pr-4 text-gray-500">{row.details}</td>
                        <td className="py-1.5">
                          <Badge
                            text={row.action}
                            color={row.action === 'Create' ? 'bg-green-100 text-green-700' : row.action === 'Update' ? 'bg-amber-100 text-amber-700' : row.action === 'Error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {syncPreview.length > 20 && (
                  <p className="text-xs text-gray-400 mt-2">Showing 20 of {syncPreview.length} rows.</p>
                )}
              </PreviewTable>
            )}
          </ActionCard>
        </div>
      )}

      {/* ── Tab: Execution Output ── */}
      {activeTab === 'output' && (
        <div>
          <SectionHeader title="Execution Output" subtitle="Results from the most recent action in this session." />

          {!lastResult ? (
            <div className="text-center py-16 text-gray-400">
              <Activity size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No actions executed yet in this session.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Action</p>
                  <p className="text-base font-semibold text-gray-800 mt-0.5">{lastResult.action}</p>
                </div>
                <div className="flex items-center gap-2">
                  {lastResult.recordsFailed === 0 ? (
                    <Badge text="Success" color="bg-green-100 text-green-700" />
                  ) : (
                    <Badge text={`${lastResult.recordsFailed} failed`} color="bg-red-100 text-red-700" />
                  )}
                  <Badge text={`${lastResult.durationMs}ms`} color="bg-gray-100 text-gray-600" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Analysed', value: lastResult.recordsAnalysed, color: 'text-gray-700' },
                  { label: 'Created', value: lastResult.recordsCreated, color: 'text-green-700' },
                  { label: 'Skipped', value: lastResult.recordsSkipped, color: 'text-gray-500' },
                  { label: 'Failed', value: lastResult.recordsFailed, color: 'text-red-700' },
                ].map((m) => (
                  <div key={m.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 font-medium">{m.label}</p>
                    <p className={`text-xl font-bold mt-0.5 ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>

              {lastResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-700 mb-2">Errors ({lastResult.errors.length})</p>
                  <ul className="space-y-1">
                    {lastResult.errors.map((e, i) => (
                      <li key={i} className="text-xs text-red-600 font-mono">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={() => executeAction(confirmModal.action)}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

// ─── Action Card Component ────────────────────────────────────────────────────

function ActionCard({
  title, description, previewAction, executeAction, loadingPreview, executing,
  onPreview, onExecute, readOnly = false, children,
}: {
  title: string;
  description: string;
  previewAction: string;
  executeAction: string;
  loadingPreview: string | null;
  executing: string | null;
  onPreview: () => void;
  onExecute: (() => void) | null;
  readOnly?: boolean;
  children?: React.ReactNode;
}) {
  const isLoadingThisPreview = loadingPreview === previewAction;
  const isExecutingThis = executing === executeAction;
  const hasPreviewLoaded = children != null && (children as any).props != null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
            {readOnly && <Badge text="Preview Only (Phase 1)" color="bg-blue-100 text-blue-600" />}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onPreview}
            disabled={isLoadingThisPreview}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {isLoadingThisPreview ? <Spinner /> : <Eye size={13} />} Preview
          </button>
          {!readOnly && onExecute && (
            <button
              onClick={onExecute}
              disabled={!!executing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isExecutingThis ? <Spinner /> : <PlayCircle size={13} />} Execute
            </button>
          )}
        </div>
      </div>
      {children && <div className="border-t border-gray-100 p-5 bg-gray-50/50">{children}</div>}
    </div>
  );
}

// ─── Preview Table Wrapper ────────────────────────────────────────────────────

function PreviewTable({
  title, total, toCreate, toSkip, createLabel = 'To Create', skipLabel = 'To Skip', children,
}: {
  title: string;
  total: number;
  toCreate: number;
  toSkip: number;
  createLabel?: string;
  skipLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-3">
        <span className="text-xs font-semibold text-gray-600">{title}</span>
        <div className="flex gap-2">
          <Badge text={`${total} Total`} color="bg-gray-100 text-gray-600" />
          <Badge text={`${toCreate} ${createLabel}`} color="bg-green-100 text-green-700" />
          <Badge text={`${toSkip} ${skipLabel}`} color="bg-gray-100 text-gray-500" />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">{children}</div>
    </div>
  );
}
