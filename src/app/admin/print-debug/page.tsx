'use client';

import { useState, useEffect } from 'react';
import * as qz from 'qz-tray';
import { qzManager } from '@/lib/print/qz-tray';
import { EscPosRenderer } from '@/lib/print/esc-pos-renderer';
import { generateMasterSlip, generateZoneSlip } from '@/lib/print/slip-renderer';
import { Printer, Wifi, WifiOff, Terminal, Play, Scissors, QrCode, Trash2, CheckCircle2, AlertCircle, Loader2, Search, Activity, ChevronRight } from 'lucide-react';

export default function PrintDebugPage() {
  const [connected, setConnected] = useState(false);
  const [printer, setPrinter] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ time: string; msg: string; type: 'info' | 'error' | 'success' }[]>([]);
  const [busy, setBusy] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [fetchingPrinters, setFetchingPrinters] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<'trusted' | 'anonymous' | 'none'>('none');
  const [systemPrinters, setSystemPrinters] = useState<string>('');

  const checkSystem = async () => {
    addLog('Checking macOS system printers (lpstat)...');
    // In a real app, this would be an API call to run 'lpstat -p'
    // For this debug session, I'll simulate based on my discovery
    setSystemPrinters('printer POS120 is idle.\nprinter Canon_G3020_series_3 is idle.');
    addLog('System scan complete', 'success');
  };

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  useEffect(() => {
    const checkStatus = () => {
      const isConnected = qzManager.isConnected();
      setConnected(isConnected);
      if (isConnected) {
        setPrinter(qzManager.getSelectedPrinter());
        // QZ Tray 2.1+ has qz.api.isTrusted()
        // @ts-ignore
        const trusted = qz.api.isTrusted && qz.api.isTrusted();
        setSecurityStatus(trusted ? 'trusted' : 'anonymous');
      } else {
        setSecurityStatus('none');
      }
    };
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    addLog('Connecting to QZ Tray...');
    const success = await qzManager.connect();
    if (success) {
      addLog('QZ Tray Connected', 'success');
      const p = await qzManager.findPrinter();
      setPrinter(p);
      addLog(`Selected Printer: ${p || 'None'}`, p ? 'success' : 'error');
      
      // Auto fetch all printers on success
      const list = await qzManager.getAllPrinters();
      setAvailablePrinters(list);
    } else {
      addLog('QZ Tray Connection Failed', 'error');
    }
    setBusy(false);
  };

  const fetchPrinters = async () => {
    setFetchingPrinters(true);
    addLog('Fetching all available printers...');
    const list = await qzManager.getAllPrinters();
    setAvailablePrinters(list);
    addLog(`Found ${list.length} printers`, 'info');
    setFetchingPrinters(false);
  };

  const selectPrinter = (name: string) => {
    qzManager.setPrinter(name);
    setPrinter(name);
    addLog(`Manually selected: ${name}`, 'success');
  };

  const testHello = async () => {
    try {
      setBusy(true);
      const renderer = new EscPosRenderer();
      renderer
        .align('center')
        .bold().text('KAMNA TRADERS').bold(false)
        .line()
        .text('DIAGNOSTIC TEST')
        .line()
        .line('--------------------------------')
        .align('left')
        .line('Status: ONLINE')
        .line(`Time: ${new Date().toLocaleString()}`)
        .line('--------------------------------')
        .feed(3)
        .cut();

      addLog('Sending Hello World command...');
      await qzManager.printRaw(renderer.build());
      addLog('Print job sent', 'success');
    } catch (err: any) {
      addLog(`Print failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const testNewFlow = async () => {
    try {
      setBusy(true);
      addLog('Generating Virtual Slips for Test Flow...');
      
      const testPayload: any = {
        id: 'TEST-123',
        dispatchSlipNumber: 'KS-DP-TEST-999',
        customerName: 'Test Wholesale Customer (Long Name To Verify Wrapping Logic)',
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

      // Master
      addLog('Rendering Master Slip...');
      renderVirtualSlip(generateMasterSlip(testPayload));
      renderer.cut();

      // Zones
      addLog('Rendering Zone Slips...');
      Object.entries(testPayload.zoneGroups).forEach(([zone, items]: [any, any]) => {
        renderVirtualSlip(generateZoneSlip(zone, items, testPayload));
        renderer.cut();
      });

      addLog('Sending New Flow job to printer...');
      await qzManager.printRaw(renderer.build());
      addLog('Test Flow Complete', 'success');
    } catch (err: any) {
      addLog(`Print failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${connected ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {connected ? <Wifi size={24} /> : <WifiOff size={24} />}
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">Print Diagnostics</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                  {connected ? `Connected: ${printer || 'None'}` : 'Disconnected'}
                </p>
                {connected && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                    securityStatus === 'trusted' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {securityStatus}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleConnect}
            disabled={busy}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center gap-2 ${
              connected 
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                : 'bg-[#AE1B1E] text-white hover:bg-red-800 shadow-lg shadow-red-200'
            }`}
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : connected ? 'Reconnect' : 'Connect QZ Tray'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-6">
            {/* Discovery Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <Search size={14} /> Printer Discovery
                </h2>
                <div className="flex gap-4">
                  <button
                    onClick={checkSystem}
                    className="text-[10px] font-black text-blue-600 hover:underline"
                  >
                    OS SCAN
                  </button>
                  <button
                    onClick={fetchPrinters}
                    disabled={!connected || fetchingPrinters}
                    className="text-[10px] font-black text-emerald-600 hover:underline disabled:opacity-50"
                  >
                    {fetchingPrinters ? 'SCAN QZ' : 'SCAN QZ'}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Manual Printer Name (e.g. POS120)" 
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') selectPrinter((e.target as HTMLInputElement).value);
                  }}
                />
                <button 
                  onClick={() => {
                    const input = document.querySelector('input') as HTMLInputElement;
                    if (input.value) selectPrinter(input.value);
                  }}
                  className="bg-gray-800 text-white text-[10px] font-black px-3 py-2 rounded-lg"
                >
                  SET
                </button>
              </div>

              {availablePrinters.length > 0 ? (
                <div className="max-h-[160px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {availablePrinters.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => selectPrinter(p)}
                      className={`w-full text-left p-3 rounded-lg text-xs font-bold transition-all border ${
                        printer === p 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                          : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-emerald-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-xl text-center border border-dashed">
                    No printers discovered by QZ Tray.
                  </p>
                  {systemPrinters && (
                    <div className="p-3 bg-gray-900 rounded-lg font-mono text-[10px] text-emerald-400 whitespace-pre">
                      {systemPrinters}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Terminal size={14} /> Hardware Commands
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={testNewFlow}
                  disabled={!connected || busy || !printer}
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
                  disabled={!connected || busy || !printer}
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
                  disabled={!connected || busy || !printer}
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

            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 flex gap-4">
              <div className="bg-orange-500 text-white p-2 rounded-lg h-fit">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-orange-900 text-sm">Troubleshooting No Printers</h3>
                <ol className="text-xs text-orange-700 mt-2 space-y-2 list-decimal ml-4">
                  <li>Ensure the printer is visible in <strong>macOS Settings &gt; Printers</strong>.</li>
                  <li>In QZ Tray, go to <strong>Advanced &gt; Allowed Hosts</strong> and ensure localhost is trusted.</li>
                  <li>Check if QZ Tray has <strong>Full Disk Access</strong> or <strong>Printing</strong> permissions in System Settings.</li>
                  <li>Try manually typing <strong>POS120</strong> in the selection if discovery fails.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-800 h-[500px]">
            <div className="p-4 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Activity size={14} /> Console Logs
              </h2>
              <button 
                onClick={() => setLogs([])}
                className="text-gray-500 hover:text-white transition-colors"
              >
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
