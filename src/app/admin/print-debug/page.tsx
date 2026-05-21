'use client';

import { useState, useEffect } from 'react';
import { qzManager } from '@/lib/print/qz-tray';
import { checkAgentHealth, checkPrinterStatus } from '@/lib/print/agent-transport';
import { EscPosRenderer } from '@/lib/print/esc-pos-renderer';
import { generateDispatchSlip } from '@/lib/print/slip-renderer';
import { Printer, Wifi, WifiOff, Terminal, Play, Scissors, Trash2, CheckCircle2, AlertCircle, Loader2, Activity, ChevronRight } from 'lucide-react';

interface PrinterRecord {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
}

export default function PrintDebugPage() {
  const [agentOnline, setAgentOnline] = useState(false);
  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterRecord | null>(null);
  const [printerOnline, setPrinterOnline] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<{ time: string; msg: string; type: 'info' | 'error' | 'success' }[]>([]);
  const [busy, setBusy] = useState(false);

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  // Poll agent status every 2s
  useEffect(() => {
    const poll = async () => {
      const ok = await checkAgentHealth();
      setAgentOnline(ok);
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    addLog('Checking print agent at localhost:3001...');
    const ok = await checkAgentHealth();
    setAgentOnline(ok);
    if (ok) {
      addLog('Print Agent reachable', 'success');
      // Load printers from DB
      try {
        const res = await fetch('/api/printers', { credentials: 'include' });
        const data = await res.json();
        const list: PrinterRecord[] = data?.printers ?? [];
        setPrinters(list);
        addLog(`Found ${list.length} printer(s) in DB`, 'info');
        if (list.length > 0) {
          const p = list[0];
          setSelectedPrinter(p);
          addLog(`Active: ${p.name} (${p.ipAddress}:${p.port})`, 'info');
          const online = await checkPrinterStatus({ ip: p.ipAddress, port: p.port });
          setPrinterOnline(online);
          addLog(`Printer ${p.name}: ${online ? 'ONLINE' : 'OFFLINE'}`, online ? 'success' : 'error');
        }
      } catch (e) {
        addLog('Failed to load printers from DB', 'error');
      }
    } else {
      addLog('Print agent not reachable at localhost:3001', 'error');
    }
    setBusy(false);
  };

  const selectPrinterById = async (id: string) => {
    const p = printers.find(p => p.id === id);
    if (!p) return;
    setSelectedPrinter(p);
    setPrinterOnline(null);
    qzManager.setPrinter(p.name);
    addLog(`Selected: ${p.name} (${p.ipAddress}:${p.port})`, 'success');
    const online = await checkPrinterStatus({ ip: p.ipAddress, port: p.port });
    setPrinterOnline(online);
    addLog(`Printer status: ${online ? 'ONLINE' : 'OFFLINE'}`, online ? 'success' : 'error');
  };

  const testHello = async () => {
    if (!selectedPrinter) { addLog('No printer selected', 'error'); return; }
    try {
      setBusy(true);
      const renderer = new EscPosRenderer();
      renderer
        .align('center').bold().text('KAMNA TRADERS').bold(false)
        .line().text('DIAGNOSTIC TEST').line()
        .line('--------------------------------')
        .align('left')
        .line('Status: ONLINE')
        .line(`Time: ${new Date().toLocaleString()}`)
        .line('--------------------------------')
        .feed(3).cut();

      addLog('Sending diagnostic ping...');
      await qzManager.printRaw(renderer.build());
      addLog('Print job sent', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Print failed: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const testNewFlow = async () => {
    if (!selectedPrinter) { addLog('No printer selected', 'error'); return; }
    try {
      setBusy(true);
      addLog('Generating test dispatch slips...');

      const testPayload: any = {
        id: 'TEST-123',
        dispatchSlipNumber: 'KS-DP-TEST-001',
        customerName: 'Test Wholesale Customer (Verify Wrapping Logic)',
        warehouseName: 'Main Warehouse',
        staffName: 'Debug Admin',
        createdAt: new Date().toISOString(),
        items: [
          { skuId: 'SKU001', name: 'Standard Product', qty: 10, unit: 'pcs', zone: 'A' },
          { skuId: 'SKU002', name: 'Very Long Product Name That Should Wrap Properly On Thermal Paper Without Cutting Qty', qty: 5, unit: 'kg', zone: 'B' }
        ],
        zoneGroups: {
          'A': [{ skuId: 'SKU001', name: 'Standard Product', qty: 10, unit: 'pcs', zone: 'A' }],
          'B': [{ skuId: 'SKU002', name: 'Very Long Product Name That Should Wrap Properly On Thermal Paper Without Cutting Qty', qty: 5, unit: 'kg', zone: 'B' }]
        },
        qrPayload: 'https://test.com'
      };

      const renderer = new EscPosRenderer();
      const renderVirtualSlip = (lines: any[]) => {
        lines.forEach(line => {
          renderer.align(line.align || 'left');
          renderer.bold(!!line.bold);
          renderer.size(line.size || 'normal');
          renderer.line(line.text);
        });
      };

      addLog('Rendering Master Slip...');
      renderVirtualSlip(generateDispatchSlip(testPayload, false));
      renderer.cut();

      addLog('Rendering Duplicate Slip...');
      renderVirtualSlip(generateDispatchSlip(testPayload, true));
      renderer.cut();

      addLog('Sending job to agent → printer...');
      await qzManager.printRaw(renderer.build());
      addLog('Test flow complete', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Print failed: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const printerReady = agentOnline && !!selectedPrinter && printerOnline === true;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${agentOnline ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {agentOnline ? <Wifi size={24} /> : <WifiOff size={24} />}
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Print Diagnostics</h1>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                {agentOnline
                  ? `Agent Online${selectedPrinter ? ` · ${selectedPrinter.name} ${printerOnline === true ? '✓' : printerOnline === false ? '✗' : '…'}` : ' · No printer selected'}`
                  : 'Agent Offline — start warehouse-print-agent'}
              </p>
            </div>
          </div>
          <button
            onClick={handleConnect}
            disabled={busy}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center gap-2 ${
              agentOnline
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                : 'bg-[#AE1B1E] text-white hover:bg-red-800 shadow-lg shadow-red-200'
            }`}
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : agentOnline ? 'Refresh' : 'Connect'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-6">
            {/* Printer Selection */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Printer size={14} /> Printer Selection
              </h2>
              {printers.length > 0 ? (
                <div className="space-y-2">
                  {printers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectPrinterById(p.id)}
                      className={`w-full text-left p-3 rounded-lg text-xs font-bold transition-all border ${
                        selectedPrinter?.id === p.id
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-emerald-200'
                      }`}
                    >
                      <div>{p.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{p.ipAddress}:{p.port}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center border border-dashed">
                  {agentOnline ? 'No printers in DB. Add via Admin → Printer Management.' : 'Connect agent to load printers.'}
                </p>
              )}
            </div>

            {/* Commands */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Terminal size={14} /> Hardware Commands
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={testNewFlow}
                  disabled={!printerReady || busy}
                  className="w-full flex items-center justify-between p-4 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-100 group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Printer size={18} className="text-emerald-600" />
                    <div className="text-left">
                      <span className="font-bold text-emerald-900 block leading-tight">Test Production Layout</span>
                      <span className="text-[10px] text-emerald-600 font-medium italic">Full Flow (Master + 2 Zones)</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-emerald-300 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={testHello}
                  disabled={!printerReady || busy}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-100 group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Play size={18} className="text-blue-500" />
                    <span className="font-bold text-gray-700">Simple Ping</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => qzManager.printRaw(new Uint8Array([0x1d, 0x56, 0x01]))}
                  disabled={!printerReady || busy}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-100 group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Scissors size={18} className="text-orange-500" />
                    <span className="font-bold text-gray-700">Manual Paper Cut</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Status summary */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Activity size={14} /> Agent Status
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Agent', ok: agentOnline },
                  { label: 'Printer Online', ok: printerOnline === true },
                ].map(({ label, ok }) => (
                  <div key={label} className="p-3 bg-gray-50 rounded-lg flex items-center gap-2">
                    {ok
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      : <AlertCircle className="w-4 h-4 text-gray-300 shrink-0" />
                    }
                    <span className={`text-[10px] font-bold uppercase ${ok ? 'text-emerald-700' : 'text-gray-400'}`}>{label}</span>
                  </div>
                ))}
              </div>
              {selectedPrinter && (
                <div className="text-[10px] font-mono text-gray-400 bg-gray-50 p-2 rounded">
                  {selectedPrinter.ipAddress}:{selectedPrinter.port}
                </div>
              )}
            </div>
          </div>

          {/* Logs */}
          <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-800 h-[580px]">
            <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Activity size={14} /> Console Logs
              </h2>
              <button onClick={() => setLogs([])} className="text-gray-500 hover:text-white transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-2">
              {logs.length === 0 ? (
                <p className="text-gray-600 italic">Waiting for activity...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-gray-600 flex-shrink-0">[{log.time}]</span>
                    <span className={
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'success' ? 'text-green-400' : 'text-blue-300'
                    }>
                      {log.msg}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
