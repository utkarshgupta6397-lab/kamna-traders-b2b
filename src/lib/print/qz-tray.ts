/**
 * qz-tray.ts  (Phase 3 — Agent Transport Replacement)
 *
 * Exports the same `qzManager` singleton used throughout the app.
 * Internals are now backed by the warehouse-print-agent (localhost:3001)
 * instead of the QZ Tray WebSocket.
 *
 * ESC/POS rendering is NOT changed. Only the transport layer is replaced.
 */

import { checkAgentHealth, checkPrinterStatus, printViaAgent, AgentPrinterTarget } from './agent-transport';

// ── Printer source ──────────────────────────────────────────────────────────
// Loaded once per session from /api/printers (DB). Avoids hardcoding.

interface PrinterRecord {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
}

async function fetchFirstEnabledPrinter(): Promise<PrinterRecord | null> {
  try {
    const res = await fetch('/api/printers', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    const list: PrinterRecord[] = data?.printers ?? [];
    return list[0] ?? null;
  } catch {
    return null;
  }
}

// ── Manager ─────────────────────────────────────────────────────────────────

class PrintAgentManager {
  private static instance: PrintAgentManager;

  /** true after a successful agent health check */
  private agentOnline = false;

  /** Loaded from DB on first connect() */
  private activePrinter: PrinterRecord | null = null;

  /** Track last successful print timestamp */
  private lastSuccessfulPrint: Date | null = null;

  /** De-duplicate concurrent connect() calls */
  private connectingPromise: Promise<boolean> | null = null;

  private constructor() {}

  public static getInstance(): PrintAgentManager {
    if (!PrintAgentManager.instance) {
      PrintAgentManager.instance = new PrintAgentManager();
    }
    return PrintAgentManager.instance;
  }

  /**
   * Check agent liveness + load printer from DB.
   * Mirrors QZManager.connect() — safe to call multiple times.
   * @param forceRefresh - If true, bypasses the cached printer IP and forces a DB lookup
   */
  async connect(forceRefresh = false): Promise<boolean> {
    if (this.agentOnline && this.activePrinter && !forceRefresh) return true;
    if (this.connectingPromise && !forceRefresh) return this.connectingPromise;

    this.connectingPromise = (async () => {
      try {
        const healthy = await checkAgentHealth();
        if (!healthy) {
          console.warn('[PrintAgent] Local print agent not reachable at localhost:3001');
          this.agentOnline = false;
          return false;
        }

        this.agentOnline = true;
        console.log('[PrintAgent] Agent reachable');

        // Load printer from DB if not already set, or if forced
        if (!this.activePrinter || forceRefresh) {
          const printer = await fetchFirstEnabledPrinter();
          if (printer) {
            this.activePrinter = printer;
            console.log(`[PrintAgent] Active printer: ${printer.name} (${printer.ipAddress}:${printer.port})`);
          } else {
            console.warn('[PrintAgent] No enabled printers found in DB');
          }
        }

        return this.agentOnline && !!this.activePrinter;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  /**
   * Returns the active printer name, or null.
   * Mirrors QZManager.findPrinter() — call sites unchanged.
   */
  async findPrinter(name?: string): Promise<string | null> {
    await this.connect();
    if (!this.activePrinter) return null;

    // If a specific name was requested, check it matches (informational only)
    if (name && name !== this.activePrinter.name) {
      console.warn(`[PrintAgent] Requested printer "${name}" but active is "${this.activePrinter.name}"`);
    }

    // Probe TCP connectivity
    const online = await checkPrinterStatus({
      ip: this.activePrinter.ipAddress,
      port: this.activePrinter.port,
    });

    if (!online) {
      console.warn(`[PrintAgent] Printer ${this.activePrinter.name} is offline`);
      return null;
    }

    return this.activePrinter.name;
  }

  /**
   * List available printers — returns array of name strings.
   * Mirrors QZManager.getAllPrinters().
   */
  async getAllPrinters(): Promise<string[]> {
    try {
      const res = await fetch('/api/printers', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      const list: PrinterRecord[] = data?.printers ?? [];
      return list.map((p) => p.name);
    } catch {
      return [];
    }
  }

  /**
   * Send ESC/POS data to the active printer via the local agent.
   * Accepts both Uint8Array (from EscPosRenderer) and string[] (legacy).
   * Mirrors QZManager.printRaw() — call sites unchanged.
   */
  async printRaw(data: Uint8Array | string[]): Promise<void> {
    const ready = await this.connect();

    if (!this.agentOnline) {
      throw new Error('Local Print Service Not Running — start warehouse-print-agent on this machine');
    }
    if (!this.activePrinter) {
      throw new Error('Printer Offline — no enabled printer found in Printer Management');
    }
    if (!ready) {
      throw new Error('Printer Offline — unable to reach printer');
    }

    const target: AgentPrinterTarget = {
      ip: this.activePrinter.ipAddress,
      port: this.activePrinter.port,
    };

    console.log(`[PrintAgent] Sending job to ${target.ip}:${target.port}`);
    const result = await printViaAgent(target, data);

    if (!result.success) {
      throw new Error(result.error ?? 'Printing Failed');
    }

    this.lastSuccessfulPrint = new Date();
    console.log('[PrintAgent] ✓ Print job sent successfully');
  }

  /**
   * Override the active printer by name.
   * Looks up the printer record from DB. Mirrors QZManager.setPrinter().
   */
  setPrinter(name: string): void {
    // Optimistic local set — name only; next printRaw will re-validate
    if (this.activePrinter) {
      this.activePrinter = { ...this.activePrinter, name };
    }
    console.log(`[PrintAgent] Printer target set to: ${name}`);
  }

  /** Returns true if agent was successfully contacted. Mirrors QZManager.isConnected(). */
  isConnected(): boolean {
    return this.agentOnline;
  }

  /** Returns the active printer name, or null. Mirrors QZManager.getSelectedPrinter(). */
  getSelectedPrinter(): string | null {
    return this.activePrinter?.name ?? null;
  }

  /** Returns the active printer's IP:port for display purposes. */
  getActivePrinterTarget(): AgentPrinterTarget | null {
    if (!this.activePrinter) return null;
    return { ip: this.activePrinter.ipAddress, port: this.activePrinter.port };
  }

  /** Returns the last successful print timestamp */
  getLastSuccessfulPrint(): Date | null {
    return this.lastSuccessfulPrint;
  }
}

export const qzManager = PrintAgentManager.getInstance();
