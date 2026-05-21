'use client';

import React, { useState, useEffect } from 'react';
import { checkAgentHealth } from '@/lib/print/agent-transport';
import { qzManager } from '@/lib/print/qz-tray';
import { toast } from 'react-hot-toast';
import { Activity, CheckCircle2, XCircle, Download, Terminal, Loader2, Printer } from 'lucide-react';

export default function PrinterSettingsTab() {
  const [status, setStatus] = useState<'checking' | 'running' | 'stopped'>('checking');
  const [testing, setTesting] = useState(false);

  const checkStatus = async () => {
    setStatus('checking');
    try {
      const isHealthy = await checkAgentHealth();
      setStatus(isHealthy ? 'running' : 'stopped');
    } catch {
      setStatus('stopped');
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      // Just a raw text payload that the EscPosRenderer would generate
      // Minimal test to verify connectivity to localhost:3001
      const commands = [
        '\x1B\x40', // init
        '\x1B\x61\x01', // center align
        '\x1D\x21\x11', 'TEST PRINT\n', // large text
        '\x1D\x21\x00', '\x1B\x61\x00', // normal text, left align
        '--------------------------------\n',
        `Time: ${new Date().toLocaleString()}\n`,
        'Service: warehouse-print-agent\n',
        'Status: Operational\n',
        '--------------------------------\n',
        '\x1B\x64\x03', // feed 3 lines
        '\x1D\x56\x41\x00' // full cut
      ];
      await qzManager.printRaw(commands);
      toast.success('Test print sent to agent');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Print failed';
      toast.error(msg);
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
            Print Service Status
          </div>
          <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-mono">v1.0.0</span>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {status === 'checking' && <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />}
            {status === 'running' && <CheckCircle2 className="w-8 h-8 text-green-500" />}
            {status === 'stopped' && <XCircle className="w-8 h-8 text-red-500" />}
            
            <div>
              <div className={`font-bold text-lg ${status === 'running' ? 'text-green-700' : status === 'stopped' ? 'text-red-700' : 'text-gray-500'}`}>
                {status === 'checking' ? 'Checking status...' : 
                 status === 'running' ? 'Print Service Running' : 
                 'Print Service Not Running'}
              </div>
              <div className="text-sm font-medium mt-0.5">
                {status === 'checking' ? <span className="text-gray-400">Please wait...</span> : 
                 status === 'running' ? <span className="text-green-600">Silent network printing is active.</span> : 
                 <span className="text-red-600">Please install or start the Print Service.</span>}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-1">http://127.0.0.1:3001/health</div>
            </div>
          </div>
          
          <button 
            onClick={checkStatus} 
            disabled={status === 'checking'}
            className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* 2. Download Section */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
          <Download className="w-5 h-5 text-gray-400" />
          Download Print Agent
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a href="/downloads/KamnaPrintAgentSetup.exe" download className="flex flex-col items-center justify-center p-4 border rounded-xl hover:border-[#1A2766] hover:bg-blue-50/50 transition-all group">
            <div className="font-bold text-gray-800 group-hover:text-[#1A2766]">Download Windows Installer</div>
            <div className="text-xs text-gray-500 mt-1">.exe</div>
          </a>
          <a href="/downloads/KamnaPrintAgent.pkg" download className="flex flex-col items-center justify-center p-4 border rounded-xl hover:border-[#1A2766] hover:bg-blue-50/50 transition-all group">
            <div className="font-bold text-gray-800 group-hover:text-[#1A2766]">Download Mac Installer</div>
            <div className="text-xs text-gray-500 mt-1">.pkg (Universal)</div>
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
                <li>Download Mac Installer</li>
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
                <li>Download installer</li>
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
              disabled={status !== 'running' || testing}
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
