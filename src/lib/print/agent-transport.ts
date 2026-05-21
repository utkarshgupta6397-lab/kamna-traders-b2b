/**
 * agent-transport.ts
 * Reusable transport layer for the warehouse-print-agent (localhost:3001).
 * Replaces QZ Tray WebSocket transport. ESC/POS generation is untouched.
 *
 * All functions are safe to call from client components.
 */

const AGENT_BASE = 'http://127.0.0.1:3001';
const AGENT_TIMEOUT_MS = 6000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, options: RequestInit, ms = AGENT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
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

export interface AgentPrinterTarget {
  ip: string;
  port: number;
}

/**
 * Probe a printer's TCP availability via the local agent.
 * Returns true if the printer is reachable.
 */
export async function checkPrinterStatus(printer: AgentPrinterTarget): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${AGENT_BASE}/status`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: printer.ip, port: printer.port }),
      },
      4000
    );
    if (!res.ok) return false;
    const json = await res.json();
    return json?.connected === true;
  } catch {
    return false;
  }
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
    return {
      success: false,
      error: isTimeout ? 'Local Print Service Not Running' : 'Unable To Reach Print Service',
    };
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.success) {
    return { success: false, error: json?.error || 'Printing Failed' };
  }

  return { success: true };
}
