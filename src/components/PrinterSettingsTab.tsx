'use client';

import React, { useState, useEffect } from 'react';
import { checkAgentHealth, probePrinterConnection, PrinterConnectivityStatus } from '@/lib/print/agent-transport';
import { qzManager } from '@/lib/print/qz-tray';
import { toast } from 'react-hot-toast';
import { Activity, CheckCircle2, XCircle, Download, Terminal, Loader2, Printer, Wifi, AlertTriangle } from 'lucide-react';

export default function PrinterSettingsTab() {
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'running' | 'stopped'>('checking');
  const [printerStatus, setPrinterStatus] = useState<PrinterConnectivityStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [lastPrint, setLastPrint] = useState<Date | null>(null);

  const checkStatus = async () => {
    setServiceStatus('checking');
    try {
      // 1. Check Service
      const isHealthy = await checkAgentHealth();
      setServiceStatus(isHealthy ? 'running' : 'stopped');
      
      if (!isHealthy) {
        setPrinterStatus(null);
        return;
      }

      // 2. Connect to agent & fetch fresh IP from DB
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
      setServiceStatus('stopped');
      setPrinterStatus(null);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      const commands = [
        '\x1B\x40',
        '\x1B\x61\x01',
        '\x1D\x21\x11', 'TEST PRINT\n',
        '\x1D\x21\x00', '\x1B\x61\x00',
        '--------------------------------\n',
        `Time: ${new Date().toLocaleString()}\n`,
        'Service: warehouse-print-agent\n',
        'Status: Operational\n',
        '--------------------------------\n',
        '\x1B\x64\x03',
        '\x1D\x56\x41\x00'
      ];
      await qzManager.printRaw(commands);
      toast.success('Test print sent to agent');
      setLastPrint(qzManager.getLastSuccessfulPrint());
      // Re-probe immediately after print to verify connection is still good
      checkStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Print failed';
      // Specific error mapping based on user reqs
      if (msg.includes('Not Reachable') || msg.includes('Failed to fetch') || msg.includes('Offline')) {
        toast.error('Printer Offline / Connection Failed');
      } else if (msg.includes('Timeout') || msg.includes('timeout')) {
        toast.error('TCP Connection Timeout');
      } else {
        toast.error(msg);
      }
      checkStatus(); // Force status refresh on failure
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      
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
            <button 
              onClick={checkStatus} 
              disabled={serviceStatus === 'checking'}
              className="px-3 py-1 bg-white border rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {serviceStatus === 'checking' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
            </button>
          </div>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Layer 1: Print Service */}
          <div className="flex items-start gap-4">
            {serviceStatus === 'checking' && <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />}
            {serviceStatus === 'running' && <CheckCircle2 className="w-8 h-8 text-green-500" />}
            {serviceStatus === 'stopped' && <XCircle className="w-8 h-8 text-red-500" />}
            
            <div>
              <div className={`font-bold text-lg ${serviceStatus === 'running' ? 'text-green-700' : serviceStatus === 'stopped' ? 'text-red-700' : 'text-gray-500'}`}>
                {serviceStatus === 'checking' ? 'Checking service...' : 
                 serviceStatus === 'running' ? 'Print Service Running' : 
                 'Print Service Offline'}
              </div>
              <div className="text-sm font-medium mt-0.5">
                {serviceStatus === 'checking' ? <span className="text-gray-400">Please wait...</span> : 
                 serviceStatus === 'running' ? <span className="text-green-600">Local agent responding</span> : 
                 <span className="text-red-600">Please start print service</span>}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-1">127.0.0.1:3001</div>
            </div>
          </div>

          {/* Layer 2: Printer Connection */}
          <div className="flex items-start gap-4 border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-6">
            {!printerStatus ? (
               <Wifi className="w-8 h-8 text-gray-300" />
            ) : printerStatus.status === 'online' ? (
               <CheckCircle2 className="w-8 h-8 text-green-500" />
            ) : printerStatus.status === 'unstable' ? (
               <AlertTriangle className="w-8 h-8 text-yellow-500" />
            ) : (
               <XCircle className="w-8 h-8 text-red-500" />
            )}
            
            <div>
              <div className={`font-bold text-lg ${!printerStatus ? 'text-gray-400' : printerStatus.status === 'online' ? 'text-green-700' : printerStatus.status === 'unstable' ? 'text-yellow-700' : 'text-red-700'}`}>
                {!printerStatus ? 'Printer Status Unknown' : 
                 printerStatus.status === 'online' ? 'Stable Connection' : 
                 printerStatus.status === 'unstable' ? 'Unstable Connection' :
                 'Printer Offline'}
              </div>
              <div className="text-sm font-medium mt-0.5">
                {!printerStatus ? (
                  <span className="text-gray-400">Requires local service</span>
                ) : printerStatus.status === 'online' ? (
                  <span className="text-green-600">{printerStatus.latencyMs}ms avg response</span>
                ) : printerStatus.status === 'unstable' ? (
                  <span className="text-yellow-600">High latency ({printerStatus.latencyMs}ms) or drops</span>
                ) : (
                  <span className="text-red-600">TCP socket unreachable</span>
                )}
              </div>
              {printerStatus && (
                <div className="text-xs text-gray-400 font-mono mt-1">IP: {printerStatus.ip}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Download Section */}
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
        {/* 3. Install Instructions */}
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
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                macOS may show a security warning because the app is internally distributed and unsigned.
              </div>
            </div>
            <div className="pt-2 border-t">
              <h4 className="font-bold text-sm text-gray-800 mb-2 mt-2">Windows</h4>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                <li>Download installer from Google Drive</li>
                <li>Run installer</li>
                <li>Restart browser if needed</li>
              </ol>
              <div className="text-xs text-green-600 bg-green-50 p-2 rounded border border-green-100 mt-2">
                Printing works automatically after installation.
              </div>
            </div>
          </div>
        </div>

        {/* 4. Test Print */}
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
            <Printer className="w-5 h-5 text-gray-400" />
            Diagnostics
          </div>
          <div className="p-6 flex flex-col justify-center h-[calc(100%-57px)]">
            <p className="text-sm text-gray-500 mb-4 text-center">
              Send a test payload to the local print service. 
              The service will route it to the active warehouse printer.
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
