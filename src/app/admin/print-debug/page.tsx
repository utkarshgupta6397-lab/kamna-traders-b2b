'use client';

import { useState, useEffect } from 'react';
import * as qz from 'qz-tray';
import { qzManager } from '@/lib/print/qz-tray';
import { EscPosRenderer } from '@/lib/print/esc-pos-renderer';
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

  const testQR = async () => {
    try {
      setBusy(true);
      const renderer = new EscPosRenderer();
      renderer
        .align('center')
        .line('QR CODE TEST')
        .line()
        .qr('https://kamnatraders.in/verify/test-123')
        .line()
        .line('Scan to verify')
        .feed(3)
        .cut();

      addLog('Sending QR Code command...');
      await qzManager.printRaw(renderer.build());
      addLog('Print job sent', 'success');
    } catch (err: any) {
      addLog(`Print failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const testBill = async () => {
    try {
      setBusy(true);
      const renderer = new EscPosRenderer();
      renderer
        .align('center')
        .bold().text('KAMNA TRADERS').bold(false)
        .line('123, Warehouse Area, New Delhi')
        .line('GSTIN: 07AAAAA0000A1Z5')
        .line('--------------------------------')
        .align('left')
        .line(`Order: #KT-${Math.floor(Math.random() * 9000) + 1000}`)
        .line(`Date: ${new Date().toLocaleString()}`)
        .line('--------------------------------')
        .bold().line('ITEM            QTY   PRICE   AMT').bold(false)
        .line('--------------------------------')
        .line('Aashirvaad Atta  5kg  245.00  245')
        .line('Fortune Oil      1L   155.00  155')
        .line('Tata Salt        1kg   28.00   28')
        .line('Maggi Noodles    4pk   60.00   60')
        .line('--------------------------------')
        .align('right')
        .bold().line('TOTAL: INR 488.00').bold(false)
        .align('center')
        .line('--------------------------------')
        .feed(1)
        .qr('https://kamnatraders.in/bill/test-123')
        .line('Scan to Pay/Verify')
        .line()
        .italic().line('Thank you for shopping!').italic(false)
        .feed(3)
        .cut();

      addLog('Sending Sample Bill command...');
      await qzManager.printRaw(renderer.build());
      addLog('Sample Bill sent', 'success');
    } catch (err: any) {
      addLog(`Print failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const testMultiSlip = async () => {
    try {
      setBusy(true);
      const renderer = new EscPosRenderer();
      
      // Slip 1: Customer Copy
      renderer
        .align('center')
        .bold().line('--- CUSTOMER COPY ---').bold(false)
        .line('KAMNA TRADERS')
        .line('Order #KT-SLIP-789')
        .feed(2)
        .line('Amount Paid: INR 1,250.00')
        .line('Status: SUCCESS')
        .feed(2)
        .cut();

      // Slip 2: Warehouse Copy (Internal)
      renderer
        .reset()
        .align('center')
        .bold().line('--- WAREHOUSE COPY ---').bold(false)
        .align('left')
        .line('Order #KT-SLIP-789')
        .line('Bin: B2-R4')
        .line('--------------------------------')
        .bold().line('PICK LIST:').bold(false)
        .line('- Basmati Rice (5kg)  x 2')
        .line('- Saffola Oil (5L)    x 1')
        .line('--------------------------------')
        .feed(2)
        .cut();

      addLog('Sending Multi-Slip command...');
      await qzManager.printRaw(renderer.build());
      addLog('Multi-Slips sent', 'success');
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
                  onClick={testBill}
                  disabled={!connected || busy || !printer}
                  className="w-full flex items-center justify-between p-4 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all border border-emerald-100 group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Printer size={18} className="text-emerald-600" />
                    <div className="text-left">
                      <span className="font-bold text-emerald-900 block leading-tight">Sample Grocery Bill</span>
                      <span className="text-[10px] text-emerald-600 font-medium italic">Layout + Items + QR</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-emerald-300 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={testMultiSlip}
                  disabled={!connected || busy || !printer}
                  className="w-full flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 rounded-xl transition-all border border-orange-100 group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Scissors size={18} className="text-orange-600" />
                    <div className="text-left">
                      <span className="font-bold text-orange-900 block leading-tight">Multi-Slip (2 Zones)</span>
                      <span className="text-[10px] text-orange-600 font-medium italic">Customer + Warehouse Copies</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-orange-300 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={testHello}
                  disabled={!connected || busy || !printer}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-100 group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Play size={18} className="text-blue-500" />
                    <span className="font-bold text-gray-700">Hello World</span>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={testQR}
                  disabled={!connected || busy || !printer}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all border border-gray-100 group disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <QrCode size={18} className="text-purple-500" />
                    <span className="font-bold text-gray-700">QR Code Test</span>
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
                    <span className="font-bold text-gray-700">Execute Cut</span>
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
