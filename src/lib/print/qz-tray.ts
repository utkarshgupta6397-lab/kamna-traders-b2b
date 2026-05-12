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

  async connect() {
    if (this.connection && qz.websocket.isActive()) return true;
    if (this.connectingPromise) return this.connectingPromise;
    
    this.connectingPromise = (async () => {
      try {
        console.log('[QZ] Connecting to WebSocket...');
        // Safety timeout: 5s max for connection attempt
        await Promise.race([
          qz.websocket.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('QZ Connection Timeout')), 5000))
        ]);
        
        this.connection = true;
        return true;
      } catch (err) {
        console.warn('[QZ] Connection failed:', err);
        this.connection = false;
        return false;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  async findPrinter(name: string = 'POS120'): Promise<string | null> {
    try {
      if (!this.connection) await this.connect();
      const printer = await qz.printers.find(name);
      this.printer = printer;
      return printer;
    } catch (err) {
      console.error('[QZ] Printer search failed:', err);
      return null;
    }
  }

  async getAllPrinters(): Promise<string[]> {
    try {
      if (!this.connection) await this.connect();
      return await qz.printers.find();
    } catch (err) {
      console.error('[QZ] Failed to fetch printers:', err);
      return [];
    }
  }

  async printRaw(data: Uint8Array | string[]) {
    try {
      if (!this.connection) await this.connect();
      if (!this.printer) await this.findPrinter();
      
      const config = qz.configs.create(this.printer || 'POS120');
      
      // CRITICAL DIAGNOSTICS
      console.log('[QZ_DEBUG]', {
        type: data instanceof Uint8Array ? 'Uint8Array' : 'string[]',
        length: data.length,
        firstBytes: data instanceof Uint8Array ? Array.from(data.slice(0, 10)) : data.slice(0, 2),
        printer: this.printer
      });

      let payload: any[];
      if (data instanceof Uint8Array) {
        // Convert binary data to Base64 to ensure proper transmission over WebSocket
        // and correct interpretation by QZ Tray as raw commands.
        const binary = data.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
        const base64 = btoa(binary);
        
        payload = [{
          type: 'raw',
          format: 'command',
          flavor: 'base64',
          data: base64
        }];
      } else {
        // If it's already an array of strings/commands, pass as is
        payload = data;
      }
      
      await qz.print(config, payload);
    } catch (err) {
      console.error('[QZ] Printing failed:', err);
      throw err;
    }
  }

  isConnected() {
    return this.connection && qz.websocket.isActive();
  }

  getSelectedPrinter() {
    return this.printer;
  }
}

export const qzManager = QZManager.getInstance();
