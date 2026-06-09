'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, CheckCircle, AlertTriangle, Zap, ChevronDown, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDcrStats } from '../layout';

// Robust client-side parser to extract serial numbers cleanly based on mode
const parseSerials = (text: string, mode: 'line' | 'comma' | 'dcr_cert') => {
  if (mode === 'line') {
    return text.split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  if (mode === 'comma') {
    return text.split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
  
  // DCR Certificate Text Mode (Regex-based intelligent extraction)
  const matches = text.match(/[A-Z0-9-]+/gi) || [];
  const serials: string[] = [];
  const excludeKeywords = new Set([
    'SERIAL', 'PANEL', 'RATING', 'MODULE', 'WATTAGE', 'VENDOR', 'INVOICE', 'NUMBER', 'STATUS', 'DCR', 'RECEIVED',
    'DETAILS', 'ELIGIBLE', 'PENDING', 'PROCESSED', 'PRODUCT', 'REPORT', 'ACTION', 'FAILURE', 'REASON'
  ]);
  
  for (const m of matches) {
    const cleaned = m.trim().toUpperCase();
    if (cleaned.length < 6 || cleaned.length > 30) continue;
    
    // Ignore wattage/ratings like 620WP, 620W, 545W
    if (/^\d+W[P]?$/i.test(cleaned)) continue;
    
    // Ignore common keywords
    if (excludeKeywords.has(cleaned)) continue;
    
    serials.push(cleaned);
  }
  
  return serials;
};


function PurchaseDcrReceivedContent() {
  const { refreshStats } = useDcrStats();
  const searchParams = useSearchParams();
  const receiptId = searchParams?.get('receiptId');
  const [mode, setMode] = useState<'normal' | 'quick' | 'prefilled'>('normal');
  const [importMode, setImportMode] = useState<'line' | 'comma' | 'dcr_cert'>('dcr_cert');
  
  // Normal / Quick mode state
  const [skuId, setSkuId] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [skuDropdownOpen, setSkuDropdownOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  
  // Prefilled mode state
  const [vendorName, setVendorName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [prefilledLines, setPrefilledLines] = useState<{skuId: string, skuName: string, rawText: string}[]>([]);
  const [isFullyProcessed, setIsFullyProcessed] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skus, setSkus] = useState<any[]>([]);

  // Progress Modal state
  const [progressStage, setProgressStage] = useState<'validating' | 'duplicates' | 'saving' | null>(null);
  const [progressCount, setProgressCount] = useState(0);

  // Validation Report Modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState<{ total: number, imported: any[], failed: any[] } | null>(null);
  const [reportTab, setReportTab] = useState<'failed' | 'success'>('failed');

  useEffect(() => {
    fetch('/api/staff/skus')
      .then(r => r.json())
      .then(data => {
        const filtered = (data.skus || data || []).filter((s: any) => s.caseSize > 1 && s.isActive !== false);
        setSkus(filtered);
      })
      .catch(() => setSkus([]));
  }, []);

  useEffect(() => {
    if (!receiptId) return;

    const fetchReceipt = async () => {
      try {
        const res = await fetch(`/api/admin/dcr/purchase-receive/details?id=${encodeURIComponent(receiptId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch receipt details');

        setMode('prefilled');
        setVendorName(data.vendorName);
        setBillNumber(data.billNumber);
        
        if (!data.lines || data.lines.length === 0) {
          setIsFullyProcessed(true);
          toast('All serials in this receipt are already processed.', { icon: '✅' });
        } else {
          setIsFullyProcessed(false);
          const lines = data.lines.map((l: any) => ({
            skuId: l.skuId,
            skuName: l.skuName,
            rawText: l.eligibleSerials.join('\n')
          }));
          setPrefilledLines(lines);
          
          const totalEligible = data.lines.reduce((acc: number, l: any) => acc + l.eligibleSerials.length, 0);
          toast.success(`Purchase receipt loaded successfully.\n${totalEligible} eligible serial numbers ready for DCR processing.`, { duration: 5000 });
        }
      } catch (err: any) {
        toast.error(err.message);
      }
    };
    fetchReceipt();
  }, [receiptId]);

  const filteredSkus = skus.filter(s => s.name.toLowerCase().includes(skuSearch.toLowerCase())).slice(0, 20);

  // Compute preview serials dynamically
  const getExtractedSerials = () => {
    if (mode === 'prefilled') {
      return prefilledLines.flatMap(l => parseSerials(l.rawText, importMode));
    }
    return parseSerials(rawText, importMode);
  };
  const extractedSerials = getExtractedSerials();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const serials = extractedSerials;

    if (serials.length === 0) {
      toast.error('No serial numbers detected for import.');
      return;
    }
    if (mode !== 'prefilled' && mode === 'quick' && !skuId) {
      toast.error('Please select an item for Quick Entry mode.');
      return;
    }

    setIsSubmitting(true);
    setProgressStage('validating');
    setProgressCount(0);

    try {
      const apiPromise = fetch('/api/admin/dcr/purchase-dcr-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serials, skuId: mode === 'quick' ? skuId : undefined })
      });

      const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (let c = 0; c <= serials.length; c += Math.max(1, Math.ceil(serials.length / 5))) {
        setProgressCount(Math.min(c, serials.length));
        await wait(80);
      }
      setProgressCount(serials.length);
      await wait(100);

      setProgressStage('duplicates');
      setProgressCount(0);
      for (let c = 0; c <= serials.length; c += Math.max(1, Math.ceil(serials.length / 5))) {
        setProgressCount(Math.min(c, serials.length));
        await wait(80);
      }
      setProgressCount(serials.length);
      await wait(100);

      setProgressStage('saving');
      setProgressCount(serials.length);

      const res = await apiPromise;
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process DCR certificates');
      }

      setReportData({
        total: serials.length,
        imported: data.imported || [],
        failed: data.failed || []
      });
      setReportTab(data.failed?.length > 0 ? 'failed' : 'success');
      setShowReportModal(true);

      if (data.imported?.length > 0) {
        toast.success(`Successfully processed ${data.imported.length} DCR certificates.`);
        
        if (mode === 'prefilled') {
          const successSerials = new Set(data.imported.map((i: any) => i.serial));
          const updatedLines = prefilledLines.map(line => {
            const lineSerials = parseSerials(line.rawText, importMode);
            const remaining = lineSerials.filter(s => !successSerials.has(s.trim().toUpperCase()));
            return {
              ...line,
              rawText: remaining.join('\n')
            };
          });
          setPrefilledLines(updatedLines);
          
          const totalRemaining = updatedLines.reduce((acc, l) => acc + parseSerials(l.rawText, importMode).length, 0);
          if (totalRemaining === 0) {
            setIsFullyProcessed(true);
          }
        } else {
          if (data.failed?.length > 0) {
            const failedSerials = data.failed.map((f: any) => f.serial || '').filter(Boolean);
            setRawText(failedSerials.join('\n'));
          } else {
            setRawText('');
            if (mode === 'quick') {
              setSkuId('');
              setSkuSearch('');
            }
          }
        }
        refreshStats();
      } else if (data.failed?.length > 0) {
        toast.error('All serial numbers failed validation checks.');
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected failure occurred.');
    } finally {
      setIsSubmitting(false);
      setProgressStage(null);
    }
  };

  const updatePrefilledLine = (index: number, newText: string) => {
    const updated = [...prefilledLines];
    updated[index].rawText = newText;
    setPrefilledLines(updated);
  };

  const handleDownloadReport = () => {
    if (!reportData) return;
    const headers = ['Serial', 'Result', 'Reason'];
    const rows = [
      ...reportData.imported.map((i: any) => [i.serial, 'Success', i.status]),
      ...reportData.failed.map((f: any) => [f.serial, 'Failed', f.reason])
    ];
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dcr_import_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/30 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Purchase DCR Received</h1>
          <p className="text-sm text-gray-500 mt-1">Import Vendor DCR certificates to mark serial numbers as DCR-compliant.</p>
        </div>

        {/* Mode Toggle (Hidden in Prefilled Mode) */}
        {mode !== 'prefilled' && (
          <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-xl border border-gray-200/60">
            <button
              type="button"
              onClick={() => setMode('normal')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                mode === 'normal' ? 'bg-white text-[#1A2766] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" /> Normal Mode
            </button>
            <button
              type="button"
              onClick={() => setMode('quick')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                mode === 'quick' ? 'bg-white text-amber-600 shadow-sm border border-amber-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Zap className="w-4 h-4" /> Quick Entry
            </button>
          </div>
        )}

        {/* Mode info */}
        {mode === 'prefilled' ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <Package className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-emerald-800">
              <p className="font-semibold mb-0.5">Prefilled Receipt Data</p>
              <p className="text-emerald-700/80">
                You are importing DCRs for an existing purchase receipt. The pending serials have been automatically loaded.
              </p>
            </div>
          </div>
        ) : mode === 'normal' ? (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-0.5">Smart Certificate Extraction</p>
              <p className="text-blue-700/80">Paste raw PDF text directly. The system extracts valid serial numbers, ignoring wattages, ratings, parenthesis, or PDF noise automatically.</p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <Zap className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-0.5">Quick Entry Mode — DCR Before Purchase Receive</p>
              <p className="text-amber-700/80">Use this when the DCR certificate arrives before physical panels are entered into the system. A SKU is required to lock the serial upon creation.</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {mode === 'quick' ? <Zap className="w-4 h-4 text-amber-500" /> : mode === 'prefilled' ? <Package className="w-4 h-4 text-emerald-500" /> : <FileText className="w-4 h-4 text-gray-500" />}
              <h2 className="font-semibold text-gray-800 text-sm">
                {mode === 'prefilled' ? 'Purchase Receipt DCR' : mode === 'normal' ? 'Import DCR Certificate' : 'Quick Entry — DCR Before Purchase'}
              </h2>
            </div>
            {mode === 'prefilled' && (
              <button 
                type="button" 
                onClick={() => { setMode('normal'); window.history.replaceState(null, '', '/staff/dashboard/accounts/dcr/purchase-dcr-received'); }} 
                className="text-xs font-medium text-gray-500 hover:text-gray-800 underline"
              >
                Clear Receipt
              </button>
            )}
          </div>

          <div className="p-5 space-y-5">
            
            {mode === 'prefilled' && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Vendor</label>
                  <p className="text-sm font-medium text-gray-900">{vendorName || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Bill / Invoice No.</label>
                  <p className="text-sm font-medium text-gray-900">{billNumber || 'N/A'}</p>
                </div>
              </div>
            )}

            {/* Parsing mode selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Parsing Mode</label>
              <div className="flex bg-gray-100/60 p-0.5 rounded-lg border border-gray-200 max-w-md">
                <button
                  type="button"
                  onClick={() => setImportMode('dcr_cert')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    importMode === 'dcr_cert' ? 'bg-white text-[#1A2766] shadow-sm border border-gray-200/40' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  DCR Certificate Text
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('line')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    importMode === 'line' ? 'bg-white text-[#1A2766] shadow-sm border border-gray-200/40' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  One Per Line
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('comma')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    importMode === 'comma' ? 'bg-white text-[#1A2766] shadow-sm border border-gray-200/40' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Comma Separated
                </button>
              </div>
            </div>

            {mode === 'prefilled' ? (
              isFullyProcessed ? (
                <div className="py-8 text-center bg-gray-50 rounded-xl border border-gray-200">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">All serial numbers in this purchase receipt have already been processed.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {prefilledLines.map((line, index) => {
                    const lineSerials = parseSerials(line.rawText, importMode);
                    return (
                      <div key={line.skuId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-gray-800">{line.skuName}</label>
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            {lineSerials.length} pending
                          </span>
                        </div>
                        <textarea
                          value={line.rawText}
                          onChange={e => updatePrefilledLine(index, e.target.value)}
                          placeholder="Paste serial numbers here..."
                          rows={6}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] bg-gray-50/50 font-mono text-sm resize-y transition-colors"
                        />
                        {lineSerials.length > 0 && (
                          <div className="bg-blue-50/30 border border-blue-100/50 rounded-xl p-2 text-[11px] space-y-1">
                            <div className="text-blue-900 font-semibold flex justify-between">
                              <span>Preview ({lineSerials.length} detected)</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {lineSerials.slice(0, 10).map((s, idx) => (
                                <span key={idx} className="px-1.5 py-0.5 bg-white border border-blue-200 text-blue-800 rounded font-mono text-[9px] shadow-sm">
                                  {s}
                                </span>
                              ))}
                              {lineSerials.length > 10 && <span className="text-[9px] text-gray-400 self-center pl-1 font-medium">+{lineSerials.length - 10} more</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <>
                {/* SKU (Quick Entry only) */}
                {mode === 'quick' && (
                  <div className="relative">
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Item (SKU) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type="text"
                        value={skuDropdownOpen ? skuSearch : (skus.find(s => s.id === skuId)?.name || skuSearch)}
                        onFocus={() => { setSkuDropdownOpen(true); setSkuSearch(''); }}
                        onChange={e => setSkuSearch(e.target.value)}
                        placeholder="Search and select SKU..."
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] text-sm pr-8 transition-colors"
                      />
                      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {skuDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                        {filteredSkus.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">No items found</div>
                        ) : filteredSkus.map(sku => (
                          <button
                            key={sku.id}
                            type="button"
                            onClick={() => { setSkuId(sku.id); setSkuSearch(sku.name); setSkuDropdownOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <span className="font-medium text-gray-900">{sku.name}</span>
                            <span className="ml-2 text-xs text-gray-400">Case: {sku.caseSize}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Serials textarea */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    {importMode === 'dcr_cert' ? 'Certificate Text / Serial Numbers' : 
                     importMode === 'comma' ? 'Comma-Separated Serials' : 'One Serial Per Line'}
                    <span className="text-red-500"> *</span>
                  </label>
                  <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder={importMode === 'dcr_cert'
                      ? 'Paste raw DCR certificate text here (e.g. AS260503093389 (620 Wp) AS260503093396 (620 Wp) ...'
                      : importMode === 'comma' ? 'ABC1234, ABC5678, ...' : 'ABC1234\nABC5678\n...'
                    }
                    rows={10}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#1A2766] focus:border-[#1A2766] bg-gray-50/50 font-mono text-sm resize-none transition-colors"
                  />
                  
                  {/* Preview Section */}
                  {extractedSerials.length > 0 ? (
                    <div className="mt-3 bg-blue-50/50 border border-blue-100 rounded-xl p-3 text-xs space-y-2">
                      <div className="font-semibold text-blue-900 flex justify-between items-center">
                        <span>Detected {extractedSerials.length} serials</span>
                        <span className="text-[10px] text-blue-500 font-normal">Showing first 10</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {extractedSerials.slice(0, 10).map((s, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded font-mono text-[10px] shadow-sm">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    rawText.trim() && (
                      <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-800 font-medium">
                        Zero serials detected. Please check your text or switch parsing mode.
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>

          <div className="px-5 py-4 bg-gray-50 border-t flex justify-end gap-3">
            <button
              type="submit"
              disabled={isSubmitting || extractedSerials.length === 0 || (mode === 'prefilled' && isFullyProcessed)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 text-sm"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Import Certificates
            </button>
          </div>
        </form>
      </div>

      {skuDropdownOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setSkuDropdownOpen(false)} />
      )}

      {/* Progress Modal */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-gray-100"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-[#1A2766] animate-spin"></div>
            </div>
            
            <div className="space-y-1">
              <h3 className="font-bold text-gray-900 text-sm">
                {progressStage === 'validating' ? 'Validating Certificates...' :
                 progressStage === 'duplicates' ? 'Checking Duplicates...' :
                 'Saving Serials...'}
              </h3>
              <p className="text-xs text-gray-500 font-medium animate-pulse">
                {progressCount} / {extractedSerials.length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Report Modal */}
      {showReportModal && reportData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-gray-900 text-sm">Certificate Import Validation Report</h3>
              <button 
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-600 font-medium text-sm"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 grid grid-cols-3 gap-4 text-center shrink-0">
              <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Entered</span>
                <span className="text-lg font-bold text-gray-900">{reportData.total}</span>
              </div>
              <div className="p-3 bg-white border border-emerald-200 rounded-xl shadow-sm">
                <span className="block text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Successfully Imported</span>
                <span className="text-lg font-bold text-emerald-600">{reportData.imported.length} Imported</span>
              </div>
              <div className="p-3 bg-white border border-red-200 rounded-xl shadow-sm">
                <span className="block text-[10px] font-bold text-red-500 uppercase tracking-wider">Failed</span>
                <span className="text-lg font-bold text-red-600">{reportData.failed.length} Failed</span>
              </div>
            </div>

            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setReportTab('failed')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    reportTab === 'failed' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Validation Failures ({reportData.failed.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReportTab('success')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    reportTab === 'success' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Imported Successfully ({reportData.imported.length})
                </button>
              </div>
              
              <button
                type="button"
                onClick={handleDownloadReport}
                className="bg-[#1A2766]/10 text-[#1A2766] hover:bg-[#1A2766]/20 border border-[#1A2766]/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                Download Validation Report
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 p-6">
              {reportTab === 'failed' ? (
                reportData.failed.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-sm font-medium">No validation failures.</div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs table-fixed">
                      <thead className="bg-gray-100 text-gray-600 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold w-[50px] text-center">#</th>
                          <th className="px-4 py-3 font-semibold w-[180px]">Serial Number</th>
                          <th className="px-4 py-3 font-semibold w-[220px]">Product / SKU</th>
                          <th className="px-4 py-3 font-semibold w-[140px]">Failure Type</th>
                          <th className="px-4 py-3 font-semibold">Detailed Reason</th>
                          <th className="px-4 py-3 font-semibold w-[140px]">Suggested Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {reportData.failed.map((f: any, idx: number) => (
                          <tr key={idx} className="hover:bg-red-50/20 transition-colors">
                            <td className="px-4 py-2.5 text-center text-gray-400 font-mono font-medium">{f.index || idx + 1}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-red-700 break-all">{f.serial || '-'}</td>
                            <td className="px-4 py-2.5 text-gray-950">
                              <div className="font-medium leading-snug">{f.skuName}</div>
                              <div className="font-mono text-[10px] text-gray-500 mt-0.5">{f.skuCode}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold uppercase border border-red-200">
                                {f.failureType}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 break-words">{f.reason}</td>
                            <td className="px-4 py-2.5 font-medium text-blue-900">{f.suggestedAction}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                reportData.imported.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-sm font-medium">No serials successfully imported.</div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs table-fixed">
                      <thead className="bg-gray-100 text-gray-600 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold w-[60px] text-center">#</th>
                          <th className="px-4 py-3 font-semibold w-[220px]">Serial</th>
                          <th className="px-4 py-3 font-semibold w-[220px]">Product / SKU</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {reportData.imported.map((imp: any, idx: number) => (
                          <tr key={idx} className="hover:bg-emerald-50/20 transition-colors">
                            <td className="px-4 py-2.5 text-center text-gray-400 font-mono">{idx + 1}</td>
                            <td className="px-4 py-2.5 font-mono font-bold text-emerald-700">{imp.serial}</td>
                            <td className="px-4 py-2.5 text-gray-950">
                              <div className="font-medium leading-snug">{imp.skuName}</div>
                              <div className="font-mono text-[10px] text-gray-500 mt-0.5">{imp.skuCode}</div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase border border-emerald-200">
                                {imp.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="bg-gray-900 text-white font-bold py-2 px-6 rounded-xl text-xs hover:bg-gray-800 transition-colors"
              >
                Close Report
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}

export default function PurchaseDcrReceivedPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center text-gray-500">Loading...</div>}>
      <PurchaseDcrReceivedContent />
    </Suspense>
  );
}
