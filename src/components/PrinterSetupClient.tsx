'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Printer, Shield, CheckCircle2, AlertCircle, Upload, Trash2, Loader2, Info } from 'lucide-react';
import { qzManager } from '@/lib/print/qz-tray';
import { saveQZConfig, getQZConfig, clearQZConfig, QZConfig } from '@/lib/print/qz-storage';
import { toast } from 'react-hot-toast';

export default function PrinterSetupClient() {
  const [isQZConnected, setIsQZConnected] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [config, setConfig] = useState<QZConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState<{ cert: boolean; key: boolean }>({ cert: false, key: false });
  const [testPrinting, setTestPrinting] = useState(false);

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
      console.error('[PRINTER_SETUP] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileUpload = async (file: File, type: 'cert' | 'key') => {
    const text = await file.text();
    
    if (type === 'cert') {
      if (!text.includes('-----BEGIN CERTIFICATE-----')) {
        toast.error('Invalid digital-certificate.txt format');
        return;
      }
      const newConfig = {
        certificate: text,
        privateKey: config?.privateKey || '',
        printerName: selectedPrinter,
        configuredAt: new Date().toISOString()
      };
      await saveQZConfig(newConfig);
      setConfig({ id: 'current_setup', ...newConfig });
    } else {
      if (!text.includes('-----BEGIN PRIVATE KEY-----')) {
        toast.error('Invalid private-key.pem format');
        return;
      }
      const newConfig = {
        certificate: config?.certificate || '',
        privateKey: text,
        printerName: selectedPrinter,
        configuredAt: new Date().toISOString()
      };
      await saveQZConfig(newConfig);
      setConfig({ id: 'current_setup', ...newConfig });
    }
    toast.success(`${type === 'cert' ? 'Certificate' : 'Private Key'} uploaded successfully`);
  };

  const handlePrinterChange = async (name: string) => {
    setSelectedPrinter(name);
    qzManager.setPrinter(name);
    if (config) {
      await saveQZConfig({ ...config, printerName: name });
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to clear the local printer configuration?')) return;
    await clearQZConfig();
    setConfig(null);
    toast.success('Configuration cleared');
  };

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      toast.error('Please select a printer first');
      return;
    }
    setTestPrinting(true);
    try {
      const timestamp = new Date().toLocaleString();
      const deviceName = typeof window !== 'undefined' ? window.navigator.userAgent.split(' ')[0] : 'Unknown Device';
      
      const commands = [
        '\x1B\x40', // Initialize
        '\x1B\x61\x01', // Center
        '\x1D\x21\x11', // Double height & width
        'TEST PRINT SUCCESS\n',
        '\x1D\x21\x00', // Normal size
        '\x1B\x61\x00', // Left align
        '--------------------------------\n',
        `Time: ${timestamp}\n`,
        `Device: ${deviceName}\n`,
        `Printer: ${selectedPrinter}\n`,
        'Mode: Demo (Local Signing)\n',
        '--------------------------------\n',
        '\x1B\x64\x03', // Feed 3 lines
        '\x1D\x56\x41\x00' // Cut
      ];

      await qzManager.printRaw(commands);
      toast.success('Test print sent!');
    } catch (err: any) {
      console.error('[TEST_PRINT] Error:', err);
      toast.error(`Test print failed: ${err.message || 'Unknown error'}`);
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

  const isSilentReady = config?.certificate && config?.privateKey && isQZConnected && selectedPrinter;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[#1A2766]">
          <Settings className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Printer Setup</h1>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 ${isQZConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          <div className={`w-2 h-2 rounded-full ${isQZConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          QZ Tray {isQZConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Onboarding */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
              <Upload className="w-4 h-4" />
              <span>Step 1: Security Onboarding</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                <span>Upload your machine-specific QZ credentials. These are stored locally in your browser and never sent to the server.</span>
              </p>

              {/* Certificate Upload */}
              <div 
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging.cert ? 'border-[#1A2766] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(d => ({ ...d, cert: true })); }}
                onDragLeave={() => setIsDragging(d => ({ ...d, cert: false }))}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(d => ({ ...d, cert: false }));
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file, 'cert');
                }}
              >
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'cert')}
                  accept=".txt"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className={`p-2 rounded-full ${config?.certificate ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {config?.certificate ? <CheckCircle2 className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                  </div>
                  <div className="text-sm font-medium">
                    {config?.certificate ? 'Certificate Installed' : 'Upload digital-certificate.txt'}
                  </div>
                  <div className="text-[10px] text-gray-400">Click or drag and drop</div>
                </div>
              </div>

              {/* Private Key Upload */}
              <div 
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging.key ? 'border-[#1A2766] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(d => ({ ...d, key: true })); }}
                onDragLeave={() => setIsDragging(d => ({ ...d, key: false }))}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(d => ({ ...d, key: false }));
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file, 'key');
                }}
              >
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'key')}
                  accept=".pem"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className={`p-2 rounded-full ${config?.privateKey ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {config?.privateKey ? <CheckCircle2 className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                  </div>
                  <div className="text-sm font-medium">
                    {config?.privateKey ? 'Private Key Installed' : 'Upload private-key.pem'}
                  </div>
                  <div className="text-[10px] text-gray-400">Click or drag and drop</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Printer Selection & Status */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
              <Printer className="w-4 h-4" />
              <span>Step 2: Printer Configuration</span>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Select Target Printer</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:ring-2 focus:ring-[#1A2766]/20 focus:border-[#1A2766] outline-none"
                  value={selectedPrinter}
                  onChange={(e) => handlePrinterChange(e.target.value)}
                  disabled={!isQZConnected}
                >
                  <option value="">Select a printer...</option>
                  {printers.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {!isQZConnected && (
                  <p className="text-[10px] text-red-500 font-medium">Please ensure QZ Tray is running to detect printers.</p>
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
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleTestPrint}
                    disabled={!isSilentReady || testPrinting}
                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isSilentReady ? 'bg-[#1A2766] text-white hover:bg-[#1A2766]/90' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    {testPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    Test Print
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-red-200 text-red-600 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset
                  </button>
                </div>
              </div>

              {config?.configuredAt && (
                <div className="text-[10px] text-center text-gray-400">
                  Last configured on {new Date(config.configuredAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#1A2766]/5 border border-[#1A2766]/10 flex gap-3">
            <AlertCircle className="w-5 h-5 text-[#1A2766] shrink-0" />
            <div className="space-y-1">
              <div className="text-sm font-bold text-[#1A2766]">Security Notice</div>
              <p className="text-xs text-gray-600 leading-relaxed">
                This configuration is <strong>browser-local</strong>. If you switch browsers, use incognito mode, or clear your browser data, you will need to re-configure your printer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
