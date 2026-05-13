import qz from 'qz-tray';
import { initializeQZSecurity } from '@/lib/printing/security/qz-security';

/**
 * QZ Tray Singleton
 * Manages WebSocket lifecycle and silent printing capabilities.
 */
class QZManager {
  private static instance: QZManager;
  private connection: boolean = false;
  private printer: string | null = null;

  private constructor() {
    // Only initialize security certificates once
    if (typeof window !== 'undefined') {
      initializeQZSecurity();
    }
  }

  public static getInstance(): QZManager {
    if (!QZManager.instance) {
      QZManager.instance = new QZManager();
    }
    return QZManager.instance;
  }

  private connectingPromise: Promise<boolean> | null = null;

  /**
   * Established a connection to the local QZ Tray application.
   */
  async connect(): Promise<boolean> {
    // If already active, return immediately
    try {
      if (qz.websocket.isActive()) {
        this.connection = true;
        return true;
      }
    } catch (e) {
      // If isActive() itself fails (internal QZ bug), force a reset
      this.connection = false;
    }

    if (this.connectingPromise) return this.connectingPromise;
    
    this.connectingPromise = (async () => {
      try {
        console.log('[QZ] Connecting to WebSocket...');
        
        // Ensure security is initialized
        if (typeof window !== 'undefined') {
          initializeQZSecurity();
        }

        // Safety timeout: 5s max for connection attempt
        await Promise.race([
          qz.websocket.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('QZ Connection Timeout')), 5000))
        ]);
        
        console.log('[QZ] Connection established successfully.');
        this.connection = true;

        // Auto-load printer from storage if not set
        if (!this.printer) {
          const { getQZConfig } = await import('@/lib/print/qz-storage');
          const config = await getQZConfig();
          if (config?.printerName) {
            this.printer = config.printerName;
          }
        }

        return true;
      } catch (err) {
        console.warn('[QZ] Connection failed. Is QZ Tray application running?');
        this.connection = false;
        return false;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  /**
   * Gracefully finds a printer. NEVER throws TypeErrors.
   */
  async findPrinter(name?: string): Promise<string | null> {
    try {
      const isConnected = await this.connect();
      if (!isConnected || !qz.websocket.isActive()) {
        return null;
      }
      
      const targetName = name || this.printer || 'POS120';
      console.log(`[QZ] Finding printer: ${targetName}`);
      
      // INTERNAL QZ CALL: Wrap in catch to handle "sendData is not a function" zombie states
      const printer = await qz.printers.find(targetName).catch(() => null);
      
      const selected = Array.isArray(printer) ? (printer[0] || null) : (printer || null);
      this.printer = selected;
      return selected;
    } catch (err) {
      console.warn('[QZ] Graceful failure in findPrinter:', err);
      return null;
    }
  }

  async getAllPrinters(): Promise<string[]> {
    try {
      const isConnected = await this.connect();
      if (!isConnected || !qz.websocket.isActive()) return [];

      const list = await qz.printers.find().catch(() => []);
      return Array.isArray(list) ? list : (list ? [list] : []);
    } catch (err) {
      return [];
    }
  }

  async printRaw(data: Uint8Array | string[]) {
    const isConnected = await this.connect();
    
    // If we think we are connected but the library is in a zombie state, 
    // qz.websocket.isActive() might lie or the internal connection might be null.
    if (!isConnected || !qz.websocket.isActive()) {
      throw new Error('QZ Tray is not running. Please start the application and try again.');
    }

    try {
      if (!this.printer) {
        const found = await this.findPrinter();
        if (!found) throw new Error(`Target printer not found. Please check your printer connection.`);
      }
      
      const config = qz.configs.create(this.printer!);
      
      let payload: any[];
      if (data instanceof Uint8Array) {
        const binary = data.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
        const base64 = btoa(binary);
        payload = [{ type: 'raw', format: 'command', flavor: 'base64', data: base64 }];
      } else {
        payload = data;
      }
      
      // Attempt print, catch internal zombie state errors
      await qz.print(config, payload).catch((err: any) => {
        if (err?.message?.includes('sendData')) {
          this.connection = false; // Mark as disconnected to force retry next time
          throw new Error('Printer connection lost. Please ensure QZ Tray is running.');
        }
        throw err;
      });
    } catch (err: any) {
      console.error('[QZ] Printing failed:', err);
      throw err;
    }
  }

  setPrinter(name: string) {
    this.printer = name;
  }

  isConnected() {
    try {
      return qz.websocket.isActive();
    } catch (e) {
      return false;
    }
  }

  getSelectedPrinter() {
    return this.printer;
  }
}

export const qzManager = QZManager.getInstance();
