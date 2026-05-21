'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Printer, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';
import { qzManager } from '@/lib/print/qz-tray';
import { checkAgentHealth, checkPrinterStatus } from '@/lib/print/agent-transport';
import { toast } from 'react-hot-toast';

interface PrinterRecord {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
}

export default function PrinterSetupClient() {
  const [agentOnline, setAgentOnline] = useState(false);
  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterRecord | null>(null);
  const [printerOnline, setPrinterOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [testPrinting, setTestPrinting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const healthy = await checkAgentHealth();
      setAgentOnline(healthy);

      const res = await fetch('/api/printers', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list: PrinterRecord[] = data?.printers ?? [];
        setPrinters(list);
        if (list.length > 0 && !selectedPrinter) {
          setSelectedPrinter(list[0]);
          const online = await checkPrinterStatus({ ip: list[0].ipAddress, port: list[0].port });
          setPrinterOnline(online);
        }
      }
    } catch (err) {
      console.error('[PRINTER_SETUP] Load failed:', err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePrinterChange = async (id: string) => {
    const p = printers.find(p => p.id === id);
    if (!p) return;
    setSelectedPrinter(p);
    setPrinterOnline(null);
    qzManager.setPrinter(p.name);
    const online = await checkPrinterStatus({ ip: p.ipAddress, port: p.port });
    setPrinterOnline(online);
  };

  const handleTestPrint = async () => {
    if (!selectedPrinter || !agentOnline) {
      toast.error(!agentOnline ? 'Local Print Service Not Running' : 'Please select a printer first');
      return;
    }
    setTestPrinting(true);
    try {
      const timestamp = new Date().toLocaleString();
      const commands = [
        '\x1B\x40', '\x1B\x61\x01', '\x1D\x21\x11', 'TEST PRINT SUCCESS\n',
        '\x1D\x21\x00', '\x1B\x61\x00', '--------------------------------\n',
        `Time: ${timestamp}\n`, `Printer: ${selectedPrinter.name}\n`,
        `IP: ${selectedPrinter.ipAddress}:${selectedPrinter.port}\n`,
        '--------------------------------\n', '\x1B\x64\x03', '\x1D\x56\x41\x00'
      ];
      await qzManager.printRaw(commands);
      toast.success('Test print sent!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test Print Failed';
      console.error('[TEST_PRINT] Error:', err);
      toast.error(msg);
    } finally {
      setTestPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A2766]" />
      </div>
    );
  }

  const isSilentReady = agentOnline && !!selectedPrinter && printerOnline === true;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[#1A2766]">
          <Settings className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Printer Setup</h1>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 ${agentOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          <div className={`w-2 h-2 rounded-full ${agentOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          Print Agent {agentOnline ? 'Running' : 'Not Running'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: agent status + info */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
              <Info className="w-4 h-4" />
              <span>Network Print Agent</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                <span>
                  Printing uses <strong>warehouse-print-agent</strong> running on this machine at{' '}
                  <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">localhost:3001</code>.
                  No certificates or browser storage needed.
                </span>
              </p>
              <div className={`p-4 rounded-lg border flex items-center gap-3 ${agentOnline ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                {agentOnline ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                )}
                <div>
                  <div className={`text-sm font-bold ${agentOnline ? 'text-emerald-800' : 'text-red-700'}`}>
                    {agentOnline ? 'Agent Running' : 'Agent Not Running'}
                  </div>
                  {!agentOnline && (
                    <p className="text-xs text-red-600 mt-0.5">
                      Run <code className="font-mono">npm run dev</code> in the <code className="font-mono">warehouse-print-agent</code> directory.
                    </p>
                  )}
                </div>
              </div>
              {!agentOnline && (
                <button onClick={loadData} className="w-full py-2 rounded-lg border border-[#1A2766] text-[#1A2766] text-sm font-bold hover:bg-gray-50 transition-all">
                  Retry Connection
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Printer selection and test */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
              <Printer className="w-4 h-4" />
              <span>Printer Configuration</span>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Select Target Printer</label>
                <select
                  className="w-full border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] outline-none"
                  value={selectedPrinter?.id ?? ''}
                  onChange={(e) => handlePrinterChange(e.target.value)}
                  disabled={!agentOnline || printers.length === 0}
                >
                  <option value="">Select a printer...</option>
                  {printers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.ipAddress})</option>
                  ))}
                </select>
                {printers.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-medium">
                    No printers configured. Go to Admin → Printer Management to add one.
                  </p>
                )}
                {selectedPrinter && (
                  <div className={`text-[10px] font-bold ${printerOnline === true ? 'text-emerald-600' : printerOnline === false ? 'text-red-500' : 'text-gray-400'}`}>
                    {printerOnline === true ? '● Printer Online' : printerOnline === false ? '● Printer Offline' : '● Checking...'}
                  </div>
                )}
              </div>

              <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Silent Print Ready</span>
                  {isSilentReady ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  )}
                </div>

                <button
                  onClick={handleTestPrint}
                  disabled={!isSilentReady || testPrinting}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isSilentReady ? 'bg-[#1A2766] text-white hover:bg-[#1A2766]/90' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  {testPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  Test Print
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#1A2766]/5 border border-[#1A2766]/10 flex gap-3">
            <Info className="w-5 h-5 text-[#1A2766] shrink-0" />
            <div className="space-y-1">
              <div className="text-sm font-bold text-[#1A2766]">Infrastructure Note</div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Printers are managed centrally in <strong>Admin → Printer Management</strong>.
                No per-browser setup required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
