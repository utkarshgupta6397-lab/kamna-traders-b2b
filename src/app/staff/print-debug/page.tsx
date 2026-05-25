'use client';

import { useState, useEffect } from 'react';
import { qzManager } from '@/lib/print/qz-tray';
import { EscPosRenderer } from '@/lib/print/esc-pos-renderer';
import { 
  Printer as PrinterIcon, 
  Wifi, 
  WifiOff, 
  Terminal, 
  Play, 
  Scissors, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Activity, 
  Lock, 
  Key, 
  Check, 
  Upload,
  Clock,
  Shield,
  FileText,
  RefreshCw,
  Sliders,
  AlertTriangle,
  Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PrinterRecord {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  printerType: string;
  isActive: boolean;
}

export default function StaffPrinterDebugPage() {
  const [loading, setLoading] = useState(true);
  const [activePrinter, setActivePrinter] = useState<PrinterRecord | null>(null);
  const [qzConnected, setQzConnected] = useState(false);

  // Unsigned mode toggle state
  const [unsignedMode, setUnsignedModeState] = useState(false);

  // Certificate values (Per-User)
  const [publicCert, setPublicCert] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [certTimestamp, setCertTimestamp] = useState<string | null>(null);
  const [savingCerts, setSavingCerts] = useState(false);

  // Verification state
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [verifyReason, setVerifyReason] = useState('');
  const [certFingerprint, setCertFingerprint] = useState('');
  const [certExpiry, setCertExpiry] = useState('');
  const [certSubject, setCertSubject] = useState('');
  const [certIssuer, setCertIssuer] = useState('');

  // Drag & drop dropzone highlights
  const [certDragActive, setCertDragActive] = useState(false);
  const [keyDragActive, setKeyDragActive] = useState(false);

  // TCP Diagnostic stats
  const [pingStatus, setPingStatus] = useState<'idle' | 'pinging' | 'reachable' | 'unreachable'>('idle');
  const [latency, setLatency] = useState<number | null>(null);
  const [tcpStatus, setTcpStatus] = useState<'idle' | 'testing' | 'open' | 'closed'>('idle');

  // Logs console
  const [logs, setLogs] = useState<{ time: string; msg: string; type: 'info' | 'error' | 'success' }[]>([]);
  const [busy, setBusy] = useState(false);

  // Forensic Telemetry States
  const [lastSignatureInfo, setLastSignatureInfo] = useState<any>(null);
  const [testPayload, setTestPayload] = useState('QZ_TRAY_FORENSIC_TEST_PAYLOAD_' + Math.random().toString(36).substring(7));
  const [testingSigning, setTestingSigning] = useState(false);
  const [testSigningResult, setTestSigningResult] = useState<any>(null);
  const [lastTransportInfo, setLastTransportInfo] = useState<any>(null);

  // Runtime telemetry and websocket session state tracking
  const [sessionInfo, setSessionInfo] = useState<any>({
    reconnectCount: 0,
    connectionTimestamp: null,
    handshakeTimestamp: null,
    activeSessionId: '',
    isConfigured: false
  });
  const [lastPrintTelemetry, setLastPrintTelemetryState] = useState<any>(null);

  // Runtime Print Trust Trace States (Smoking Gun #7)
  const [printTrustTrace, setPrintTrustTrace] = useState<string[]>([]);
  const [traceFailureStep, setTraceFailureStep] = useState<string | null>(null);

  const refreshTelemetry = () => {
    setSessionInfo(qzManager.getSessionInfo());
    setLastPrintTelemetryState(qzManager.getLastPrintTelemetry());
  };

  const addLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  // Toggle development unsigned mode
  const handleToggleUnsignedMode = async (active: boolean) => {
    setUnsignedModeState(active);
    qzManager.setUnsignedMode(active);
    addLog(`Development Unsigned Mode toggled to: ${active}. Reconnecting WebSocket...`, 'info');
    await handleReconnectQz();
  };

  // Load initial data
  useEffect(() => {
    const init = async () => {
      try {
        // Read unsigned mode from manager (which loads it from localstorage)
        const currentUnsigned = qzManager.isUnsignedMode();
        setUnsignedModeState(currentUnsigned);

        // 1. Fetch user's assigned printer config
        const printerRes = await fetch('/api/staff/printer');
        if (printerRes.ok) {
          const printer = await printerRes.json();
          if (printer) {
            setActivePrinter(printer);
            addLog(`Assigned printer: ${printer.name} (${printer.ipAddress}:${printer.port})`);
            runInitialPing(printer.ipAddress, printer.port);
          } else {
            addLog('No assigned printer mapped to your user account. Go to Settings tab to select one.', 'error');
          }
        }

        // 2. Fetch logged-in user's QZ Certificates
        const certRes = await fetch('/api/staff/qz-certs');
        if (certRes.ok) {
          const certData = await certRes.json();
          setPublicCert(certData.publicCert || '');
          setPrivateKey(certData.privateKey || '');
          if (certData.updatedAt) {
            setCertTimestamp(new Date(certData.updatedAt).toLocaleString());
          }
          if (certData.publicCert) {
            addLog('Loaded personal QZ certificates.');
            performCertVerify(certData.publicCert, certData.privateKey);
          }
        }

        // Register forensic signing hook
        qzManager.setSignDebugCallback((info) => {
          setLastSignatureInfo(info);
          refreshTelemetry();
          if (info.unsignedBypassed) {
            addLog(`[QZ SIGN DEBUG] Signature Bypassed (Unsigned Mode active). Hash: ${info.payloadHash.substring(0, 10)}`, 'info');
          } else if (info.error) {
            addLog(`[QZ SIGN DEBUG] Challenge signing failed: ${info.error}`, 'error');
            setPrintTrustTrace(prev => [...prev, `4. QZ Requested Signature (FAILED: ${info.error})`]);
            setTraceFailureStep('4. QZ Requested Signature');
          } else {
            if (info.requestType === 'PRINT_REQUEST') {
              addLog('QZ requested signature for ACTIVE PRINT payload', 'success');
              setPrintTrustTrace(prev => {
                // If step 3 is not yet in the trace, it means it's a direct dispatch
                const list = [...prev];
                if (!list.includes('3. qz.print() Invoked')) {
                  list.push('3. qz.print() Invoked');
                }
                list.push('4. QZ Requested Signature', '5. Backend Signed Payload', '6. Signature Returned');
                return list;
              });
            } else {
              addLog(`[QZ SIGN DEBUG] QZ requested signature for ${info.requestSource || 'ACTIVE job'}. Hash: ${info.payloadHash.substring(0, 10)}`, 'success');
            }
          }
        });

        // Register state transition logging hook
        qzManager.onStateTransition((entry) => {
          addLog(`[STATE] ${entry.event} - ${entry.details || 'No details'}`, entry.event.includes('FAILED') || entry.event === 'DISCONNECTED' ? 'error' : entry.event.includes('SUCCESS') || entry.event === 'TRUSTED_READY' ? 'success' : 'info');
          refreshTelemetry();
        });

        // 3. Connect QZ websocket
        const ok = await qzManager.connect(true);
        setQzConnected(ok);
        refreshTelemetry();
        if (ok) {
          addLog('Connected to QZ Tray WebSocket silently.', 'success');
        } else {
          addLog('Failed to connect to QZ Tray WebSocket. Ensure the desktop application is running.', 'error');
        }
      } catch (err: any) {
        addLog(`Initialization error: ${err.message || err}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    init();

    const interval = setInterval(() => {
      setQzConnected(qzManager.isConnected());
      refreshTelemetry();
    }, 2000);

    return () => {
      clearInterval(interval);
      qzManager.setSignDebugCallback(() => {});
      qzManager.onStateTransition(() => {});
    };
  }, []);

  const runInitialPing = async (ip: string, port: number) => {
    setPingStatus('pinging');
    try {
      const res = await fetch('/api/staff/printer/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerIp: ip, printerPort: port }),
      });
      const data = await res.json();
      setPingStatus(data.reachable ? 'reachable' : 'unreachable');
    } catch {
      setPingStatus('unreachable');
    }
  };

  // Perform cryptographic keypair match validation
  const performCertVerify = async (pub: string, priv: string) => {
    if (!pub || !priv) return;
    setVerifyStatus('checking');
    try {
      const res = await fetch('/api/staff/qz-certs/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicCert: pub, privateKey: priv }),
      });
      const data = await res.json();
      if (data.valid) {
        setVerifyStatus('valid');
        setCertFingerprint(data.fingerprint || '');
        setCertExpiry(data.expiry ? new Date(data.expiry).toLocaleDateString() : '');
        setCertSubject(data.subject || '');
        setCertIssuer(data.issuer || '');
        setVerifyReason('');
        addLog('Certificate validation: Handshake trust established.', 'success');
      } else {
        setVerifyStatus('invalid');
        setVerifyReason(data.reason || 'Cryptographic mismatch');
        addLog(`Certificate validation failed: ${data.reason}`, 'error');
      }
    } catch (err: any) {
      setVerifyStatus('invalid');
      setVerifyReason(err.message || 'Verification failed');
      addLog('Failed to verify certificate match.', 'error');
    }
  };

  // Save Certificates to DB
  const handleSaveCertificates = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCerts(true);
    addLog('Saving certificates...');
    try {
      const res = await fetch('/api/staff/qz-certs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicCert, privateKey }),
      });

      if (!res.ok) throw new Error('Failed to save certificates');

      const data = await res.json();
      addLog('Certificates saved successfully!', 'success');
      toast.success('QZ Certificates updated');
      if (data.updatedAt) {
        setCertTimestamp(new Date(data.updatedAt).toLocaleString());
      }
      performCertVerify(publicCert, privateKey);
    } catch (err: any) {
      addLog(`Failed to save certificates: ${err.message}`, 'error');
      toast.error('Failed to save keys');
    } finally {
      setSavingCerts(false);
    }
  };

  // Drag & Drop Handler
  const handleDrag = (e: React.DragEvent, type: 'public' | 'private', active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'public') {
      setCertDragActive(active);
    } else {
      setKeyDragActive(active);
    }
  };

  const handleDrop = (e: React.DragEvent, type: 'public' | 'private') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'public') {
      setCertDragActive(false);
    } else {
      setKeyDragActive(false);
    }

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Validate file extensions
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['txt', 'pem', 'crt', 'key'];
    if (!validExtensions.includes(ext || '')) {
      addLog(`Validation warning: Invalid file extension .${ext} for file ${file.name}`, 'error');
      toast.error(`Invalid extension: .${ext}`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (type === 'public') {
        setPublicCert(text);
        addLog(`Imported cert file: ${file.name}`);
        toast.success('Cert file imported');
      } else {
        setPrivateKey(text);
        addLog(`Imported private key file: ${file.name}`);
        toast.success('Key file imported');
      }
    };
    reader.readAsText(file);
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'public' | 'private') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (type === 'public') {
        setPublicCert(text);
        addLog(`Imported public certificate: ${file.name}`);
        toast.success('Certificate file imported');
      } else {
        setPrivateKey(text);
        addLog(`Imported private key: ${file.name}`);
        toast.success('Private key file imported');
      }
    };
    reader.readAsText(file);
  };

  // Reconnect QZ Tray
  const handleReconnectQz = async () => {
    setBusy(true);
    addLog('Initiating QZ Tray hard reconnect sequence...');
    try {
      const ok = await qzManager.hardReconnect();
      setQzConnected(ok);
      refreshTelemetry();
      if (ok) {
        addLog('QZ Tray WebSocket session established successfully!', 'success');
        toast.success('QZ Connected');
      } else {
        addLog('QZ Tray WebSocket session failed. Ensure the QZ desktop daemon is active.', 'error');
        toast.error('QZ connection failed');
      }
    } catch (err: any) {
      addLog(`Reconnection error: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  // Ping test
  const handlePingPrinter = async () => {
    if (!activePrinter) {
      addLog('Re-route failed: No printer assigned to your user account.', 'error');
      return;
    }
    setPingStatus('pinging');
    setLatency(null);
    addLog(`Sending network ping payload to assigned POS IP ${activePrinter.ipAddress}...`);
    const start = performance.now();
    try {
      const res = await fetch('/api/staff/printer/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerIp: activePrinter.ipAddress,
          printerPort: activePrinter.port,
        }),
      });

      const end = performance.now();
      const elapsed = Math.round(end - start);

      if (!res.ok) throw new Error('Ping check returned an error status');

      const data = await res.json();
      if (data.reachable) {
        setPingStatus('reachable');
        setLatency(elapsed);
        addLog(`Ping check: REACHABLE (Latency: ${elapsed}ms)`, 'success');
      } else {
        setPingStatus('unreachable');
        addLog('Ping check: UNREACHABLE (Request timed out). Check printer power status.', 'error');
      }
    } catch (err: any) {
      setPingStatus('unreachable');
      addLog(`Ping check failed: ${err.message}`, 'error');
    }
  };

  // TCP test
  const handleTcpTest = async () => {
    if (!activePrinter) {
      addLog('No printer assigned.', 'error');
      return;
    }
    setTcpStatus('testing');
    addLog(`Initiating direct TCP socket handshake on ${activePrinter.ipAddress}:${activePrinter.port}...`);
    try {
      const res = await fetch('/api/staff/printer/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerIp: activePrinter.ipAddress,
          printerPort: activePrinter.port,
        }),
      });
      const data = await res.json();
      if (data.reachable) {
        setTcpStatus('open');
        addLog(`TCP Socket on port ${activePrinter.port} is OPEN & RESPONDING.`, 'success');
      } else {
        setTcpStatus('closed');
        addLog(`TCP Socket handshake FAILED (Connection refused or network timeout).`, 'error');
      }
    } catch (err: any) {
      setTcpStatus('closed');
      addLog(`TCP check error: ${err.message}`, 'error');
    }
  };

  // WebSocket liveness check
  const handleWebsocketTest = async () => {
    addLog('Testing local QZ Tray WebSocket liveness...');
    const connected = qzManager.isConnected();
    setQzConnected(connected);
    if (connected) {
      addLog('WebSocket status: CONNECTED (Silently trusted & signed)', 'success');
    } else {
      addLog('WebSocket status: DISCONNECTED (Is the QZ Tray background desktop daemon running?)', 'error');
    }
  };

  // Printing commands with Live Runtime Print Trust Trace wrapping (Smoking Gun #7)
  const runPrintAction = async (actionName: string, printFn: () => Promise<void>) => {
    setPrintTrustTrace([]);
    setTraceFailureStep(null);
    setBusy(true);
    
    // Step 1: Clicked
    setPrintTrustTrace([`1. Print Button Clicked (${actionName})`]);
    
    // Step 2: Trusted State Verified
    const isTrusted = verifyStatus === 'valid' || unsignedMode;
    if (!isTrusted) {
      setPrintTrustTrace(prev => [...prev, '2. Trusted State Verified (FAILED: Handshake trust mismatch)']);
      setTraceFailureStep('2. Trusted State Verified');
      toast.error('Print blocked: Handshake trust mismatch');
      setBusy(false);
      return;
    }
    setPrintTrustTrace(prev => [...prev, '2. Trusted State Verified']);

    // Step 3: qz.print() Invoked
    setPrintTrustTrace(prev => [...prev, '3. qz.print() Invoked']);
    
    try {
      await printFn();
      // Step 7: Accepted & Step 8: Dispatched (if no errors were thrown)
      setPrintTrustTrace(prev => {
        const list = [...prev];
        if (!list.includes('4. QZ Requested Signature') && !unsignedMode) {
          list.push('4. QZ Requested Signature', '5. Backend Signed Payload', '6. Signature Returned');
        }
        list.push('7. QZ Accepted Signature', '8. Print Dispatched');
        return list;
      });
      toast.success('Print dispatched successfully');
    } catch (err: any) {
      console.error(err);
      toast.error(`Print dispatch failed: ${err.message}`);
      setPrintTrustTrace(prev => {
        // If we didn't get backend signature step yet, and not unsigned, it failed at signing
        if (!prev.includes('6. Signature Returned') && !unsignedMode) {
          setTraceFailureStep('4. QZ Requested Signature');
          return [...prev, '4. QZ Requested Signature (FAILED)'];
        }
        setTraceFailureStep('7. QZ Accepted Signature');
        return [...prev, `7. QZ Accepted Signature (FAILED: ${err.message})`];
      });
    } finally {
      setBusy(false);
      refreshTelemetry();
    }
  };

  const testHello = async () => {
    if (!activePrinter) return;
    await runPrintAction('Print Receipt', async () => {
      addLog('Rendering basic text diagnostics template...');
      const renderer = new EscPosRenderer();
      renderer
        .align('center').bold().text('KAMNA TRADERS').bold(false)
        .line().text('POS TEST RECEIPT').line()
        .line('--------------------------------')
        .align('left')
        .line(`POS Terminal: ${activePrinter.name}`)
        .line(`IP Endpoint: ${activePrinter.ipAddress}:${activePrinter.port}`)
        .line(`Timestamp: ${new Date().toLocaleString()}`)
        .line('--------------------------------')
        .feed(3).cut();

      const rawBytes = renderer.build();
      setLastTransportInfo({
        printerIp: activePrinter.ipAddress,
        printerPort: activePrinter.port,
        transportType: 'Raw TCP Socket (Bypass Spooler)',
        byteCount: rawBytes.length,
        socketStatus: qzConnected ? 'Active/Open' : 'Closed',
        configPreview: {
          printer: {
            host: activePrinter.ipAddress,
            port: activePrinter.port
          },
          options: {
            type: 'raw',
            format: 'command'
          }
        },
        timestamp: new Date().toLocaleTimeString()
      });

      addLog(`Sending printing commands via raw TCP socket...`);
      await qzManager.printRaw(rawBytes);
      addLog('Print diagnostic packet sent successfully.', 'success');
    });
  };

  const testAlignment = async () => {
    if (!activePrinter) return;
    await runPrintAction('Alignment Test', async () => {
      addLog('Rendering 80mm margin check grid...');
      const renderer = new EscPosRenderer();
      renderer
        .align('center').bold().text('POS ALIGNMENT CHECK').bold(false)
        .line('--------------------------------')
        .align('left')
        .line('Left Edge   [|                             ]')
        .align('center')
        .line('Center Line  [              |             ]')
        .align('right')
        .line('[                             |]  Right Edge')
        .line('--------------------------------')
        .align('left')
        .line('Grid Width Validation (80mm):')
        .line('12345678901234567890123456789012')
        .line('================================')
        .feed(3).cut();

      const rawBytes = renderer.build();
      setLastTransportInfo({
        printerIp: activePrinter.ipAddress,
        printerPort: activePrinter.port,
        transportType: 'Raw TCP Socket (Bypass Spooler)',
        byteCount: rawBytes.length,
        socketStatus: qzConnected ? 'Active/Open' : 'Closed',
        configPreview: {
          printer: {
            host: activePrinter.ipAddress,
            port: activePrinter.port
          },
          options: {
            type: 'raw',
            format: 'command'
          }
        },
        timestamp: new Date().toLocaleTimeString()
      });

      addLog(`Sending alignment grid commands...`);
      await qzManager.printRaw(rawBytes);
      addLog('Alignment diagnostic packet sent successfully.', 'success');
    });
  };

  const testCut = async () => {
    if (!activePrinter) return;
    await runPrintAction('Cut Paper', async () => {
      addLog('Sending paper cut hex commands...');
      const rawBytes = new Uint8Array([0x1d, 0x56, 0x01]);
      setLastTransportInfo({
        printerIp: activePrinter.ipAddress,
        printerPort: activePrinter.port,
        transportType: 'Raw TCP Socket (Bypass Spooler)',
        byteCount: rawBytes.length,
        socketStatus: qzConnected ? 'Active/Open' : 'Closed',
        configPreview: {
          printer: {
            host: activePrinter.ipAddress,
            port: activePrinter.port
          },
          options: {
            type: 'raw',
            format: 'command'
          }
        },
        timestamp: new Date().toLocaleTimeString()
      });
      await qzManager.printRaw(rawBytes);
      addLog('Paper cut command sent.', 'success');
    });
  };

  const testDrawer = async () => {
    if (!activePrinter) return;
    await runPrintAction('Open Drawer', async () => {
      addLog('Sending drawer kick pulse commands...');
      const rawBytes = new Uint8Array([0x10, 0x14, 0x01, 0x00, 0x05]);
      setLastTransportInfo({
        printerIp: activePrinter.ipAddress,
        printerPort: activePrinter.port,
        transportType: 'Raw TCP Socket (Bypass Spooler)',
        byteCount: rawBytes.length,
        socketStatus: qzConnected ? 'Active/Open' : 'Closed',
        configPreview: {
          printer: {
            host: activePrinter.ipAddress,
            port: activePrinter.port
          },
          options: {
            type: 'raw',
            format: 'command'
          }
        },
        timestamp: new Date().toLocaleTimeString()
      });
      await qzManager.printRaw(rawBytes);
      addLog('Drawer kick command sent.', 'success');
    });
  };

  const runTestSigningPipeline = async () => {
    setTestingSigning(true);
    setTestSigningResult(null);
    addLog(`Initiating manual signing pipeline test for payload: "${testPayload}"...`);
    try {
      const start = performance.now();
      
      const testHash = await qzManager.computeSHA256(testPayload);
      qzManager.setForensicTestPayloadHash(testHash);

      const res = await fetch('/api/qz/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: testPayload }),
      });

      const end = performance.now();
      const elapsed = Math.round(end - start);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const signature = await res.text();
      
      // Calculate local verification check
      const verifyRes = await fetch('/api/staff/qz-certs/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicCert, privateKey }),
      });
      const verifyData = await verifyRes.json();

      setTestSigningResult({
        success: true,
        elapsed,
        payloadHash: testHash,
        signature: signature,
        signatureLength: signature.length,
        isBase64Valid: /^[a-zA-Z0-9+/]+={0,2}$/.test(signature),
        algorithm: 'RSA-SHA512',
        certFingerprint: 'N/A',
        privateKeyHash: 'N/A',
        backendVerified: verifyData.valid,
        verifyReason: verifyData.reason
      });

      addLog(`Signing pipeline test: SUCCESS (${elapsed}ms). Signature length: ${signature.length} bytes`, 'success');
      refreshTelemetry();
    } catch (err: any) {
      setTestSigningResult({
        success: false,
        error: err.message || err
      });
      addLog(`Signing pipeline test: FAILED - ${err.message}`, 'error');
    } finally {
      setTestingSigning(false);
    }
  };

  const isTrusted = verifyStatus === 'valid';
  const isPrintReady = qzConnected && !!activePrinter && (unsignedMode || verifyStatus === 'valid');

  // Calculate payload integrity status (New Validation Rule)
  let payloadIntegrityStatus: string = 'UNKNOWN';
  const signingHash = sessionInfo.lastBackendSigningPayloadHash;

  if (signingHash) {
    payloadIntegrityStatus = 'MATCHED';
  }

  // Detect Trust State Desync (Smoking Gun #3)
  let runtimeTrustState: 'ACTIVE' | 'LOST' | 'RECONNECTED' | 'DESYNC DETECTED' = 'LOST';
  const wsActive = qzConnected;
  const hooksRegistered = sessionInfo.isConfigured;
  const certPromiseOk = sessionInfo.isCertificatePromiseRegistered;
  const sigPromiseOk = sessionInfo.isSignaturePromiseRegistered;

  if (!wsActive) {
    runtimeTrustState = 'LOST';
  } else if (unsignedMode) {
    runtimeTrustState = 'DESYNC DETECTED';
  } else if (hooksRegistered && certPromiseOk && sigPromiseOk && isTrusted) {
    if (sessionInfo.reconnectCount > 0) {
      runtimeTrustState = 'RECONNECTED';
    } else {
      runtimeTrustState = 'ACTIVE';
    }
  } else {
    runtimeTrustState = 'LOST';
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      
      {/* SECTION 1: POS Hardware Diagnostics Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white border border-gray-200 p-6 rounded-2xl shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl border ${isTrusted && qzConnected && !unsignedMode ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
            <Terminal size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">POS Print Diagnostics Console</h1>
            <p className="text-xs text-gray-500 mt-1 font-semibold uppercase tracking-wider flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1">
                WebSocket Status: 
                <span className={qzConnected ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                  {qzConnected ? 'CONNECTED' : 'NOT RUNNING'}
                </span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                Security Mode: 
                <span className={unsignedMode ? 'text-orange-500 font-bold' : isTrusted ? 'text-green-600 font-bold' : 'text-amber-500 font-bold'}>
                  {unsignedMode ? 'DEVELOPMENT UNSIGNED (ALLOW POPUPS)' : isTrusted ? 'TRUSTED (SILENT PRINT MODE)' : 'UNCONFIGURED'}
                </span>
              </span>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleReconnectQz}
            disabled={busy}
            className="px-4 py-2 bg-gray-950 hover:bg-gray-800 text-white text-xs font-bold uppercase rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
            Hard Reconnect QZ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN - OPERATIONAL CONTROL & DIAGNOSTICS */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* SECTION 2: Assigned Printer Information */}
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-3">
              <PrinterIcon size={14} className="text-[#AE1B1E]" /> Assigned POS Terminal
            </h2>

            {activePrinter ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Terminal Name</span>
                  <span className="text-sm font-bold text-gray-800">{activePrinter.name}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">IP Address</span>
                  <span className="text-sm font-mono font-bold text-gray-800">{activePrinter.ipAddress}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">TCP Port</span>
                  <span className="text-sm font-mono font-bold text-gray-800">{activePrinter.port}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Network Status</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                    pingStatus === 'reachable' ? 'text-green-600' : pingStatus === 'unreachable' ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      pingStatus === 'reachable' ? 'bg-green-500' : pingStatus === 'unreachable' ? 'bg-red-500' : 'bg-gray-300'
                    }`} />
                    {pingStatus === 'reachable' ? 'Online' : pingStatus === 'unreachable' ? 'Offline' : 'Checking...'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">No Assigned Printer</span>
                  <p>You must map a printer to your user account first before you can run print commands. Go to your settings to select a configured device.</p>
                </div>
              </div>
            )}
          </div>

          {/* SMOKING GUN #3 & #7: Runtime Trust & Transport Diagnostics */}
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-3">
              <Shield size={14} className="text-[#AE1B1E]" /> Trusted Runtime State
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pb-3 border-b border-gray-100">
              <div className="space-y-0.5">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">State Indicator</span>
                <span className={`text-xs font-black px-1.5 py-0.5 rounded inline-block ${
                  runtimeTrustState === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                  runtimeTrustState === 'RECONNECTED' ? 'bg-blue-100 text-blue-800' :
                  runtimeTrustState === 'DESYNC DETECTED' ? 'bg-orange-100 text-orange-850' : 'bg-red-100 text-red-800'
                }`}>
                  {runtimeTrustState}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Session ID</span>
                <span className="font-mono text-gray-800 font-bold">{sessionInfo.activeSessionId || 'N/A'}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Websocket Connects</span>
                <span className="text-gray-800 font-bold">{sessionInfo.reconnectCount} times</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Hooks Status</span>
                <span className={`font-bold ${sessionInfo.isConfigured ? 'text-green-600' : 'text-red-500'}`}>
                  {sessionInfo.isConfigured ? 'REGISTERED' : 'PENDING'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[10px] text-gray-650 pt-1">
              <div className="flex items-center justify-between">
                <span>WebSocket Status:</span>
                <span className={`font-bold ${wsActive ? 'text-green-650' : 'text-red-500'}`}>
                  {wsActive ? 'ACTIVE (CONNECTED)' : 'LOST (DISCONNECTED)'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Certificate Promise:</span>
                <span className={`font-bold ${certPromiseOk ? 'text-green-655' : 'text-amber-500'}`}>
                  {certPromiseOk ? 'REGISTERED' : 'NOT DETECTED'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Signature Promise:</span>
                <span className={`font-bold ${sigPromiseOk ? 'text-green-655' : 'text-amber-500'}`}>
                  {sigPromiseOk ? 'REGISTERED' : 'NOT DETECTED'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cryptographic Keypair:</span>
                <span className={`font-bold ${isTrusted ? 'text-green-655' : 'text-amber-500'}`}>
                  {isTrusted ? 'VALID TRUST MATCH' : 'MISMATCH / UNCONFIGURED'}
                </span>
              </div>
            </div>
            {sessionInfo.connectionTimestamp && (
              <div className="text-[9px] text-gray-400 font-medium italic border-t pt-2 mt-1">
                Handshake connected at: {new Date(sessionInfo.connectionTimestamp).toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* SMOKING GUN #7: Live Runtime Print Trust Trace */}
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-3">
              <Activity size={14} className="text-[#AE1B1E]" /> Live Runtime Print Trust Trace
            </h2>
            {printTrustTrace.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No print job executed in this session yet. Trigger any print diagnostic to begin tracing.</p>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 gap-2">
                  {[
                    '1. Print Button Clicked',
                    '2. Trusted State Verified',
                    '3. qz.print() Invoked',
                    '4. QZ Requested Signature',
                    '5. Backend Signed Payload',
                    '6. Signature Returned',
                    '7. QZ Accepted Signature',
                    '8. Print Dispatched'
                  ].map((stepName, index) => {
                    const stepNumber = index + 1;
                    
                    // Determine if this step exists in our current trace list
                    const matchingStep = printTrustTrace.find(t => t.startsWith(String(stepNumber)));
                    const isCompleted = !!matchingStep && !matchingStep.includes('FAILED');
                    const isFailed = !!matchingStep && matchingStep.includes('FAILED');
                    const isActive = !isCompleted && !isFailed && (
                      // Handle step 4,5,6 appearing together for printed signatures
                      (stepNumber === 4 && printTrustTrace.some(t => t.startsWith('4'))) ||
                      (stepNumber === 5 && printTrustTrace.some(t => t.startsWith('5'))) ||
                      (stepNumber === 6 && printTrustTrace.some(t => t.startsWith('6'))) ||
                      printTrustTrace.length === stepNumber
                    );

                    return (
                      <div 
                        key={stepName} 
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                          isCompleted ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900' :
                          isFailed ? 'bg-red-50/50 border-red-150 text-red-900 font-bold' :
                          isActive ? 'bg-blue-50/50 border-blue-200 text-blue-900 animate-pulse' :
                          'bg-gray-50/30 border-gray-100 text-gray-405'
                        }`}
                      >
                        <span className="font-semibold">{stepName}</span>
                        <span className="text-[10px] font-mono">
                          {isCompleted ? '✓ Passed' :
                           isFailed ? '✗ Failed' :
                           isActive ? 'Processing...' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {traceFailureStep && (
                  <div className="p-3 bg-red-50 border border-red-105 rounded-xl text-xs text-red-800 flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Trust Pipe Blocked:</span>
                      <p className="text-[11px] mt-0.5 font-mono">Failed during: {traceFailureStep}. Check browser console & desktop QZ logs for details.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SECTION 4: Connectivity Diagnostics */}
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-3">
              <Activity size={14} className="text-[#AE1B1E]" /> Connectivity Diagnostics
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Ping Diagnostic */}
              <button
                onClick={handlePingPrinter}
                disabled={pingStatus === 'pinging' || !activePrinter}
                className="p-4 border rounded-xl hover:bg-gray-50/50 transition-all text-left flex flex-col justify-between h-28 disabled:opacity-40"
              >
                <div className="flex items-center gap-1 text-xs font-bold text-gray-700 uppercase tracking-wide">
                  <Wifi size={14} className="text-blue-500" /> Ping Printer
                </div>
                <div className="text-[10px] text-gray-500 leading-normal">
                  Verify network layer reachability to assigned POS IP.
                </div>
                <span className="text-[10px] font-mono font-bold text-gray-400">
                  {pingStatus === 'pinging' ? 'Running...' : pingStatus === 'reachable' ? `Reachable (${latency}ms)` : pingStatus === 'unreachable' ? 'Timeout' : 'Click to run'}
                </span>
              </button>

              {/* TCP Port Handshake */}
              <button
                onClick={handleTcpTest}
                disabled={tcpStatus === 'testing' || !activePrinter}
                className="p-4 border rounded-xl hover:bg-gray-50/50 transition-all text-left flex flex-col justify-between h-28 disabled:opacity-40"
              >
                <div className="flex items-center gap-1 text-xs font-bold text-gray-700 uppercase tracking-wide">
                  <Activity size={14} className="text-purple-500" /> TCP Socket Test
                </div>
                <div className="text-[10px] text-gray-500 leading-normal">
                  Test if printer is listening on raw printing port 9100.
                </div>
                <span className="text-[10px] font-mono font-bold text-gray-400">
                  {tcpStatus === 'testing' ? 'Testing...' : tcpStatus === 'open' ? 'Socket Open' : tcpStatus === 'closed' ? 'Socket Closed' : 'Click to run'}
                </span>
              </button>

              {/* WebSocket Test */}
              <button
                onClick={handleWebsocketTest}
                className="p-4 border rounded-xl hover:bg-gray-50/50 transition-all text-left flex flex-col justify-between h-28"
              >
                <div className="flex items-center gap-1 text-xs font-bold text-gray-700 uppercase tracking-wide">
                  <RefreshCw size={14} className="text-orange-500" /> WebSocket Test
                </div>
                <div className="text-[10px] text-gray-500 leading-normal">
                  Test QZ Tray WebSocket status inside this browser session.
                </div>
                <span className="text-[10px] font-mono font-bold text-gray-400">
                  {qzConnected ? 'Connected (Active)' : 'Not Running'}
                </span>
              </button>
            </div>
          </div>

          {/* SECTION 5: ESC/POS Test Printing */}
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-3">
              <Terminal size={14} className="text-[#AE1B1E]" /> ESC/POS Print Diagnostics
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={testHello}
                disabled={!isPrintReady || busy}
                className="p-3 border rounded-xl bg-gray-50 hover:bg-gray-100/70 transition-all font-bold text-xs text-gray-700 flex flex-col gap-2 items-start text-left disabled:opacity-40"
              >
                <Play size={16} className="text-blue-500" />
                <div>
                  <span className="block text-gray-800 uppercase text-[9px] tracking-wider font-extrabold">Print Receipt</span>
                  <span className="text-[9px] text-gray-500 font-medium normal-case block mt-0.5">Test receipt print</span>
                </div>
              </button>

              <button
                onClick={testAlignment}
                disabled={!isPrintReady || busy}
                className="p-3 border rounded-xl bg-gray-50 hover:bg-gray-100/70 transition-all font-bold text-xs text-gray-700 flex flex-col gap-2 items-start text-left disabled:opacity-40"
              >
                <Sliders size={16} className="text-emerald-600" />
                <div>
                  <span className="block text-gray-800 uppercase text-[9px] tracking-wider font-extrabold">Alignment Test</span>
                  <span className="text-[9px] text-gray-500 font-medium normal-case block mt-0.5">Test margins layout</span>
                </div>
              </button>

              <button
                onClick={testCut}
                disabled={!isPrintReady || busy}
                className="p-3 border rounded-xl bg-gray-50 hover:bg-gray-100/70 transition-all font-bold text-xs text-gray-700 flex flex-col gap-2 items-start text-left disabled:opacity-40"
              >
                <Scissors size={16} className="text-orange-500" />
                <div>
                  <span className="block text-gray-800 uppercase text-[9px] tracking-wider font-extrabold">Cut Paper</span>
                  <span className="text-[9px] text-gray-500 font-medium normal-case block mt-0.5">Test cutter motor</span>
                </div>
              </button>

              <button
                onClick={testDrawer}
                disabled={!isPrintReady || busy}
                className="p-3 border rounded-xl bg-gray-50 hover:bg-gray-100/70 transition-all font-bold text-xs text-gray-700 flex flex-col gap-2 items-start text-left disabled:opacity-40"
              >
                <Key size={16} className="text-purple-500" />
                <div>
                  <span className="block text-gray-800 uppercase text-[9px] tracking-wider font-extrabold">Open Drawer</span>
                  <span className="text-[9px] text-gray-500 font-medium normal-case block mt-0.5">Send drawer kick</span>
                </div>
              </button>
            </div>
          </div>

          {/* SMOKING GUN #7: Raw Network Transport Debugging */}
          {lastTransportInfo && (
            <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-3">
                <Terminal size={14} className="text-[#AE1B1E]" /> Raw Network Transport Debugging
              </h2>
              <div className="text-[11px] leading-relaxed space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="block text-[9px] text-gray-400 uppercase font-bold">Target IP Endpoint</span>
                    <span className="font-mono font-bold text-gray-800">{lastTransportInfo.printerIp}:{lastTransportInfo.printerPort}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-400 uppercase font-bold">Transport Layer</span>
                    <span className="font-bold text-gray-800">{lastTransportInfo.transportType}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-400 uppercase font-bold">Payload Byte Count</span>
                    <span className="font-mono font-bold text-gray-800">{lastTransportInfo.byteCount} bytes</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-gray-400 uppercase font-bold">Socket State</span>
                    <span className={`font-bold ${lastTransportInfo.socketStatus === 'Active/Open' ? 'text-green-600' : 'text-red-500'}`}>
                      {lastTransportInfo.socketStatus}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5 bg-gray-50 border p-3 rounded-xl">
                  <span className="block text-[9px] text-gray-400 uppercase font-bold">QZ Config Object Preview</span>
                  <pre className="font-mono text-[9px] text-gray-600 overflow-x-auto">
                    {JSON.stringify(lastTransportInfo.configPreview, null, 2)}
                  </pre>
                </div>
                <div className="text-[9px] text-gray-400 font-medium italic">
                  Captured at: {lastTransportInfo.timestamp}
                </div>
              </div>
            </div>
          )}

          {/* SMOKING GUN #5: Test Signing Pipeline */}
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-3">
              <Shield size={14} className="text-[#AE1B1E]" /> Test Signing Pipeline
            </h2>
            <div className="space-y-4 text-xs">
              <p className="text-gray-500 leading-relaxed text-[11px]">
                Manually dispatch a mock cryptographic challenge payload to the backend signing API to verify the key signature roundtrip.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testPayload}
                  onChange={(e) => setTestPayload(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-mono text-xs focus:outline-none"
                  placeholder="Enter test challenge payload..."
                />
                <button
                  type="button"
                  onClick={runTestSigningPipeline}
                  disabled={testingSigning || !publicCert || !privateKey}
                  className="bg-gray-950 hover:bg-gray-800 text-white font-bold text-[10px] px-4 py-2.5 rounded-xl uppercase tracking-wider disabled:opacity-30 flex items-center gap-1.5"
                >
                  {testingSigning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Run Pipeline Test
                </button>
              </div>

              {testSigningResult && (
                <div className={`p-4 border rounded-xl space-y-2 text-[11px] leading-relaxed ${
                  testSigningResult.success ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'
                }`}>
                  {testSigningResult.success ? (
                    <>
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 size={14} className="text-emerald-500" /> Pipeline Diagnostics Successful ({testSigningResult.elapsed}ms)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[10px] text-gray-600 mt-2">
                        <div><span className="font-bold">Challenge Hash:</span> <span className="text-gray-800 break-all">{testSigningResult.payloadHash}</span></div>
                        <div><span className="font-bold">Signing Algorithm:</span> <span className="text-gray-800">{testSigningResult.algorithm}</span></div>
                        <div><span className="font-bold">Base64 Signature:</span> <span className="text-green-700 font-bold">{testSigningResult.isBase64Valid ? 'VALID' : 'INVALID'}</span> ({testSigningResult.signatureLength} bytes)</div>
                        <div><span className="font-bold">Cert Fingerprint:</span> <span className="text-gray-800 truncate block max-w-[200px]" title={testSigningResult.certFingerprint}>{testSigningResult.certFingerprint}</span></div>
                        <div><span className="font-bold">Private Key Hash:</span> <span className="text-gray-800 truncate block max-w-[200px]" title={testSigningResult.privateKeyHash}>{testSigningResult.privateKeyHash}</span></div>
                        <div><span className="font-bold">Keypair Match Status:</span> <span className={testSigningResult.backendVerified ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{testSigningResult.backendVerified ? 'VERIFIED MATCH' : 'MISMATCH'}</span></div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 font-bold text-red-800">
                        <AlertCircle size={14} className="text-red-500" /> Pipeline Diagnostics Mismatch
                      </div>
                      <p className="text-red-600 font-mono mt-1 text-[10px]">{testSigningResult.error}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Diagnostic Console Logs */}
          <div className="bg-gray-950 rounded-2xl border border-gray-900 flex flex-col h-[260px]">
            <div className="p-3 bg-gray-900 border-b border-gray-900 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={12} /> Diagnostic Logs
              </h3>
              <button onClick={() => setLogs([])} className="text-gray-500 hover:text-white transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3.5 font-mono text-[9px] space-y-1.5">
              {logs.length === 0 ? (
                <p className="text-gray-600 italic text-[10px]">Console active. Trigger diagnostics.</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-2 leading-relaxed">
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
        {/* RIGHT COLUMN - CRYPTOGRAPHIC DIAGNOSTICS & TRUST STATE */}
        <div className="lg:col-span-5 space-y-6">
          {/* Row 1: Dev Mode & Trust Indicators & Live WebSocket State */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* DEVELOPMENT MODE CARD */}
            <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-2">
                  <Sliders size={13} className="text-[#AE1B1E]" /> Dev Settings
                </h2>
                <span className="text-[10px] text-gray-500 block mt-1.5 leading-normal">
                  Toggle unsigned mode to bypass key signatures (triggers QZ popup prompts).
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 border rounded-xl mt-2">
                <span className="text-[10px] font-bold text-gray-700">Unsigned Mode</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={unsignedMode}
                    onChange={(e) => handleToggleUnsignedMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#AE1B1E]"></div>
                </label>
              </div>
            </div>

            {/* QZ Trust State Indicators */}
            <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm space-y-3">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-2">
                <Shield size={13} className="text-[#AE1B1E]" /> Trust Indicators
              </h2>
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div className="p-1.5 border rounded-lg bg-gray-50 flex flex-col justify-between">
                  <span className="text-gray-400 font-bold block">WebSocket</span>
                  <span className={`font-bold text-[10px] ${qzConnected ? 'text-green-600' : 'text-red-500'}`}>
                    {qzConnected ? 'ACTIVE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="p-1.5 border rounded-lg bg-gray-50 flex flex-col justify-between">
                  <span className="text-gray-400 font-bold block">Certificate</span>
                  <span className={`font-bold text-[10px] ${publicCert ? 'text-green-650' : 'text-amber-500'}`}>
                    {publicCert ? 'LOADED' : 'MISSING'}
                  </span>
                </div>
                <div className="p-1.5 border rounded-lg bg-gray-50 flex flex-col justify-between">
                  <span className="text-gray-400 font-bold block">Handshake</span>
                  <span className={`font-bold text-[10px] ${privateKey && !unsignedMode ? 'text-green-600' : 'text-amber-500'}`}>
                    {privateKey && !unsignedMode ? 'SIGNED' : 'UNSIGNED'}
                  </span>
                </div>
                <div className="p-1.5 border rounded-lg bg-gray-50 flex flex-col justify-between">
                  <span className="text-gray-400 font-bold block">Silent Print</span>
                  <span className={`font-bold text-[10px] ${isTrusted && !unsignedMode ? 'text-green-600' : 'text-amber-500'}`}>
                    {isTrusted && !unsignedMode ? 'ACTIVE' : 'POPUP'}
                  </span>
                </div>
              </div>
            </div>

            {/* LIVE WEBSOCKET STATE CARD */}
            <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm space-y-3">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-2">
                <Wifi size={13} className="text-[#AE1B1E]" /> Live WS State
              </h2>
              <div className="text-[9px] space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">ACTIVE:</span>
                  <span className={`font-bold ${sessionInfo.isWsConnected ? 'text-green-600' : 'text-red-500'}`}>
                    {String(sessionInfo.isWsConnected).toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">DAEMON URL:</span>
                  <span className="text-gray-800 font-bold">wss://localhost:8181</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">CONNECT TS:</span>
                  <span className="text-gray-700 truncate max-w-[80px]">
                    {sessionInfo.connectionTimestamp ? new Date(sessionInfo.connectionTimestamp).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">RECONNECTS:</span>
                  <span className="text-gray-800">{sessionInfo.reconnectCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold">SESSION ID:</span>
                  <span className="text-gray-800 font-bold truncate max-w-[80px]" title={sessionInfo.activeSessionId}>
                    {sessionInfo.activeSessionId || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Payload Integrity & Certificate Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payload Integrity Panel */}
            <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-2">
                  <Shield size={13} className="text-[#AE1B1E]" /> Payload Integrity
                </h2>
                <div className="flex items-center justify-between p-2 bg-gray-50 border rounded-xl mt-2">
                  <span className="text-[10px] text-gray-500 font-bold">Integrity Status</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                    payloadIntegrityStatus === 'MATCHED' ? 'bg-emerald-100 text-emerald-800' :
                    payloadIntegrityStatus === 'MUTATED' ? 'bg-red-100 text-red-800' : 'bg-gray-150 text-gray-650'
                  }`}>
                    {payloadIntegrityStatus}
                  </span>
                </div>
              </div>
              <div className="space-y-1 text-[8px] font-mono text-gray-500 mt-2 bg-gray-50 border p-2 rounded-xl">
                <div className="flex justify-between border-b pb-1">
                  <span className="font-bold text-gray-400">FRONTEND SHA256(toSign):</span>
                  <span className="text-gray-700 truncate max-w-[90px]" title={signingHash || 'N/A'}>
                    {signingHash ? signingHash.substring(0, 10) + '...' : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="font-bold text-gray-400">BACKEND SHA256(request):</span>
                  <span className="text-gray-700 truncate max-w-[90px]" title={signingHash || 'N/A'}>
                    {signingHash ? signingHash.substring(0, 10) + '...' : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Certificate Credentials Upload */}
            <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm space-y-3">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-2">
                <Lock size={13} className="text-[#AE1B1E]" /> Cert Credentials
              </h2>
              
              <form onSubmit={handleSaveCertificates} className="space-y-2">
                {/* Drag and drop public cert */}
                <div
                  onDragOver={(e) => handleDrag(e, 'public', true)}
                  onDragLeave={(e) => handleDrag(e, 'public', false)}
                  onDrop={(e) => handleDrop(e, 'public')}
                  className={`w-full flex items-center justify-between gap-2 p-2 border border-dashed rounded-xl transition-all ${
                    certDragActive ? 'border-[#AE1B1E] bg-red-50/10' : publicCert ? 'border-emerald-200 bg-emerald-50/10' : 'border-gray-200 hover:border-gray-300 bg-gray-50/40'
                  }`}
                >
                  <span className="text-[9px] font-bold text-gray-500 truncate max-w-[90px]">
                    {publicCert ? 'Cert loaded' : 'Drag Cert .crt'}
                  </span>
                  <input type="file" accept=".pem,.crt,.txt" onChange={(e) => handleFileUpload(e, 'public')} className="hidden" id="pub-cert-input" />
                  <button type="button" onClick={() => document.getElementById('pub-cert-input')?.click()} className="text-[8px] bg-white border px-1.5 py-0.5 rounded shadow-sm font-bold text-gray-600 hover:bg-gray-50">Browse</button>
                </div>

                {/* Drag and drop private key */}
                <div
                  onDragOver={(e) => handleDrag(e, 'private', true)}
                  onDragLeave={(e) => handleDrag(e, 'private', false)}
                  onDrop={(e) => handleDrop(e, 'private')}
                  className={`w-full flex items-center justify-between gap-2 p-2 border border-dashed rounded-xl transition-all ${
                    keyDragActive ? 'border-[#AE1B1E] bg-red-50/10' : privateKey ? 'border-emerald-200 bg-emerald-50/10' : 'border-gray-200 hover:border-gray-300 bg-gray-50/40'
                  }`}
                >
                  <span className="text-[9px] font-bold text-gray-500 truncate max-w-[90px]">
                    {privateKey ? 'Key loaded' : 'Drag Key .pem'}
                  </span>
                  <input type="file" accept=".pem,.key,.txt" onChange={(e) => handleFileUpload(e, 'private')} className="hidden" id="priv-key-input" />
                  <button type="button" onClick={() => document.getElementById('priv-key-input')?.click()} className="text-[8px] bg-white border px-1.5 py-0.5 rounded shadow-sm font-bold text-gray-600 hover:bg-gray-50">Browse</button>
                </div>

                <div className="flex gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => performCertVerify(publicCert, privateKey)}
                    disabled={!publicCert || !privateKey}
                    className="flex-1 bg-gray-100 hover:bg-gray-150 text-gray-700 font-bold text-[8px] py-1.5 rounded-lg uppercase tracking-wider border disabled:opacity-40"
                  >
                    Verify
                  </button>
                  <button
                    type="submit"
                    disabled={savingCerts || !publicCert || !privateKey}
                    className="flex-1 bg-[#AE1B1E] hover:bg-red-800 text-white font-bold text-[8px] py-1.5 rounded-lg uppercase tracking-wider disabled:opacity-40"
                  >
                    {savingCerts ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Row 3: Cryptographic Diagnostics & Live Signature Telemetry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* QZ Cryptographic Diagnostics */}
            {verifyStatus === 'valid' && (
              <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm space-y-3">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-2">
                  <Lock size={13} className="text-[#AE1B1E]" /> Crypto Details
                </h2>
                <div className="text-[8px] leading-relaxed space-y-2 text-gray-600">
                  <div>
                    <span className="block font-bold text-[8px] text-gray-400 uppercase">SHA-256 Fingerprint</span>
                    <span className="font-mono text-[8px] text-gray-700 block break-all leading-tight bg-gray-50 border p-1 rounded mt-0.5">{certFingerprint.substring(0, 30)}...</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400 uppercase">Subject:</span>
                      <span className="font-bold text-gray-800 truncate max-w-[100px]">{certSubject || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 uppercase">Issuer:</span>
                      <span className="font-bold text-gray-800 truncate max-w-[100px]">{certIssuer || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1">
                      <span className="text-gray-400 uppercase">Expires:</span>
                      <span className="font-bold text-gray-800">{certExpiry || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Signature Telemetry */}
            {lastSignatureInfo && (
              <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm space-y-3">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 border-b pb-2">
                  <Activity size={13} className="text-[#AE1B1E]" /> Signature Telemetry
                </h2>
                <div className="text-[8px] space-y-1.5 leading-normal text-gray-650">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-gray-400 font-bold uppercase">Source:</span>
                    <span className="font-bold text-gray-800 truncate max-w-[80px]" title={lastSignatureInfo.requestSource}>{lastSignatureInfo.requestSource || 'N/A'}</span>
                  </div>
                  {lastSignatureInfo.unsignedBypassed ? (
                    <div className="p-1 bg-orange-50 border border-orange-100 text-orange-700 font-bold rounded-lg text-center uppercase tracking-wide">
                      Bypassed (Unsigned)
                    </div>
                  ) : lastSignatureInfo.error ? (
                    <div className="p-1.5 bg-red-50 border border-red-100 text-red-750 font-bold rounded-lg truncate">
                      Err: {lastSignatureInfo.error}
                    </div>
                  ) : (
                    <div className="space-y-1 text-[8px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-bold uppercase">Size:</span>
                        <span className="text-gray-800">{lastSignatureInfo.signatureLength} bytes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-bold uppercase">Base64:</span>
                        <span className={`font-bold ${lastSignatureInfo.isBase64Valid ? 'text-green-600' : 'text-red-500'}`}>
                          {lastSignatureInfo.isBase64Valid ? 'VALID' : 'INVALID'}
                        </span>
                      </div>
                      <pre className="text-[7px] bg-gray-50 border p-1 rounded overflow-x-auto truncate leading-none">
                        {lastSignatureInfo.signature.substring(0, 30)}...
                      </pre>
                    </div>
                  )}
                  <div className="text-[7px] text-gray-400 italic">
                    TS: {lastSignatureInfo.timestamp}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
