import fs from 'fs';
import path from 'path';

export type DevLogStatus = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface DevLogEntry {
  id: string;
  timestamp: string;
  module: string;
  runId: string;
  event: string;
  status: DevLogStatus;
  input?: any;
  output?: any;
  error?: string;
}

export interface DevLogRun {
  runId: string;
  module: string;
  timestamp: string;
  entries: DevLogEntry[];
}

const MAX_RUNS = 50;
const LOG_FILE_PATH = path.join(process.cwd(), '.dev_logs.json');

function readLogs(): DevLogEntry[] {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      const data = fs.readFileSync(LOG_FILE_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to read dev logs from file:', e);
  }
  return [];
}

function writeLogs(logs: DevLogEntry[]) {
  try {
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write dev logs to file:', e);
  }
}

function maskSensitiveData(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    // Mask tokens if we spot them (e.g., Zoho-oauthtoken...)
    if (obj.includes('Zoho-oauthtoken')) {
      return obj.replace(/Zoho-oauthtoken [a-zA-Z0-9.-_]+/, 'Zoho-oauthtoken ***MASKED***');
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveData);
  }

  if (typeof obj === 'object') {
    const masked: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('client_id')
      ) {
        masked[key] = '***MASKED***';
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }
  return obj;
}

export class DevLogger {
  static log(params: Omit<DevLogEntry, 'id' | 'timestamp'>) {
    if (process.env.NODE_ENV === 'production') return;

    const entry: DevLogEntry = {
      ...params,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      input: maskSensitiveData(params.input),
      output: maskSensitiveData(params.output),
    };

    let devLogs = readLogs();
    devLogs.push(entry);

    // Prune logic: Group by runId and keep only MAX_RUNS
    const runIds = Array.from(new Set(devLogs.map(l => l.runId)));
    if (runIds.length > MAX_RUNS) {
      const runIdsToKeep = new Set(runIds.slice(-MAX_RUNS));
      devLogs = devLogs.filter(l => runIdsToKeep.has(l.runId));
    }
    
    writeLogs(devLogs);
  }

  static getRuns(): DevLogRun[] {
    if (process.env.NODE_ENV === 'production') return [];

    const devLogs = readLogs();
    const runsMap = new Map<string, DevLogEntry[]>();
    for (const log of devLogs) {
      if (!runsMap.has(log.runId)) {
        runsMap.set(log.runId, []);
      }
      runsMap.get(log.runId)!.push(log);
    }

    const runs: DevLogRun[] = Array.from(runsMap.entries()).map(([runId, entries]) => ({
      runId,
      module: entries[0].module,
      timestamp: entries[0].timestamp,
      entries
    }));

    // Sort newest first based on run start timestamp
    return runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  static clearLogs() {
    writeLogs([]);
  }
}
