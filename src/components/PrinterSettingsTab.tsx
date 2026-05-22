'use client';

import React, { useState, useEffect, useRef } from 'react';
import { checkAgentHealth, probePrinterConnection, PrinterConnectivityStatus, shutdownAgent, DEV_DEBUG, subscribeToLogs, DiagnosticLog } from '@/lib/print/agent-transport';
import { qzManager } from '@/lib/print/qz-tray';
import { toast } from 'react-hot-toast';
import { Activity, CheckCircle2, XCircle, Download, Terminal, Loader2, Printer, Wifi, AlertTriangle, PowerOff, RefreshCw, Bug, ShieldAlert } from 'lucide-react';

export default function PrinterSettingsTab() {
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'running' | 'stopped' | 'tls-blocked'>('checking');
  const [printerStatus, setPrinterStatus] = useState<PrinterConnectivityStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [controlling, setControlling] = useState(false);
  const [lastPrint, setLastPrint] = useState<Date | null>(null);

  // Diagnostic Logs State
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);

  // References to prevent request stacking
  const isHealthPolling = useRef(false);
  const isPrinterPolling = useRef(false);
  const timers = useRef<{ health?: NodeJS.Timeout; printer?: NodeJS.Timeout }>({});

  const checkHealth = async () => {
    if (document.visibilityState === 'hidden' || isHealthPolling.current) return;
    isHealthPolling.current = true;
    try {
      const isHealthy = await checkAgentHealth();
      if (isHealthy) {
        setServiceStatus('running');
      } else {
        // If there was a TLS error in the most recent log, assume it's blocked. 
        // Or if not healthy, default to stopped. The logs will catch TLS specific errors
        setServiceStatus(prev => prev === 'tls-blocked' ? 'tls-blocked' : 'stopped');
        setPrinterStatus(null);
      }
    } finally {
      isHealthPolling.current = false;
    }
  };

  const checkPrinter = async () => {
    if (document.visibilityState === 'hidden' || isPrinterPolling.current || serviceStatus !== 'running') return;
    isPrinterPolling.current = true;
    try {
      await qzManager.connect(true);
      const target = qzManager.getActivePrinterTarget();
      setLastPrint(qzManager.getLastSuccessfulPrint());

      if (target) {
        const conn = await probePrinterConnection(target);
        setPrinterStatus(conn);
      } else {
        setPrinterStatus(null);
      }
    } catch {
      setPrinterStatus(null);
    } finally {
      isPrinterPolling.current = false;
    }
  };

  const manualRefresh = async () => {
    setServiceStatus('checking');
    await checkHealth();
    if (isHealthPolling.current === false && serviceStatus !== 'stopped' && serviceStatus !== 'tls-blocked') {
      await checkPrinter();
    }
  };

  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);

  // Polling loops & Log Subscription
  useEffect(() => {
    setMounted(true);
    manualRefresh();

    timers.current.health = setInterval(checkHealth, 25000); // 25s
    timers.current.printer = setInterval(checkPrinter, 35000); // 35s

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') manualRefresh();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const unsubscribe = subscribeToLogs((newLog) => {
      setLogs((prev) => [newLog, ...prev].slice(0, 50));
      if (newLog.isTlsError) {
         setServiceStatus('tls-blocked');
      }
    });

    return () => {
      if (timers.current.health) clearInterval(timers.current.health);
      if (timers.current.printer) clearInterval(timers.current.printer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
    };
  }, []);

  const handleStopService = async () => {
    setControlling(true);
    const success = await shutdownAgent();
    if (success) {
      toast.success('Print Service Stopped');
      setServiceStatus('stopped');
      setPrinterStatus(null);
    } else {
      toast.error('Failed to stop service');
    }
    setControlling(false);
  };

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      const commands = ['\x1B\x40', 'TEST PRINT\n', '\x1D\x56\x41\x00'];
      const res = await import('@/lib/print/agent-transport').then(m => m.printViaAgent({
         ip: printerStatus?.ip || '',
         port: 9100
      }, commands));
      
      if (!res.success) {
         toast.error(res.error || 'Print Failed');
         checkPrinter();
         return;
      }
      toast.success('Test print sent to agent');
      setLastPrint(new Date());
      checkPrinter();
    } catch (err: unknown) {
      toast.error('Unexpected error sending test print');
      checkPrinter();
    } finally {
      setTesting(false);
    }
  };

  if (!mounted) return null; // Prevent hydration mismatch

  return (
    <div className="max-w-3xl space-y-6">
      
      {DEV_DEBUG && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3 border-b border-red-200 bg-red-100 flex items-center gap-2 font-bold text-red-800 text-sm">
            <Bug className="w-4 h-4 text-red-600" />
            Local Agent Diagnostics (DEV_DEBUG)
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-red-900 font-mono">
            <div>
              <div className="font-bold mb-1 opacity-70">Frontend Protocol</div>
              {window.location.protocol}
            </div>
            <div>
              <div className="font-bold mb-1 opacity-70">Frontend Origin</div>
              {window.location.origin}
            </div>
            <div>
              <div className="font-bold mb-1 opacity-70">Agent Protocol</div>
              https:
            </div>
            <div>
              <div className="font-bold mb-1 opacity-70">SecureContext</div>
              {window.isSecureContext ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="px-4 py-3 border-t border-red-200 flex flex-wrap gap-2">
             <button onClick={() => manualRefresh()} className="px-3 py-1 bg-white border border-red-300 text-red-700 text-xs rounded hover:bg-red-50 font-bold">Refresh Health</button>
             <button onClick={() => checkPrinter()} className="px-3 py-1 bg-white border border-red-300 text-red-700 text-xs rounded hover:bg-red-50 font-bold">TCP Probe</button>
          </div>
          {logs.length > 0 && (
            <div className="h-48 overflow-y-auto bg-gray-900 p-3 text-[10px] font-mono leading-tight space-y-1.5">
              {logs.map((log, i) => (
                <div key={i} className={log.status === 'FAILED' ? (log.isTlsError ? 'text-amber-400' : 'text-red-400') : 'text-green-400'}>
                  <span className="text-gray-500">[{log.timestamp.toLocaleTimeString()}]</span>{' '}
                  <span className="font-bold">{log.method}</span> {log.url} →{' '}
                  {log.status} ({log.latencyMs}ms){' '}
                  {log.error && <div className="text-red-300 ml-4">Err: {log.error}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {serviceStatus === 'tls-blocked' && (
         <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
               <h3 className="text-amber-800 font-bold text-sm">Self-Signed Certificate Not Trusted</h3>
               <p className="text-amber-700 text-xs mt-1">
                 Your browser is blocking the secure connection to the local print service. This usually happens on first-time setup or after a browser reset.
               </p>
               <a 
                 href="https://localhost:3001/health" 
                 target="_blank" 
                 rel="noreferrer"
                 className="inline-block mt-3 text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-md transition-colors"
               >
                 Open Local Agent Secure Link
               </a>
               <p className="text-amber-600/70 text-[10px] mt-2">
                 Click the link above, bypass the security warning (e.g. Advanced &gt; Proceed to localhost), then return here and refresh.
               </p>
            </div>
         </div>
      )}

      {/* 1. Status Section */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between font-bold text-gray-700">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-400" />
            Connectivity Status
          </div>
          <div className="flex items-center gap-3">
            {lastPrint && (
              <span className="text-xs text-gray-500 font-normal">
                Last Print: {lastPrint.toLocaleTimeString()}
              </span>
            )}
            <div className="flex items-center gap-1 border-l pl-3 border-gray-300">
              <button 
                onClick={manualRefresh} 
                disabled={serviceStatus === 'checking' || controlling}
                title="Refresh Status"
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${serviceStatus === 'checking' ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={handleStopService}
                disabled={controlling || serviceStatus === 'stopped' || serviceStatus === 'tls-blocked'}
                title="Stop Service"
                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
              >
                <PowerOff className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-4">
            {serviceStatus === 'checking' && <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />}
            {serviceStatus === 'running' && <CheckCircle2 className="w-8 h-8 text-green-500" />}
            {serviceStatus === 'tls-blocked' && <ShieldAlert className="w-8 h-8 text-amber-500" />}
            {serviceStatus === 'stopped' && <XCircle className="w-8 h-8 text-red-500" />}
            
            <div>
              <div className={`font-bold text-lg ${serviceStatus === 'running' ? 'text-green-700' : serviceStatus === 'tls-blocked' ? 'text-amber-700' : serviceStatus === 'stopped' ? 'text-red-700' : 'text-gray-500'}`}>
                {serviceStatus === 'checking' ? 'Checking service...' : 
                 serviceStatus === 'tls-blocked' ? 'TLS Blocked' :
                 serviceStatus === 'running' ? 'Print Service Running' : 
                 'Agent Offline'}
              </div>
              <div className="text-sm font-medium mt-0.5">
                {serviceStatus === 'checking' ? <span className="text-gray-400">Please wait...</span> : 
                 serviceStatus === 'tls-blocked' ? <span className="text-amber-600">Requires trust acceptance</span> :
                 serviceStatus === 'running' ? <span className="text-green-600">Secure connection active</span> : 
                 <span className="text-red-600">Fetch blocked or unreachable</span>}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-1">https://localhost:3001</div>
            </div>
          </div>

          <div className="flex items-start gap-4 border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-6">
            {!printerStatus || serviceStatus !== 'running' ? (
               <Wifi className="w-8 h-8 text-gray-300" />
            ) : printerStatus.status === 'online' ? (
               <CheckCircle2 className="w-8 h-8 text-green-500" />
            ) : printerStatus.status === 'unstable' ? (
               <AlertTriangle className="w-8 h-8 text-yellow-500" />
            ) : (
               <XCircle className="w-8 h-8 text-red-500" />
            )}
            
            <div>
              <div className={`font-bold text-lg ${(!printerStatus || serviceStatus !== 'running') ? 'text-gray-400' : printerStatus.status === 'online' ? 'text-green-700' : printerStatus.status === 'unstable' ? 'text-yellow-700' : 'text-red-700'}`}>
                {(!printerStatus || serviceStatus !== 'running') ? 'Printer Status Unknown' : 
                 printerStatus.status === 'online' ? 'Stable Connection' : 
                 printerStatus.status === 'unstable' ? 'Unstable Connection' :
                 'Printer Unreachable'}
              </div>
              <div className="text-sm font-medium mt-0.5">
                {(!printerStatus || serviceStatus !== 'running') ? (
                  <span className="text-gray-400">Requires secure service</span>
                ) : printerStatus.status === 'online' ? (
                  <span className="text-green-600">{printerStatus.latencyMs}ms avg response</span>
                ) : printerStatus.status === 'unstable' ? (
                  <span className="text-yellow-600">High latency ({printerStatus.latencyMs}ms) or drops</span>
                ) : (
                  <span className="text-red-600">TCP socket connection timeout</span>
                )}
              </div>
              {printerStatus && serviceStatus === 'running' && (
                <div className="text-xs text-gray-400 font-mono mt-1">IP: {printerStatus.ip}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
          <Download className="w-5 h-5 text-gray-400" />
          Download Print Agent
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a href="https://drive.google.com/drive/folders/1H8Zq1w7J7o1Ees2Ol0K-RjpbeBrLj7yn?usp=drive_link" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-4 border rounded-xl hover:border-[#1A2766] hover:bg-blue-50/50 transition-all group">
            <div className="font-bold text-gray-800 group-hover:text-[#1A2766]">Download Windows Installer</div>
            <div className="text-xs text-gray-500 mt-1">Via Google Drive</div>
          </a>
          <a href="https://drive.google.com/drive/folders/1H8Zq1w7J7o1Ees2Ol0K-RjpbeBrLj7yn?usp=drive_link" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-4 border rounded-xl hover:border-[#1A2766] hover:bg-blue-50/50 transition-all group">
            <div className="font-bold text-gray-800 group-hover:text-[#1A2766]">Download Mac Installer</div>
            <div className="text-xs text-gray-500 mt-1">Via Google Drive</div>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
            <Terminal className="w-5 h-5 text-gray-400" />
            Install Instructions
          </div>
          <div className="p-6 space-y-6">
            <div>
              <h4 className="font-bold text-sm text-gray-800 mb-2">Mac</h4>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1 mb-2">
                <li>Download Mac Installer from Google Drive</li>
                <li>Open installer</li>
                <li>Allow in Security Settings if blocked</li>
                <li>Restart browser after installation</li>
              </ol>
            </div>
            <div className="pt-2 border-t">
              <h4 className="font-bold text-sm text-gray-800 mb-2 mt-2">Windows</h4>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                <li>Download installer from Google Drive</li>
                <li>Run installer</li>
                <li>Restart browser if needed</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
            <Printer className="w-5 h-5 text-gray-400" />
            Diagnostics
          </div>
          <div className="p-6 flex flex-col justify-center h-[calc(100%-57px)]">
            <p className="text-sm text-gray-500 mb-4 text-center">
              Send a test payload to the local print service. 
            </p>
            <button
              onClick={handleTestPrint}
              disabled={serviceStatus !== 'running' || testing}
              className="w-full py-3 px-4 bg-[#1A2766] hover:bg-[#1A2766]/90 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {testing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
              {testing ? 'Sending...' : 'Test Print'}
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
}
