"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Activity, X, Trash2, Download, AlertTriangle, Copy, CheckCircle2 } from "lucide-react";

interface TelemetryCall {
  id: string;
  time: string;
  method: string;
  endpoint: string;
  durationMs: number;
  status: number;
  source: "LOCAL" | "ZOHO";
  page: string;
}

export default function TelemetryOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [calls, setCalls] = useState<TelemetryCall[]>([]);
  const [pageLoadTime, setPageLoadTime] = useState<number>(0);
  const [filter, setFilter] = useState<"ALL" | "LOCAL" | "ZOHO" | "SLOW" | "ERROR">("ALL");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const pathname = usePathname() || "Unknown Page";
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const callsRef = useRef<TelemetryCall[]>([]);
  callsRef.current = calls;

  // Track page load time
  useEffect(() => {
    if (typeof window !== "undefined") {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "navigation") {
            setPageLoadTime(Math.round(entry.duration));
          }
        }
      });
      observer.observe({ type: "navigation", buffered: true });
      return () => observer.disconnect();
    }
  }, [pathname]);

  const fetchZohoCalls = useCallback(async () => {
    try {
      // Don't trace this fetch
      const res = await window.__originalFetch("/api/dev/telemetry");
      if (res.ok) {
        const data = await res.json();
        if (data.calls && data.calls.length > 0) {
          const newCalls = data.calls.map((c: any) => ({
            ...c,
            id: Math.random().toString(36).substr(2, 9),
            page: pathnameRef.current,
          }));
          setCalls((prev) => [...prev, ...newCalls]);
        }
      }
    } catch (e) {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_ENABLE_API_TELEMETRY !== "true") {
      return;
    }

    if (!(window as any).__originalFetch) {
      (window as any).__originalFetch = window.fetch;
      
      window.fetch = async (...args) => {
        let urlStr = "";
        if (typeof args[0] === "string") urlStr = args[0];
        else if (args[0] && "url" in (args[0] as any)) urlStr = (args[0] as any).url;
        else if (args[0] && typeof args[0].toString === "function") urlStr = args[0].toString();
        
        // Ignore telemetry endpoint
        if (urlStr.includes("/api/dev/telemetry") || urlStr.includes("_next")) {
          return (window as any).__originalFetch(...args);
        }

        let method = "GET";
        if (args[1] && args[1].method) method = args[1].method.toUpperCase();
        else if (args[0] instanceof Request && args[0].method) method = args[0].method.toUpperCase();

        const start = performance.now();
        let status = 0;
        
        try {
          const res = await (window as any).__originalFetch(...args);
          status = res.status;
          return res;
        } catch (error) {
          status = 500;
          throw error;
        } finally {
          const durationMs = Math.round(performance.now() - start);
          const newCall: TelemetryCall = {
            id: Math.random().toString(36).substr(2, 9),
            time: new Date().toISOString(),
            method,
            endpoint: urlStr.replace(window.location.origin, ""),
            durationMs,
            status,
            source: "LOCAL",
            page: pathnameRef.current,
          };
          
          setCalls((prev) => [...prev, newCall]);
          
          // Poll zoho calls after a local API call finishes
          setTimeout(fetchZohoCalls, 100);
        }
      };
    }
  }, [fetchZohoCalls]);

  const clearSession = () => setCalls([]);

  const exportData = (type: "JSON" | "CSV") => {
    if (type === "JSON") {
      const blob = new Blob([JSON.stringify(calls, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `telemetry_${Date.now()}.json`;
      a.click();
    } else {
      const headers = ["Time,Method,Endpoint,Source,Duration,Status,Page"];
      const rows = calls.map((c) => 
        `${new Date(c.time).toLocaleTimeString()},${c.method},"${c.endpoint}",${c.source},${c.durationMs},${c.status},"${c.page}"`
      );
      const blob = new Blob([[...headers, ...rows].join("\\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `telemetry_${Date.now()}.csv`;
      a.click();
    }
  };

  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      if (filter === "LOCAL") return c.source === "LOCAL";
      if (filter === "ZOHO") return c.source === "ZOHO";
      if (filter === "SLOW") return c.durationMs > 500;
      if (filter === "ERROR") return c.status >= 400;
      return true;
    });
  }, [calls, filter]);

  // Duplicate detection logic
  const duplicateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    calls.forEach(c => {
      const key = `${c.method}:${c.endpoint}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [calls]);

  const totalTimeLocal = calls.filter(c => c.source === "LOCAL").reduce((sum, c) => sum + c.durationMs, 0);
  const totalTimeZoho = calls.filter(c => c.source === "ZOHO").reduce((sum, c) => sum + c.durationMs, 0);

  const topEndpoints = useMemo(() => {
    const stats: Record<string, { count: number; totalTime: number }> = {};
    calls.forEach(c => {
      const key = c.endpoint;
      if (!stats[key]) stats[key] = { count: 0, totalTime: 0 };
      stats[key].count += 1;
      stats[key].totalTime += c.durationMs;
    });
    return Object.entries(stats)
      .map(([endpoint, data]) => ({
        endpoint,
        count: data.count,
        avg: Math.round(data.totalTime / data.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [calls]);

  const slowestCall = useMemo(() => [...calls].sort((a, b) => b.durationMs - a.durationMs)[0], [calls]);

  const uniqueEndpoints = Object.keys(duplicateCounts).length;
  const duplicateCalls = calls.length - uniqueEndpoints;
  const slowCalls = calls.filter(c => c.durationMs > 500).length;
  const errors = calls.filter(c => c.status >= 400).length;
  
  const score = Math.max(0, 100 - (duplicateCalls * 2) - (slowCalls * 5) - (errors * 10));

  const copySummary = () => {
    const text = `---
Purchase Receive Dashboard
URL:
${pathname}
Page Load Time:
${pageLoadTime > 0 ? (pageLoadTime / 1000).toFixed(2) : "0"} sec
Total Calls:
${calls.length}
Local Calls:
${calls.filter(c => c.source === "LOCAL").length}
Zoho Calls:
${calls.filter(c => c.source === "ZOHO").length}
Unique Endpoints:
${uniqueEndpoints}
Duplicate Calls:
${duplicateCalls}
Slow Calls:
${slowCalls}

Top Endpoints:
${topEndpoints.map(e => `${e.endpoint} (${e.count})`).join("\n\n")}
---`;
    navigator.clipboard.writeText(text);
    showToast("Summary copied");
  };

  const copyAIReport = () => {
    const localCalls = calls.filter(c => c.source === "LOCAL").length;
    const zohoCalls = calls.filter(c => c.source === "ZOHO").length;

    let text = `=================================================
KAMNA B2B API TELEMETRY REPORT
=================================================
Page Name:
Purchase Receive Dashboard
URL:
${pathname}
Browser:
${window.navigator.userAgent}
Screen Width:
${window.innerWidth}
Screen Height:
${window.innerHeight}
Timestamp:
${new Date().toLocaleString("en-GB").replace(",", "")}

---
SUMMARY
---
Page Load Time:
${pageLoadTime > 0 ? (pageLoadTime / 1000).toFixed(2) : "0"} sec
Total API Calls:
${calls.length}
Local API Calls:
${localCalls}
Zoho API Calls:
${zohoCalls}
Unique Endpoints:
${uniqueEndpoints}
Duplicate Calls:
${duplicateCalls}
Slow Calls (>500ms):
${slowCalls}
Errors:
${errors}

---
TOP ENDPOINTS
---
${topEndpoints.map(e => `${e.endpoint}\nCount: ${e.count}\nAverage Duration: ${e.avg}ms\nDuplicate: ${e.count > 1 ? "YES" : "NO"}`).join("\n\n")}

---
SLOWEST ENDPOINT
---
${slowestCall ? `${slowestCall.method} ${slowestCall.endpoint}\n${slowestCall.durationMs}ms` : "None"}

---
DUPLICATE CALL ANALYSIS
---
${topEndpoints.filter(e => e.count > 1).map(e => `${e.endpoint}\n${e.count} calls\nPotential duplicate count:\n${e.count - 1}`).join("\n\n")}
`;

    if (zohoCalls > 0) {
      const zohoStats: Record<string, { count: number; totalTime: number }> = {};
      calls.filter(c => c.source === "ZOHO").forEach(c => {
        if (!zohoStats[c.endpoint]) zohoStats[c.endpoint] = { count: 0, totalTime: 0 };
        zohoStats[c.endpoint].count += 1;
        zohoStats[c.endpoint].totalTime += c.durationMs;
      });
      text += `\n---
ZOHO USAGE
---
${Object.entries(zohoStats).map(([ep, stat]) => `${ep}\nCount: ${stat.count}\nAverage Duration: ${Math.round(stat.totalTime / stat.count)}`).join("\n\n")}
`;
    }

    text += `\n---
FULL REQUEST LOG
---
${calls.map(c => `${new Date(c.time).toLocaleTimeString()}\n${c.method}\n${c.endpoint}\n${c.durationMs}ms\nHTTP ${c.status}`).join("\n\n")}

---
AI ANALYSIS TASK
---
Analyze this telemetry and identify:
1. Duplicate API calls
2. Unnecessary refetches
3. React re-render issues
4. Missing caching opportunities
5. API consolidation opportunities
6. Zoho optimization opportunities
7. Performance bottlenecks
8. Suggested fixes ranked by impact

Please provide:
* Findings
* Root causes
* Recommended fixes
* Expected impact
=================================================`;
    navigator.clipboard.writeText(text);
    showToast("AI Report copied");
  };

  const copyRawJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(calls, null, 2));
    showToast("Raw telemetry copied");
  };

  if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_ENABLE_API_TELEMETRY !== "true") {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-indigo-900 text-white px-4 py-2 rounded-full shadow-lg hover:bg-indigo-800 transition-colors font-mono text-sm"
      >
        <Activity size={16} />
        {calls.length}
      </button>

      {isOpen && (
        <div className="fixed inset-y-0 right-0 w-[450px] bg-slate-50 shadow-2xl border-l border-slate-200 z-[60] flex flex-col font-sans overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-indigo-900 text-white">
            <div className="flex items-center gap-2 font-semibold">
              <Activity size={18} /> API TELEMETRY
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-800 p-1 rounded">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm text-slate-800">
            {/* Summary */}
            <div className="bg-white rounded border border-slate-200 p-3 shadow-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Page:</span>
                <span className="font-mono text-xs truncate max-w-[200px]">{pathname}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Page Load Time:</span>
                <span className="font-mono">{pageLoadTime > 0 ? `${(pageLoadTime / 1000).toFixed(2)} sec` : "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-100 text-center">
                <div>
                  <div className="text-xl font-bold">{calls.length}</div>
                  <div className="text-[10px] uppercase text-slate-500">Total</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-blue-600">{calls.filter(c => c.source === "LOCAL").length}</div>
                  <div className="text-[10px] uppercase text-slate-500">Local</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-emerald-600">{calls.filter(c => c.source === "ZOHO").length}</div>
                  <div className="text-[10px] uppercase text-slate-500">Zoho</div>
                </div>
              </div>
            </div>

            {/* Timing */}
            <div className="bg-white rounded border border-slate-200 p-3 shadow-sm space-y-2">
               <div className="font-semibold text-xs uppercase text-slate-500 mb-2">Total Time</div>
               <div className="flex justify-between font-mono text-sm">
                 <span>Local:</span> <span>{(totalTimeLocal / 1000).toFixed(2)} sec</span>
               </div>
               <div className="flex justify-between font-mono text-sm">
                 <span>Zoho:</span> <span>{(totalTimeZoho / 1000).toFixed(2)} sec</span>
               </div>
               {slowestCall && (
                 <div className="pt-2 mt-2 border-t border-slate-100">
                   <div className="text-xs text-slate-500">Slowest Endpoint:</div>
                   <div className="font-mono text-xs truncate text-red-600">{slowestCall.endpoint}</div>
                   <div className="font-mono text-xs text-red-600">{slowestCall.durationMs}ms</div>
                 </div>
               )}
            </div>

            {/* Top Endpoints */}
            <div className="bg-white rounded border border-slate-200 p-3 shadow-sm">
              <div className="font-semibold text-xs uppercase text-slate-500 mb-2">Top Endpoints</div>
              <div className="space-y-3">
                {topEndpoints.map((ep, i) => {
                  const isDuplicate = ep.count > 1;
                  return (
                    <div key={i} className="text-xs space-y-1 border-b border-slate-50 pb-2 last:pb-0 last:border-0">
                      <div className="font-mono truncate">{ep.endpoint}</div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Count: {ep.count} | Avg: {ep.avg}ms</span>
                        {isDuplicate && (
                          <span className="flex items-center gap-1 text-amber-600 font-medium bg-amber-50 px-1 rounded">
                            <AlertTriangle size={12} /> Duplicate
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {topEndpoints.length === 0 && <div className="text-xs text-slate-400">No calls yet</div>}
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-2">
              <div className="flex gap-2">
                {["ALL", "LOCAL", "ZOHO", "SLOW", "ERROR"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f as any)}
                    className={`px-2 py-1 text-[10px] rounded font-semibold transition-colors ${
                      filter === f ? "bg-slate-800 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => exportData("JSON")} className="flex items-center gap-1 text-xs px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">
                  <Download size={12} /> JSON
                </button>
                <button onClick={() => exportData("CSV")} className="flex items-center gap-1 text-xs px-2 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">
                  <Download size={12} /> CSV
                </button>
                <button onClick={clearSession} className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 ml-auto">
                  <Trash2 size={12} /> Reset
                </button>
              </div>
            </div>

            {/* Performance Score */}
            <div className="bg-white rounded border border-slate-200 p-3 shadow-sm text-center">
              <div className="font-semibold text-xs uppercase text-slate-500 mb-2">PERFORMANCE SCORE</div>
              <div className={`text-4xl font-bold mb-2 ${score > 80 ? "text-emerald-500" : score > 50 ? "text-amber-500" : "text-red-500"}`}>
                {score} / 100
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                <div className="flex justify-between"><span>API Count</span> <span className="font-bold">{calls.length}</span></div>
                <div className="flex justify-between"><span>Latency</span> <span className="font-bold">{Math.round((calls.length - slowCalls) / Math.max(calls.length, 1) * 100)}</span></div>
                <div className="flex justify-between"><span>Duplicates</span> <span className="font-bold">{Math.round((calls.length - duplicateCalls) / Math.max(calls.length, 1) * 100)}</span></div>
                <div className="flex justify-between"><span>Errors</span> <span className="font-bold">{Math.round((calls.length - errors) / Math.max(calls.length, 1) * 100)}</span></div>
              </div>
            </div>

            {/* AI Analysis */}
            <div className="bg-white rounded border border-slate-200 p-3 shadow-sm">
              <div className="font-semibold text-xs uppercase text-slate-500 mb-2">AI ANALYSIS</div>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={copySummary} className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition-colors">
                  <Copy size={14} /> 📋 Summary
                </button>
                <button onClick={copyAIReport} className="flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded transition-colors shadow-sm">
                  <Copy size={14} /> 🧠 AI Report
                </button>
                <button onClick={copyRawJSON} className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition-colors">
                  <Copy size={14} /> {'{ }'} Raw JSON
                </button>
              </div>
            </div>

            {/* Call Log Table */}
            <div className="space-y-2 pb-10">
              {filteredCalls.slice().reverse().map((c) => {
                const color = c.status >= 400 ? "text-red-600" : c.durationMs > 500 ? "text-red-500" : c.durationMs > 200 ? "text-amber-500" : "text-emerald-500";
                const isDuplicate = duplicateCounts[`${c.method}:${c.endpoint}`] > 1;

                return (
                  <div key={c.id} className="bg-white rounded border border-slate-200 p-2 text-xs shadow-sm font-mono flex flex-col gap-1">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex gap-2 text-[10px] text-slate-400">
                        <span>{new Date(c.time).toLocaleTimeString()}</span>
                        <span className={c.source === "ZOHO" ? "text-emerald-600 font-bold" : "text-blue-600 font-bold"}>{c.source}</span>
                      </div>
                      <div className={`font-bold ${color}`}>{c.durationMs}ms</div>
                    </div>
                    <div className="break-all font-semibold text-slate-700 leading-tight">
                      {c.method} {c.endpoint}
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className={`text-[10px] ${c.status >= 400 ? "text-red-600 font-bold" : "text-slate-400"}`}>HTTP {c.status}</span>
                      {isDuplicate && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded flex items-center gap-1">
                           <AlertTriangle size={10} /> Duplicate
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-16 right-4 z-[70] bg-slate-800 text-white px-4 py-2 rounded shadow-xl flex items-center gap-2 text-sm animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={16} className="text-emerald-400" /> {toast}
        </div>
      )}
    </>
  );
}
