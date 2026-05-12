'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, Printer, Wifi, CheckCircle2, AlertCircle, Upload, Trash2, Loader2, Info, ChevronRight, Lock, Fingerprint, Activity } from 'lucide-react';
import * as qz from 'qz-tray';
import { qzManager } from '@/lib/print/qz-tray';
import { saveQZConfig, getQZConfig, clearQZConfig, QZConfig } from '@/lib/print/qz-storage';
import { toast } from 'react-hot-toast';
import { KEYUTIL, X509, KJUR } from 'jsrsasign';

export default function PrinterSettingsTab() {
  const [isQZConnected, setIsQZConnected] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [config, setConfig] = useState<QZConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testPrinting, setTestPrinting] = useState(false);
  const [testPrintSuccess, setTestPrintSuccess] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const savedConfig = await getQZConfig();
      setConfig(savedConfig);
      if (savedConfig?.printerName) {
        setSelectedPrinter(savedConfig.printerName);
        qzManager.setPrinter(savedConfig.printerName);
      }

      const connected = await qzManager.connect();
      setIsQZConnected(connected);
      
      if (connected) {
        const list = await qzManager.getAllPrinters();
        setPrinters(list);
      }
    } catch (err) {
      console.error('[PRINTER_SETTINGS] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Status Metrics
  const status = useMemo(() => {
    const hasSecurity = !!(config?.certificate && config?.privateKey);
    const hasConnection = isQZConnected;
    const hasPrinter = !!selectedPrinter;
    const isReady = hasSecurity && hasConnection && hasPrinter && testPrintSuccess;

    return { hasSecurity, hasConnection, hasPrinter, isReady };
  }, [config, isQZConnected, selectedPrinter, testPrintSuccess]);

  const handleFileUpload = async (file: File, type: 'cert' | 'key') => {
    const text = await file.text();
    const isCert = type === 'cert';
    const marker = isCert ? '-----BEGIN CERTIFICATE-----' : '-----BEGIN PRIVATE KEY-----';

    if (!text.includes(marker)) {
      toast.error(`Invalid ${isCert ? 'certificate' : 'private key'} format`);
      return;
    }

    const newConfig = {
      certificate: isCert ? text : (config?.certificate || ''),
      privateKey: isCert ? (config?.privateKey || '') : text,
      printerName: selectedPrinter,
      configuredAt: new Date().toISOString()
    };
    
    await saveQZConfig(newConfig);
    setConfig({ id: 'current_setup', ...newConfig });
    toast.success(`${isCert ? 'Certificate' : 'Private Key'} uploaded`);
  };

  const handlePrinterChange = async (name: string) => {
    setSelectedPrinter(name);
    qzManager.setPrinter(name);
    if (config) {
      await saveQZConfig({ ...config, printerName: name });
    }
    toast.success(`Printer set to ${name}`);
  };

  const handleTestPrint = async () => {
    setTestPrinting(true);
    try {
      const timestamp = new Date().toLocaleString();
      const commands = [
        '\x1B\x40', '\x1B\x61\x01', '\x1D\x21\x11', 'VERIFICATION SUCCESS\n',
        '\x1D\x21\x00', '\x1B\x61\x00', '--------------------------------\n',
        `Time: ${timestamp}\n`, `Printer: ${selectedPrinter}\n`, 'Status: Operational\n',
        '--------------------------------\n', '\x1B\x64\x03', '\x1D\x56\x41\x00'
      ];
      await qzManager.printRaw(commands);
      setTestPrintSuccess(true);
      toast.success('Test print successful!');
    } catch (err: any) {
      toast.error(`Print failed: ${err.message}`);
    } finally {
      setTestPrinting(false);
    }
  };

  const resetAll = async () => {
    if (!confirm('Reset local configuration?')) return;
    await clearQZConfig();
    setConfig(null);
    setSelectedPrinter('');
    setTestPrintSuccess(false);
    toast.success('Configuration reset');
  };

  if (loading) return <div className="p-8 text-center text-gray-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Loading...</div>;

  return (
    <div className="flex flex-col h-full bg-gray-50/30">
      {/* Quick Status Bar */}
      <div className="grid grid-cols-4 border-b border-gray-100 bg-white">
        <StatusBadge label="Security" active={status.hasSecurity} />
        <StatusBadge label="Connection" active={status.hasConnection} />
        <StatusBadge label="Printer" active={status.hasPrinter} />
        <StatusBadge label="Ready" active={status.isReady} successColor />
      </div>

      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        {/* Success Celebration */}
        {status.isReady && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
            <div className="bg-emerald-500 text-white p-2 rounded-full shadow-lg shadow-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-900 leading-tight">Setup Complete</h3>
              <p className="text-xs text-emerald-700">Silent printing is now active for this browser. Printer: <span className="font-bold">{selectedPrinter}</span></p>
            </div>
            <button onClick={resetAll} className="ml-auto text-xs font-bold text-emerald-600 hover:underline">Reset Device</button>
          </div>
        )}

        {/* Steps Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Step 1: Security */}
          <StepCard 
            step={1} 
            title="Security Setup" 
            active={true} 
            complete={status.hasSecurity}
          >
            <div className="grid grid-cols-2 gap-3">
              <MiniUpload 
                label="Certificate" 
                complete={!!config?.certificate} 
                onUpload={(f) => handleFileUpload(f, 'cert')} 
              />
              <MiniUpload 
                label="Private Key" 
                complete={!!config?.privateKey} 
                onUpload={(f) => handleFileUpload(f, 'key')} 
                accept=".pem"
              />
            </div>
            {status.hasSecurity && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Credentials stored locally
                </p>
                <details className="group">
                  <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 font-medium">View Diagnostic Info</summary>
                  <div className="mt-2 p-3 bg-gray-900 rounded-lg font-mono text-[9px] text-emerald-400 space-y-1 overflow-x-auto">
                    <div>Algorithm: RSASSA-PKCS1-v1_5</div>
                    <div>Hash: SHA-256 (QZ Standard)</div>
                    <div>Key Format: {config?.privateKey?.includes('RSA PRIVATE KEY') ? 'PKCS#1' : 'PKCS#8'}</div>
                    <div className="pt-1 border-t border-gray-800 text-gray-500 uppercase font-black text-[8px]">Cert Fingerprint</div>
                    <div className="break-all opacity-70">
                      {config?.certificate?.slice(30, 60)}...
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-gray-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-[8px] uppercase font-black">Crypto Audit</span>
                        <button 
                          onClick={async () => {
                            try {
                              if (!config?.certificate || !config?.privateKey) throw new Error('Files missing');
                              
                              // 1. Verify Pair Match (Public Key vs Private Key)
                              const x509 = new X509();
                              x509.readCertPEM(config.certificate);
                              const pubKey: any = x509.getPublicKey();
                              const privKey: any = KEYUTIL.getKey(config.privateKey);
                              
                              const modulusMatch = pubKey.n.toString() === privKey.n.toString();
                              
                              // 2. Local Sign & Verify Loop
                              const testPayload = "QZ_AUDIT_" + Date.now();
                              const sigAlg = "SHA1withRSA"; // Switched to SHA1 for Demo compatibility
                              
                              const sig = new KJUR.crypto.Signature({ alg: sigAlg });
                              sig.init(privKey);
                              sig.updateString(testPayload);
                              const sigHex = sig.sign();
                              
                              const ver = new KJUR.crypto.Signature({ alg: sigAlg });
                              ver.init(config.certificate);
                              ver.updateString(testPayload);
                              const verified = ver.verify(sigHex);

                              if (modulusMatch && verified) {
                                toast.success(`Crypto Audit: Pair Matched & Verified (${sigAlg})`);
                              } else if (!modulusMatch) {
                                toast.error('Crypto Audit: KEY PAIR MISMATCH. Private key does not belong to this certificate.');
                              } else {
                                toast.error('Crypto Audit: Local signature verification failed.');
                              }
                            } catch (err: any) {
                              console.error('Audit failed:', err);
                              toast.error(`Audit error: ${err.message}`);
                            }
                          }}
                          className="px-3 py-1 bg-emerald-500 text-black text-[8px] font-black uppercase rounded hover:bg-emerald-400 transition-all"
                        >
                          Run Full Pair Audit
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[8px] font-bold">
                        <div className="p-2 bg-black/40 rounded border border-white/5">
                          <div className="text-gray-500 uppercase mb-0.5">Algorithm</div>
                          <div className="text-white">RSASSA-PKCS1-v1_5</div>
                        </div>
                        <div className="p-2 bg-black/40 rounded border border-white/5">
                          <div className="text-gray-500 uppercase mb-0.5">Hash</div>
                          <div className="text-white">SHA-1 (Legacy/Demo)</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </StepCard>

          {/* Step 2: QZ Connection */}
          <StepCard 
            step={2} 
            title="QZ Handshake" 
            active={status.hasSecurity} 
            complete={status.hasConnection}
          >
            <div className={`p-4 rounded-xl border flex items-center justify-between ${status.hasConnection ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-3">
                <Wifi className={`w-5 h-5 ${status.hasConnection ? 'text-blue-600' : 'text-gray-400'}`} />
                <div>
                  <div className="text-xs font-bold text-gray-700">WebSocket Status</div>
                  <div className={`text-[10px] font-medium ${status.hasConnection ? 'text-blue-600' : 'text-gray-400'}`}>
                    {status.hasConnection ? 'Link Active' : 'Offline'}
                  </div>
                </div>
              </div>
              {!status.hasConnection && (
                <button 
                  onClick={loadData}
                  className="text-[10px] font-black text-[#1A2766] uppercase tracking-wider hover:underline"
                >
                  Retry Link
                </button>
              )}
            </div>
            {status.hasConnection && (
              <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                <span>QZ Tray {(qz as any).version} detected</span>
              </div>
            )}
          </StepCard>

          {/* Step 3: Selection */}
          <StepCard 
            step={3} 
            title="Printer Target" 
            active={status.hasConnection} 
            complete={status.hasPrinter}
          >
            <div className="space-y-3">
              <select 
                className="w-full text-xs font-bold bg-white border border-gray-200 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#1A2766]/10 disabled:opacity-50"
                value={selectedPrinter}
                onChange={(e) => handlePrinterChange(e.target.value)}
                disabled={!status.hasConnection}
              >
                <option value="">Choose local printer...</option>
                {printers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <Info className="w-3 h-3" />
                <span>Printer must be visible in System Settings.</span>
              </div>
            </div>
          </StepCard>

          {/* Step 4: Verification */}
          <StepCard 
            step={4} 
            title="Final Verification" 
            active={status.hasPrinter} 
            complete={testPrintSuccess}
          >
            <button
              onClick={handleTestPrint}
              disabled={!status.hasPrinter || testPrinting}
              className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                testPrintSuccess 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700' 
                  : status.hasPrinter 
                    ? 'bg-[#1A2766] text-white hover:shadow-lg' 
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {testPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {testPrintSuccess ? 'Re-Run Test Print' : 'Send Test Print'}
            </button>
          </StepCard>

        </div>

        {/* Production Diagnostics (Always visible for troubleshooting) */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Production Connectivity Audit
            </h3>
            <span className="text-[10px] font-bold text-gray-400">Environment: {process.env.NEXT_PUBLIC_QZ_MODE || 'Production'}</span>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <DiagnosticItem 
              label="Certificate API" 
              onClick={async () => {
                const res = await fetch('/api/qz/certificate');
                return res.ok ? 'REACHABLE' : `ERROR: ${res.status}`;
              }}
            />
            <DiagnosticItem 
              label="Signing API" 
              onClick={async () => {
                const res = await fetch('/api/qz/sign', { method: 'POST', body: JSON.stringify({ payload: 'test' }) });
                return res.ok ? 'REACHABLE' : `ERROR: ${res.status}`;
              }}
            />
            <DiagnosticItem 
              label="Origin Trust" 
              onClick={async () => {
                const active = qz.websocket.isActive();
                return active ? 'ACTIVE' : 'DISCONNECTED';
              }}
            />
          </div>
        </div>

        {/* Footer Help */}
        <div className="bg-gray-100/50 p-4 rounded-xl border border-dashed border-gray-200">
          <p className="text-[10px] text-gray-500 leading-relaxed text-center">
            <strong>Operational Note:</strong> This setup is unique to this browser instance. <br />
            Configured by machine local IndexedDB storage. Keys are never transmitted to server.
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatusBadge({ label, active, successColor = false }: { label: string; active: boolean; successColor?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-3 border-r border-gray-50 last:border-0 ${active ? (successColor ? 'bg-emerald-50' : 'bg-blue-50') : 'bg-white'}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${active ? (successColor ? 'bg-emerald-500' : 'bg-blue-500') : 'bg-gray-300'}`} />
      <span className={`text-[10px] font-black uppercase tracking-widest ${active ? (successColor ? 'text-emerald-700' : 'text-blue-700') : 'text-gray-400'}`}>{label}</span>
    </div>
  );
}

function StepCard({ step, title, children, active, complete }: { step: number; title: string; children: React.ReactNode; active: boolean; complete: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border transition-all duration-300 ${active ? 'border-gray-100 shadow-sm' : 'border-gray-50 opacity-40 grayscale pointer-events-none'}`}>
      <div className="p-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${complete ? 'bg-emerald-100 text-emerald-600' : 'bg-[#1A2766] text-white'}`}>
            {complete ? <CheckCircle2 className="w-4 h-4" /> : step}
          </div>
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-wide">{title}</h3>
        </div>
        {!active && <Lock className="w-4 h-4 text-gray-300" />}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MiniUpload({ label, complete, onUpload, accept = ".txt" }: { label: string; complete: boolean; onUpload: (f: File) => void; accept?: string }) {
  return (
    <div className={`relative border border-dashed rounded-xl p-3 text-center transition-all ${complete ? 'bg-emerald-50/50 border-emerald-100' : 'border-gray-200 hover:border-gray-300'}`}>
      <input 
        type="file" 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
        onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        accept={accept}
      />
      <Upload className={`w-4 h-4 mx-auto mb-1 ${complete ? 'text-emerald-500' : 'text-gray-300'}`} />
      <div className={`text-[10px] font-bold ${complete ? 'text-emerald-700' : 'text-gray-500'}`}>
        {complete ? 'Installed' : label}
      </div>
    </div>
  );
}

function DiagnosticItem({ label, onClick }: { label: string; onClick: () => Promise<string> }) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col gap-2">
      <div className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="flex items-center justify-between gap-2">
        <div className={`text-[10px] font-bold ${status?.includes('ERROR') ? 'text-red-500' : status ? 'text-emerald-600' : 'text-gray-400'}`}>
          {status || 'UNTESTED'}
        </div>
        <button 
          onClick={async () => {
            setLoading(true);
            try {
              const res = await onClick();
              setStatus(res);
            } catch (e: any) {
              setStatus(`FAIL: ${e.message}`);
            } finally {
              setLoading(false);
            }
          }}
          className="p-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-400 transition-all"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}
