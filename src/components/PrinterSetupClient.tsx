'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Printer, CheckCircle2, AlertCircle, Loader2, Info, Check, Wifi, WifiOff } from 'lucide-react';
import { qzManager } from '@/lib/print/qz-tray';
import { EscPosRenderer } from '@/lib/print/esc-pos-renderer';
import { toast } from 'react-hot-toast';

interface PrinterRecord {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  printerType: string;
  isActive: boolean;
}

export default function PrinterSetupClient() {
  const [qzConnected, setQzConnected] = useState(false);
  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [activePrinter, setActivePrinter] = useState<PrinterRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pingStatus, setPingStatus] = useState<'idle' | 'pinging' | 'reachable' | 'unreachable'>('idle');
  const [testPrinting, setTestPrinting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch active printers from database
      const listRes = await fetch('/api/staff/printers');
      if (listRes.ok) {
        const listData = await listRes.json();
        setPrinters(listData || []);
      }

      // 2. Fetch logged-in user's mapped printer setup
      const userPrinterRes = await fetch('/api/staff/printer');
      if (userPrinterRes.ok) {
        const printer = await userPrinterRes.json();
        if (printer) {
          setSelectedPrinterId(printer.id);
          setActivePrinter(printer);
        }
      }
      
      const connected = await qzManager.connect();
      setQzConnected(connected);
    } catch (err) {
      console.error('[PRINTER_SETUP] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      setQzConnected(qzManager.isConnected());
    }, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle printer selection from dropdown
  const handleSelectPrinter = async (id: string) => {
    setSelectedPrinterId(id);
    const p = printers.find(x => x.id === id) || null;
    setActivePrinter(p);
    setPingStatus('idle');

    setSaving(true);
    try {
      const res = await fetch('/api/staff/printer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerId: id || null }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to map printer');
      }

      toast.success(id ? 'Printer mapped successfully!' : 'Printer unmapped.');
      // Refresh the printer in qzManager
      await qzManager.loadPrinter(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save printer mapping');
    } finally {
      setSaving(false);
    }
  };

  const handlePingPrinter = async () => {
    if (!activePrinter) {
      toast.error('Please select a printer first');
      return;
    }
    setPingStatus('pinging');
    try {
      const res = await fetch('/api/staff/printer/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerIp: activePrinter.ipAddress,
          printerPort: activePrinter.port,
        }),
      });
      if (!res.ok) throw new Error('Ping failed');
      const data = await res.json();
      setPingStatus(data.reachable ? 'reachable' : 'unreachable');
      if (data.reachable) {
        toast.success('Printer is reachable!');
      } else {
        toast.error('Printer is unreachable.');
      }
    } catch (err) {
      setPingStatus('unreachable');
      toast.error('Ping check failed');
    }
  };

  const handleTestPrint = async () => {
    if (!activePrinter) {
      toast.error('Please configure and select a printer first');
      return;
    }
    setTestPrinting(true);
    try {
      const renderer = new EscPosRenderer();
      renderer
        .align('center').bold().text('KAMNA TRADERS').bold(false)
        .line().text('TEST PRINT SUCCESS').line()
        .line('--------------------------------')
        .align('left')
        .line(`Time: ${new Date().toLocaleString()}`)
        .line(`Printer: ${activePrinter.name}`)
        .line(`IP: ${activePrinter.ipAddress}:${activePrinter.port}`)
        .line('--------------------------------')
        .feed(3).cut();

      await qzManager.printRaw(renderer.build());
      toast.success('Test print sent!');
    } catch (err: any) {
      console.error('[TEST_PRINT] Error:', err);
      toast.error(err.message || 'Print failed');
    } finally {
      setTestPrinting(false);
    }
  };

  // Filter printers based on search text
  const filteredPrinters = printers.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.ipAddress.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#AE1B1E]" />
      </div>
    );
  }

  const isReady = qzConnected && !!activePrinter;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Personal Printer Configuration</h2>
          <p className="text-xs text-gray-500">Configure your direct Ethernet printing settings.</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${qzConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {qzConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          QZ Tray: {qzConnected ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 bg-white p-5 rounded-xl border shadow-sm">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Printer size={14} /> Printer Selection
          </h3>
          
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500 uppercase">Search & Select Printer</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Filter printers by name or IP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#AE1B1E] mb-2"
              />
            </div>
            
            <select
              value={selectedPrinterId}
              onChange={(e) => handleSelectPrinter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-[#AE1B1E] bg-white"
            >
              <option value="">-- No Printer Configured --</option>
              {filteredPrinters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.ipAddress})
                </option>
              ))}
            </select>
          </div>

          {/* Read-Only Selected Printer Metadata */}
          {activePrinter && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
              <div className="text-[10px] uppercase font-bold text-gray-400">Selected Printer Specs</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400 block">Printer Name</span>
                  <span className="font-bold text-gray-700">{activePrinter.name}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">IP Address</span>
                  <span className="font-mono font-bold text-gray-700">{activePrinter.ipAddress}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Port</span>
                  <span className="font-mono font-bold text-gray-700">{activePrinter.port}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Command Set</span>
                  <span className="font-bold text-gray-700">{activePrinter.printerType}</span>
                </div>
              </div>
            </div>
          )}

          {saving && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <Loader2 size={12} className="animate-spin" />
              Saving mapping settings to your user account...
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <Info size={14} /> Diagnostic Tools
            </h3>

            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePingPrinter}
                  disabled={pingStatus === 'pinging' || !activePrinter}
                  className="flex-1 bg-gray-900 hover:bg-black text-white font-bold text-xs py-2 rounded-lg transition-all disabled:opacity-50"
                >
                  {pingStatus === 'pinging' ? 'Testing Connection...' : 'Ping Printer'}
                </button>

                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={!isReady || testPrinting}
                  className={`flex-1 font-bold text-xs py-2 rounded-lg border transition-all ${
                    isReady 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                      : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  {testPrinting ? 'Printing...' : 'Test Print'}
                </button>
              </div>

              {pingStatus === 'reachable' && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-100">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>Printer is REACHABLE! Ready to print.</span>
                </div>
              )}

              {pingStatus === 'unreachable' && (
                <div className="flex items-center gap-2 text-[11px] text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-100">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Printer is UNREACHABLE. Check printer power & network.</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex gap-2.5">
            <Info className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Printers are configured centrally by Administrators. Select your assigned physical POS terminal from the list to enable ticket printing in your warehouse terminal.
              </p>
              <a
                href="/staff/print-debug"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#AE1B1E] hover:underline"
              >
                Open Advanced POS Diagnostics Console ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
