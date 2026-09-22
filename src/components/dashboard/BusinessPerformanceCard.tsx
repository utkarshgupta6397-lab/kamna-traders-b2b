'use client';

import React, { useState } from 'react';
import { TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { DailySalesTrendPoint } from '@/lib/post-dispatch-summary';

interface BusinessPerformanceCardProps {
  data?: DailySalesTrendPoint[] | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export default function BusinessPerformanceCard({
  data,
  isLoading = false,
  isError = false,
  onRetry,
}: BusinessPerformanceCardProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Safe fallback if data is not yet available or empty
  const days = data && data.length === 7 ? data : [];

  // Compute maximum value for the Y-axis scale to ensure proportional scaling
  const maxMetricVal = days.reduce((acc, d) => Math.max(acc, d.sales, d.movingAverage), 0);
  // Give 15% headroom above the max value for clear aesthetics and dot padding
  const yScaleMax = maxMetricVal > 0 ? maxMetricVal * 1.15 : 100000;

  // Chart coordinate geometry (SVG viewBox: 0 0 350 82)
  const plotTop = 8;
  const plotBottom = 76;
  const plotHeight = plotBottom - plotTop; // 68px
  const colWidth = 350 / 7; // 50px per column
  const barWidth = 18; // centered at cx

  // Build points for the 3-day moving average line
  const maPoints = days.map((day, i) => {
    const cx = i * colWidth + colWidth / 2;
    const maFraction = maxMetricVal > 0 ? Math.min(day.movingAverage / yScaleMax, 1) : 0;
    const cy = plotBottom - maFraction * plotHeight;
    return { cx, cy, day };
  });

  const maLinePath =
    maPoints.length > 0
      ? maPoints.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.cx.toFixed(1)} ${pt.cy.toFixed(1)}`, '')
      : '';

  const hoveredDay = hoveredIdx !== null && days[hoveredIdx] ? days[hoveredIdx] : null;

  return (
    <div className="bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-2xs flex flex-col justify-between overflow-hidden h-full min-h-0">
      {/* 1. Header: Icon, Title, Subtitle, and Legend */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <TrendingUp size={14} />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-800">Business Performance</h2>
            <p className="text-[10px] text-slate-500 font-medium">Sales — Last 7 Days</p>
          </div>
        </div>

        {/* Legend */}
        {!isLoading && !isError && (
          <div className="flex items-center gap-2.5 text-[10px] font-medium text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block shrink-0" />
              <span className="text-slate-600">Daily Sales</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center shrink-0">
                <span className="w-2.5 h-0.5 bg-amber-500 rounded-full" />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 -ml-2 border border-white" />
              </span>
              <span className="text-slate-600">3-Day Avg</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Visualization Body */}
      <div className="flex-1 min-h-0 w-full relative flex flex-col justify-between py-1 overflow-hidden">
        {isLoading ? (
          // Loading Skeleton State
          <div className="h-full w-full flex flex-col justify-between py-2 animate-pulse">
            <div className="flex-1 grid grid-cols-7 gap-2 items-end px-2">
              {[40, 65, 80, 50, 30, 75, 20].map((heightPct, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className="w-4 bg-slate-200 rounded-xs"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2 pt-2 border-t border-slate-100 text-center">
              {Array.from({ length: 7 }).map((_, idx) => (
                <div key={idx} className="h-3 bg-slate-100 rounded-xs mx-auto w-6" />
              ))}
            </div>
          </div>
        ) : isError ? (
          // Error State
          <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-center p-3">
            <AlertCircle size={20} className="text-amber-500" />
            <p className="text-xs font-semibold text-slate-700">Unable to load sales trend</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
              >
                <RefreshCw size={12} />
                <span>Retry</span>
              </button>
            )}
          </div>
        ) : (
          // Combination Bar + Line Chart
          <>
            {/* Floating Interactive Tooltip */}
            {hoveredDay && (
              <div
                className={`absolute top-0 z-30 pointer-events-none transition-all duration-150 ${
                  hoveredIdx !== null && hoveredIdx <= 1
                    ? 'left-1'
                    : hoveredIdx !== null && hoveredIdx >= 5
                    ? 'right-1'
                    : 'left-1/2 -translate-x-1/2'
                }`}
              >
                <div className="bg-slate-900/95 backdrop-blur-xs text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-xl border border-slate-700/60 max-w-[210px]">
                  <div className="flex items-center justify-between gap-3 mb-1 pb-1 border-b border-slate-800">
                    <span className="font-semibold text-slate-200">{hoveredDay.fullDate}</span>
                    {hoveredDay.isToday && (
                      <span className="px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-300 text-[9px] font-bold uppercase tracking-wider">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span className="w-2 h-2 rounded-xs bg-blue-500 shrink-0" />
                        <span>Daily Sales:</span>
                      </span>
                      <span className="font-bold text-white tabular-nums">
                        {hoveredDay.formattedSales}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span>3-Day Avg:</span>
                      </span>
                      <span className="font-medium text-amber-300 tabular-nums">
                        {hoveredDay.formattedMovingAverage}
                      </span>
                    </div>
                    {hoveredDay.invoiceCount > 0 && (
                      <div className="text-[10px] text-slate-400 pt-0.5 text-right">
                        {hoveredDay.invoiceCount} {hoveredDay.invoiceCount === 1 ? 'invoice' : 'invoices'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SVG Plot Area */}
            <div className="flex-1 min-h-0 w-full relative">
              <svg
                viewBox="0 0 350 82"
                preserveAspectRatio="none"
                className="w-full h-full min-h-0 overflow-visible"
              >
                {/* Horizontal Guide Lines */}
                <line
                  x1="0"
                  y1={plotTop}
                  x2="350"
                  y2={plotTop}
                  stroke="#F1F5F9"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1="0"
                  y1={(plotTop + plotBottom) / 2}
                  x2="350"
                  y2={(plotTop + plotBottom) / 2}
                  stroke="#F1F5F9"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1="0"
                  y1={plotBottom}
                  x2="350"
                  y2={plotBottom}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />

                {/* Column Highlight Background when Hovered */}
                {hoveredIdx !== null && (
                  <rect
                    x={hoveredIdx * colWidth + 2}
                    y={plotTop - 2}
                    width={colWidth - 4}
                    height={plotHeight + 4}
                    rx="4"
                    fill="#EFF6FF"
                    opacity="0.75"
                  />
                )}

                {/* Daily Sales Bars */}
                {days.map((day, idx) => {
                  const cx = idx * colWidth + colWidth / 2;
                  const salesFraction = maxMetricVal > 0 ? Math.min(day.sales / yScaleMax, 1) : 0;
                  const barHeight =
                    maxMetricVal > 0
                      ? Math.max(salesFraction * plotHeight, day.sales > 0 ? 3 : 0)
                      : 0;
                  const barY = plotBottom - barHeight;
                  const isHovered = hoveredIdx === idx;

                  return (
                    <g key={day.date}>
                      {barHeight > 0 && (
                        <rect
                          x={cx - barWidth / 2}
                          y={barY}
                          width={barWidth}
                          height={barHeight}
                          rx="2.5"
                          className="transition-colors duration-150"
                          fill={
                            isHovered
                              ? '#1D4ED8'
                              : day.isToday
                              ? '#2563EB'
                              : '#60A5FA'
                          }
                        />
                      )}
                      {/* Zero sales baseline dot/marker so empty days remain clearly indicated */}
                      {day.sales === 0 && (
                        <circle
                          cx={cx}
                          cy={plotBottom}
                          r={2}
                          fill={isHovered ? '#1D4ED8' : '#CBD5E1'}
                        />
                      )}
                    </g>
                  );
                })}

                {/* 3-Day Moving Average Overlay Line */}
                {maLinePath && (
                  <path
                    d={maLinePath}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* 3-Day Moving Average Data Point Circles */}
                {maPoints.map((pt, idx) => {
                  const isHovered = hoveredIdx === idx;
                  return (
                    <circle
                      key={pt.day.date}
                      cx={pt.cx}
                      cy={pt.cy}
                      r={isHovered ? 4.5 : 3}
                      fill="#FFFFFF"
                      stroke="#F59E0B"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      className="transition-all duration-150"
                    />
                  );
                })}

                {/* Invisible Hover Hitboxes for each of the 7 days */}
                {days.map((_, idx) => (
                  <rect
                    key={idx}
                    x={idx * colWidth}
                    y={0}
                    width={colWidth}
                    height={82}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                ))}
              </svg>
            </div>

            {/* 3. Stacked 7-Day X-Axis Labels */}
            <div className="grid grid-cols-7 text-center pt-1.5 border-t border-slate-100 shrink-0">
              {days.map((day, idx) => {
                const isHovered = hoveredIdx === idx;
                return (
                  <div
                    key={day.date}
                    className={`flex flex-col items-center cursor-pointer transition-colors py-0.5 rounded ${
                      isHovered
                        ? 'bg-blue-50/80 text-blue-700'
                        : day.isToday
                        ? 'text-slate-900 font-semibold'
                        : 'text-slate-500'
                    }`}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <span
                      className={`text-[10px] leading-tight ${
                        day.isToday ? 'font-bold text-blue-700' : 'font-medium'
                      }`}
                    >
                      {day.dayOfWeek}
                    </span>
                    <span className="text-[9px] leading-tight text-slate-400">
                      {day.formattedDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 4. Footer */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
        <span>Continuous aggregation</span>
      </div>
    </div>
  );
}
