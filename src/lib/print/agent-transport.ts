/**
 * agent-transport.ts
 * Reusable transport layer for the warehouse-print-agent (localhost:3001).
 * Replaces QZ Tray WebSocket transport. ESC/POS generation is untouched.
 *
 * All functions are safe to call from client components.
 */

const AGENT_BASE = 'http://localhost:3001';
const AGENT_TIMEOUT_MS = 6000;

// ── Diagnostics Telemetry ──────────────────────────────────────────────────────
export const DEV_DEBUG = true;

export interface DiagnosticLog {
  timestamp: Date;
  method: string;
  url: string;
  status: string;
  latencyMs: number;
  error?: string;
  raw?: unknown;
}

type LogListener = (log: DiagnosticLog) => void;
const logListeners = new Set<LogListener>();

export function subscribeToLogs(listener: LogListener) {
  logListeners.add(listener);
  return () => logListeners.delete(listener);
}

function emitLog(log: DiagnosticLog) {
  if (DEV_DEBUG) {
    logListeners.forEach(fn => fn(log));
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit, ms = AGENT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const start = performance.now();
  
  // Explicitly prevent rogue credentials
  const safeOptions: RequestInit = {
    ...options,
    mode: 'cors',
    credentials: 'omit',
    signal: controller.signal
  };

  try {
    const res = await fetch(url, safeOptions);
    const latencyMs = Math.round(performance.now() - start);
    
    emitLog({
      timestamp: new Date(),
      method: options.method || 'GET',
      url,
      status: res.status.toString(),
      latencyMs
    });
    
    return res;
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const errorMsg = err instanceof Error ? err.message : String(err);
    
    emitLog({
      timestamp: new Date(),
      method: options.method || 'GET',
      url,
      status: 'FAILED',
      latencyMs,
      error: errorMsg,
      raw: err
    });
    
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convert any ESC/POS payload the existing system produces into a Base64 string
 * suitable for the agent's POST /print endpoint.
 *
 * Handles both:
 *   - Uint8Array   (from EscPosRenderer.build())
 *   - string[]     (legacy QZ Tray raw command arrays)
 */
export function toBase64(data: Uint8Array | string[]): string {
  let buf: Buffer;

  if (data instanceof Uint8Array) {
    buf = Buffer.from(data);
  } else {
    // string[] — each element may contain ESC/POS control characters
    const combined = data.join('');
    buf = Buffer.from(combined, 'binary');
  }

  return buf.toString('base64');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check if the local print agent is reachable.
 * Returns true if the agent responds to GET /health.
 */
export async function checkAgentHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${AGENT_BASE}/health`,
      { method: 'GET', headers: { 'Accept': 'application/json' } },
      3000
    );
    if (!res.ok) return false;
    const json = await res.json();
    return json?.ok === true;
  } catch {
    return false;
  }
}

/**
 * Commands the local print agent to safely shutdown.
 */
export async function shutdownAgent(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${AGENT_BASE}/shutdown`, { method: 'POST' }, 2000);
    return res.ok;
  } catch {
    return false;
  }
}

export interface AgentPrinterTarget {
  ip: string;
  port: number;
}

export interface PrinterConnectivityStatus {
  status: 'online' | 'unstable' | 'offline';
  latencyMs: number;
  lastCheck: Date;
  ip: string;
}

/**
 * Perform a deep diagnostic probe of a printer's TCP connection via the local agent.
 * Sends multiple rapid checks to calculate stability and latency.
 */
export async function probePrinterConnection(printer: AgentPrinterTarget): Promise<PrinterConnectivityStatus> {
  let successes = 0;
  let totalLatency = 0;
  const checks = 2; // 2 rapid checks to prevent UI hanging too long
  
  for (let i = 0; i < checks; i++) {
    const start = performance.now();
    try {
      const res = await fetchWithTimeout(
        `${AGENT_BASE}/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: printer.ip, port: printer.port }),
        },
        2000 // strict 2-second timeout per probe
      );
      if (res.ok) {
        const json = await res.json();
        if (json?.connected) {
          successes++;
          totalLatency += (performance.now() - start);
        }
      }
    } catch {
      // Offline or timeout
    }
    
    if (i < checks - 1 && successes > 0) {
      await new Promise(r => setTimeout(r, 200)); // slight backoff between checks
    }
  }

  const avgLatency = successes > 0 ? totalLatency / successes : 0;
  
  let status: 'online' | 'unstable' | 'offline' = 'offline';
  if (successes === checks && avgLatency < 1000) {
    status = 'online';
  } else if (successes > 0) {
    status = 'unstable';
  }

  return {
    status,
    latencyMs: Math.round(avgLatency),
    lastCheck: new Date(),
    ip: printer.ip
  };
}

/**
 * Simple check for printer status.
 */
export async function checkPrinterStatus(printer: AgentPrinterTarget): Promise<boolean> {
  const probe = await probePrinterConnection(printer);
  return probe.status !== 'offline';
}

export interface AgentPrintResult {
  success: boolean;
  error?: string;
}

/**
 * Send ESC/POS bytes to a network printer via the local agent.
 * data — the raw ESC/POS Uint8Array or string[] produced by existing renderers.
 */
export async function printViaAgent(
  printer: AgentPrinterTarget,
  data: Uint8Array | string[]
): Promise<AgentPrintResult> {
  const content = toBase64(data);

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${AGENT_BASE}/print`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer: { ip: printer.ip, port: printer.port }, content }),
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout');
    const isNetwork = msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch');
    
    let preciseError = 'Unable To Reach Print Service';
    if (isTimeout) preciseError = 'Timeout reaching Print Service';
    else if (isNetwork) preciseError = 'Browser Blocked Localhost OR Service Not Running';

    return {
      success: false,
      error: preciseError,
    };
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    const backendError = json?.error || 'Printing Failed';
    let preciseError = backendError;
    if (backendError.includes('ETIMEDOUT')) preciseError = 'Printer Offline (TCP Timeout)';
    else if (backendError.includes('EHOSTUNREACH')) preciseError = 'Printer IP Unreachable';
    else if (backendError.includes('ECONNREFUSED')) preciseError = 'Printer Connection Refused';
    
    return { success: false, error: preciseError };
  }

  return { success: true };
}
