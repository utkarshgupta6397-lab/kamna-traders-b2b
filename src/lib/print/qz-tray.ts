'use client';

import * as qz from 'qz-tray';
import { initializeQZSecurity } from '@/lib/printing/security/qz-security';

/**
 * QZ Tray Singleton
 * Manages the lifecycle of the WebSocket connection and printer discovery.
 */
class QZManager {
  private static instance: QZManager;
  private connected: boolean = false;
  private connecting: boolean = false;
  private lastConnectAttempt: number = 0;
  private connectFailCount: number = 0;
  private printerName: string | null = null;
  private securityInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): QZManager {
    if (!QZManager.instance) {
      QZManager.instance = new QZManager();
    }
    return QZManager.instance;
  }

  /**
   * Initializes the connection to QZ Tray.
   * Note: This must be called from the client side.
   */
  public async connect(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    // 1. Cooldown Check: If we failed recently, wait 30s before trying again automatically
    const now = Date.now();
    if (!this.connected && this.connectFailCount > 0 && (now - this.lastConnectAttempt < 30000)) {
      return false;
    }

    try {
      // 2. Check if already active
      if (this.connected && qz.websocket.isActive()) {
        return true;
      }

      // 3. Prevent parallel connection attempts
      if (this.connecting) {
        return this.connected;
      }

      this.lastConnectAttempt = now;
      this.connecting = true;
      
      if (!this.securityInitialized) {
        await initializeQZSecurity();
        this.securityInitialized = true;
      }

      await qz.websocket.connect();
      
      this.connected = true;
      this.connectFailCount = 0;
      return true;
    } catch (err: any) {
      this.connectFailCount++;
      this.connected = false;
      return false;
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Disconnects from QZ Tray.
   */
  public async disconnect(): Promise<void> {
    if (this.connected) {
      await qz.websocket.disconnect();
      this.connected = false;
    }
  }

  /**
   * Finds the target thermal printer.
   * Defaults to POS120 if not specified.
   */
  public async findPrinter(name: string = 'POS120'): Promise<string | null> {
    if (!this.connected) await this.connect();

    console.log(`[QZ] Searching for printer: ${name}`);
    
    try {
      // 1. Try regex match (more robust on macOS)
      // @ts-ignore - QZ Tray supports Regex but types may be outdated
      const printer = await qz.printers.find(/POS120/i);
      const selected = Array.isArray(printer) ? printer[0] : (printer as string);
      console.log(`[QZ] Regex match found: ${selected}`);
      this.printerName = selected;
      return selected;
    } catch (err) {
      console.warn(`[QZ] Regex search for "POS120" failed. Trying broad search...`);
      
      try {
        // 2. Try broad search (contains 'POS')
        const posPrinters = await qz.printers.find('POS');
        const selected = Array.isArray(posPrinters) ? posPrinters[0] : (posPrinters as string);
        
        if (selected) {
          console.log(`[QZ] Found broad match: ${selected}`);
          this.printerName = selected;
          return selected;
        }
        
        // 3. Fallback to default
        const defaultPrinter = await qz.printers.getDefault();
        console.log(`[QZ] Falling back to default printer: ${defaultPrinter}`);
        this.printerName = defaultPrinter;
        return defaultPrinter;
      } catch (e) {
        console.error('[QZ] Discovery failed completely. System printers check recommended.');
        return null;
      }
    }
  }

  /**
   * Returns a list of all available system printers.
   */
  public async getAllPrinters(): Promise<string[]> {
    if (!this.connected) await this.connect();
    try {
      const printers = await qz.printers.find();
      return Array.isArray(printers) ? printers : [printers as string];
    } catch (err) {
      console.error('[QZ] Failed to fetch printers', err);
      return [];
    }
  }

  /**
   * Manually sets the active printer name.
   */
  public setPrinter(name: string) {
    this.printerName = name;
  }

  /**
   * Prints raw binary data (ESC/POS) to the printer.
   */
  public async printRaw(data: Uint8Array | string[]): Promise<void> {
    if (!this.connected) await this.connect();
    if (!this.printerName) await this.findPrinter();

    if (!this.printerName) {
      throw new Error('No printer selected');
    }

    const config = qz.configs.create(this.printerName);
    
    // QZ Tray 'raw' mode bypasses drivers for native ESC/POS
    // For binary data, hex encoding is the most robust across different QZ Tray versions
    let finalData: any = data;
    let flavor: any = undefined;

    if (data instanceof Uint8Array) {
      finalData = Array.from(data)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      flavor = 'hex';
    }

    await qz.print(config, [
      {
        type: 'raw',
        format: 'command',
        flavor: flavor,
        data: finalData
      }
    ]);
  }

  public isConnected(): boolean {
    return this.connected && qz.websocket.isActive();
  }

  public getSelectedPrinter(): string | null {
    return this.printerName;
  }
}

export const qzManager = QZManager.getInstance();
