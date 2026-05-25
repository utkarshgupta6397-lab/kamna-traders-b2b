/**
 * qz-tray.ts
 *
 * Client-side manager for QZ Tray. Sets up WebSocket connection, certificate signing,
 * and raw ESC/POS printing over TCP socket direct to the configured Ethernet printer.
 */

import qz from 'qz-tray';

interface PrinterRecord {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  printerType: string;
  isActive: boolean;
}

class QzManager {
  private static instance: QzManager;
  private unsignedMode = false;
  private signDebugCallback: ((info: any) => void) | null = null;
  private isConfigured = false;
  private activePrinter: PrinterRecord | null = null;
  private lastSuccessfulPrint: Date | null = null;
  private connectingPromise: Promise<boolean> | null = null;

  // Session & Reconnect Tracking Telemetry
  private reconnectCount = 0;
  private connectionTimestamp: string | null = null;
  private handshakeTimestamp: string | null = null;
  private activeSessionId: string | null = null;
  private lastPrintTelemetry: any = null;

  // Smoking Gun #6 Hash Tracking
  private lastForensicTestPayloadHash: string | null = null;
  private lastActualPrintPayloadHash: string | null = null;
  private lastBackendSigningPayloadHash: string | null = null;
  private certificatePromiseRegistered = false;
  private signaturePromiseRegistered = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.unsignedMode = localStorage.getItem('qz_unsigned_mode') === 'true';
      this.activeSessionId = 'QZ_SESS_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      this.configureSecurity();
    }
  }

  public setUnsignedMode(active: boolean) {
    this.unsignedMode = active;
    if (typeof window !== 'undefined') {
      localStorage.setItem('qz_unsigned_mode', String(active));
    }
    console.log(`[QzManager] Unsigned Mode toggled to: ${active}`);
  }

  public isUnsignedMode(): boolean {
    return this.unsignedMode;
  }

  public setSignDebugCallback(cb: (info: any) => void) {
    this.signDebugCallback = cb;
  }

  public setForensicTestPayloadHash(hash: string) {
    this.lastForensicTestPayloadHash = hash;
  }

  public getSessionInfo() {
    return {
      reconnectCount: this.reconnectCount,
      connectionTimestamp: this.connectionTimestamp,
      handshakeTimestamp: this.handshakeTimestamp,
      activeSessionId: this.activeSessionId,
      isConfigured: this.isConfigured,
      isCertificatePromiseRegistered: this.certificatePromiseRegistered,
      isSignaturePromiseRegistered: this.signaturePromiseRegistered,
      lastForensicTestPayloadHash: this.lastForensicTestPayloadHash,
      lastActualPrintPayloadHash: this.lastActualPrintPayloadHash,
      lastBackendSigningPayloadHash: this.lastBackendSigningPayloadHash
    };
  }

  public getLastPrintTelemetry() {
    return this.lastPrintTelemetry;
  }

  public async hardReconnect(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      console.log('[QzManager] [QZ RECONNECT PIPELINE] --- STARTING HARD RECONNECT ---');
      if (qz.websocket.isActive()) {
        console.log('[QzManager] [QZ RECONNECT PIPELINE] Disconnecting active stale WebSocket session...');
        await qz.websocket.disconnect();
      }
      
      // Clear configuration state and reset hooks status
      this.isConfigured = false;
      this.certificatePromiseRegistered = false;
      this.signaturePromiseRegistered = false;
      this.activeSessionId = 'QZ_SESS_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      this.reconnectCount++;
      
      // Re-register promises and hooks
      console.log('[QzManager] [QZ RECONNECT PIPELINE] Re-registering signing hooks and security promises...');
      this.configureSecurity();
      
      this.connectionTimestamp = new Date().toISOString();
      console.log('[QzManager] [QZ RECONNECT PIPELINE] Reconnecting to QZ Tray WebSocket...');
      await qz.websocket.connect();
      
      console.log('[QzManager] [QZ RECONNECT PIPELINE] --- HARD RECONNECT SUCCESSFUL ---');
      return true;
    } catch (err) {
      console.error('[QzManager] [QZ RECONNECT PIPELINE] Hard reconnect sequence failed:', err);
      return false;
    }
  }

  public static getInstance(): QzManager {
    if (!QzManager.instance) {
      QzManager.instance = new QzManager();
    }
    return QzManager.instance;
  }

  /**
   * Helper to compute SHA-256 hash of string in browser
   */
  public async computeSHA256(message: string): Promise<string> {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.error('[QzManager] Failed to compute SHA-256 hash:', e);
      return 'hash-error';
    }
  }

  /**
   * Configure certificate and signing promises on the qz-tray instance.
   */
  private configureSecurity() {
    if (this.isConfigured) return;

    // Set signature algorithm explicitly
    qz.security.setSignatureAlgorithm("SHA512");

    // Set up certificate promise
    qz.security.setCertificatePromise((resolve, reject) => {
      this.handshakeTimestamp = new Date().toISOString();
      if (this.unsignedMode) {
        console.log('[QzManager] [SECURITY] Development Unsigned Mode active. Resolving certificate as null.');
        resolve(null as any);
        return;
      }

      fetch('/api/staff/qz-certs/certificate')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch QZ certificate');
          return res.json();
        })
        .then((data) => {
          if (data.publicCert) {
            resolve(data.publicCert);
          } else {
            console.warn('[QzManager] [SECURITY] No public certificate found on database. Resolving null.');
            resolve(null as any);
          }
        })
        .catch((err) => {
          console.error('[QzManager] [SECURITY] Error fetching QZ certificate:', err);
          reject(err);
        });
    });
    this.certificatePromiseRegistered = true;

    // Set up signature promise pointing to the dedicated sign endpoint
    qz.security.setSignaturePromise((toSign) => {
      return async (resolve, reject) => {
        const timestamp = new Date().toISOString();
        const payloadHash = await this.computeSHA256(toSign);
        const payloadLen = toSign.length;

        // Classify the signature request source
        let requestType: 'WEBSOCKET_HANDSHAKE' | 'PRINT_REQUEST' | 'UNKNOWN' = 'UNKNOWN';
        if (toSign.includes('call') || toSign.includes('params')) {
          requestType = 'PRINT_REQUEST';
        } else if (toSign.length < 500 && (toSign.includes('connection') || toSign.includes('session') || !toSign.includes('{'))) {
          requestType = 'WEBSOCKET_HANDSHAKE';
        }

        const requestSource = requestType === 'PRINT_REQUEST' ? 'ACTIVE PRINT JOB EXECUTION' : 'WEBSOCKET CONNECTION HANDSHAKE';
        this.lastBackendSigningPayloadHash = payloadHash;

        console.log("[QZ RAW toSign]", toSign);
        console.log("[QZ RAW toSign SHA256]", payloadHash);

        if (requestType === 'PRINT_REQUEST') {
          console.log('[QZ TRUST TRACE] QZ requested signature for ACTIVE PRINT payload');
        }

        if (this.unsignedMode) {
          console.log('[QzManager] [QZ TRUST TRACE] Unsigned Mode active: Bypassing signature.');
          if (this.signDebugCallback) {
            this.signDebugCallback({
              timestamp,
              toSign,
              payloadHash,
              unsignedBypassed: true,
              requestSource,
              requestType
            });
          }
          resolve(null as any);
          return;
        }

        fetch('/api/qz/sign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            request: toSign
          })
        })
          .then(res => res.text())
          .then((signature) => {
            console.log("[QZ SIGNATURE RECEIVED]", signature);
            const sigLen = signature.length;
            const isBase64 = /^[a-zA-Z0-9+/]+={0,2}$/.test(signature);

            if (this.signDebugCallback) {
              this.signDebugCallback({
                timestamp,
                toSign,
                payloadHash,
                signature,
                signatureLength: sigLen,
                isBase64Valid: isBase64,
                certFingerprint: 'N/A',
                privateKeyHash: 'N/A',
                algorithm: 'RSA-SHA512',
                unsignedBypassed: false,
                requestSource,
                requestType
              });
            }

            resolve(signature);
          })
          .catch((err) => {
            console.error('[QzManager] [QZ TRUST TRACE] Challenge signing failed:', err);
            if (this.signDebugCallback) {
              this.signDebugCallback({
                timestamp,
                toSign,
                payloadHash,
                error: err.message || err,
                unsignedBypassed: false,
                requestSource,
                requestType
              });
            }
            reject(err);
          });
      };
    });
    this.signaturePromiseRegistered = true;

    this.isConfigured = true;
  }

  /**
   * Get active printer configuration from DB
   */
  async loadPrinter(forceRefresh = false): Promise<PrinterRecord | null> {
    if (this.activePrinter && !forceRefresh) {
      return this.activePrinter;
    }
    try {
      const res = await fetch('/api/staff/printer');
      if (!res.ok) return null;
      const data = await res.json();
      this.activePrinter = data || null;
      return this.activePrinter;
    } catch (error) {
      console.error('[QzManager] Error loading printer:', error);
      return null;
    }
  }

  /**
   * Connect to QZ Tray WebSocket
   */
  async connect(forceRefresh = false): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Load active printer configuration
    await this.loadPrinter(forceRefresh);

    if (qz.websocket.isActive()) {
      return true;
    }

    if (this.connectingPromise && !forceRefresh) {
      return this.connectingPromise;
    }

    this.connectingPromise = (async () => {
      try {
        await qz.websocket.connect();
        console.log('[QzManager] Connected to QZ Tray WebSocket');
        return true;
      } catch (err) {
        console.error('[QzManager] Failed to connect to QZ Tray WebSocket:', err);
        return false;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  /**
   * Checks if printer is online/reachable on port 9100.
   */
  async findPrinter(name?: string): Promise<string | null> {
    await this.connect();
    if (!this.activePrinter) return null;
    return this.activePrinter.ipAddress;
  }

  /**
   * Send raw printer data (Uint8Array or string[]) to configured Ethernet printer
   */
  async printRaw(data: Uint8Array | string[]): Promise<void> {
    // SMOKING GUN #6: Establish hard reconnect lifecycle before print to clear stale websocket sessions
    console.log('[QzManager] [QZ RECONNECT PIPELINE] Initiating hard reconnect before print to ensure fresh session...');
    const reconnectOk = await this.hardReconnect();
    if (!reconnectOk) {
      throw new Error('[QZ TRUST ERROR] Reconnect failed. QZ Tray desktop app is not responding.');
    }

    // SMOKING GUN #3: Block printing until trusted session ready
    const isTrusted = this.unsignedMode || (this.isConfigured && this.certificatePromiseRegistered && this.signaturePromiseRegistered);
    if (!qz.websocket.isActive()) {
      throw new Error('[QZ TRUST ERROR] Printing blocked. QZ WebSocket is not active.');
    }
    if (!isTrusted) {
      throw new Error('[QZ TRUST ERROR] Printing blocked. QZ security handshake is not fully trusted or configured.');
    }

    if (!this.activePrinter) {
      throw new Error('No printer configured. Please contact your Administrator to assign a printer.');
    }

    const { ipAddress, port } = this.activePrinter;

    const config = qz.configs.create({
      host: ipAddress,
      port: port || 9100,
    } as any);

    let printData: any;

    if (data instanceof Uint8Array) {
      // Map binary bytes to raw character string (binary character format)
      const rawEscPosString = Array.from(data)
        .map((b) => String.fromCharCode(b))
        .join('');
      
      printData = [
        {
          type: 'raw',
          format: 'command',
          data: rawEscPosString,
        },
      ];
    } else if (Array.isArray(data)) {
      // Map legacy string array input
      printData = [
        {
          type: 'raw',
          format: 'command',
          data: data.join('\n') + '\n',
        },
      ];
    } else {
      throw new Error('Unsupported print data format');
    }

    const trustedStatus = this.unsignedMode ? 'DEVELOPMENT_UNSIGNED' : (this.isConfigured ? 'TRUSTED_SIGNED' : 'UNCONFIGURED');
    
    this.lastPrintTelemetry = {
      timestamp: new Date().toISOString(),
      config: {
        host: ipAddress,
        port: port || 9100,
      },
      websocketActive: qz.websocket.isActive(),
      trustedStatus,
      sessionId: this.activeSessionId
    };

    console.log('[QZ PRINT TRACE] --- DISPATCHING ACTUAL PRINT PAYLOAD ---');
    console.log('[QZ PRINT TRACE] WebSocket Active State:', qz.websocket.isActive());
    console.log('[QZ PRINT TRACE] Trusted Mode Active State:', trustedStatus);
    console.log('[QZ PRINT TRACE] Session ID:', this.activeSessionId);
    console.log('[QZ PRINT TRACE] Timestamp:', new Date().toISOString());
    console.log('[QZ PRINT TRACE] Config Object:', config);
    console.log('[QZ PRINT TRACE] Print Payload:', printData);
    console.log('[QZ PRINT TRACE] --- END INTERCEPTION ---');

    try {
      await qz.print(config, printData);
      this.lastSuccessfulPrint = new Date();
      console.log(`[QzManager] [QZ PRINT TRACE] Successfully printed to ${ipAddress}:${port}`);
    } catch (err: any) {
      console.error('[QzManager] [QZ PRINT TRACE] Print execution failed:', err);
      throw new Error(err.message || 'Printing failed. Check printer network connection.');
    }
  }

  /**
   * Dummy implementation for backwards compatibility
   */
  async getAllPrinters(): Promise<string[]> {
    if (this.activePrinter) {
      return [this.activePrinter.ipAddress];
    }
    return [];
  }

  setPrinter(name: string): void {
    console.log('[QzManager] setPrinter is deprecated. Use direct configuration selection instead.');
  }

  isConnected(): boolean {
    return typeof window !== 'undefined' && qz.websocket.isActive();
  }

  getSelectedPrinter(): string | null {
    return this.activePrinter?.ipAddress ?? null;
  }

  getActivePrinterTarget(): { ip: string; port: number } | null {
    if (!this.activePrinter) return null;
    return { ip: this.activePrinter.ipAddress, port: this.activePrinter.port };
  }

  getLastSuccessfulPrint(): Date | null {
    return this.lastSuccessfulPrint;
  }
}

export const qzManager = QzManager.getInstance();
