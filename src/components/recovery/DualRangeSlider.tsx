'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

export interface DualRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  onChangeCommit?: (value: [number, number]) => void;
  formatValue?: (val: number) => string;
  disabled?: boolean;
}

export default function DualRangeSlider({
  min,
  max,
  step = 1000,
  value,
  onChange,
  onChangeCommit,
  formatValue = (v) => `₹${v.toLocaleString('en-IN')}`,
  disabled = false,
}: DualRangeSliderProps) {
  const [minVal, setMinVal] = useState(value[0]);
  const [maxVal, setMaxVal] = useState(value[1]);
  const minValRef = useRef(minVal);
  const maxValRef = useRef(maxVal);

  useEffect(() => {
    setMinVal(value[0]);
    setMaxVal(value[1]);
    minValRef.current = value[0];
    maxValRef.current = value[1];
  }, [value]);

  // Convert to percentage
  const effectiveMax = Math.max(max, min + step);
  const getPercent = useCallback(
    (value: number) => Math.round(((value - min) / (effectiveMax - min)) * 100),
    [min, effectiveMax]
  );

  const minPercent = getPercent(minVal);
  const maxPercent = getPercent(maxVal);

  const handleMinChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = Math.min(Number(event.target.value), maxVal - step);
    const clamped = Math.max(min, nextVal);
    setMinVal(clamped);
    minValRef.current = clamped;
    onChange([clamped, maxVal]);
  };

  const handleMaxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = Math.max(Number(event.target.value), minVal + step);
    const clamped = Math.min(effectiveMax, nextVal);
    setMaxVal(clamped);
    maxValRef.current = clamped;
    onChange([minVal, clamped]);
  };

  const handleCommit = () => {
    if (onChangeCommit) {
      onChangeCommit([minValRef.current, maxValRef.current]);
    }
  };

  const isFiltered = minVal > min || maxVal < effectiveMax;

  // Preset ranges
  const presets = [
    { label: 'All', range: [min, effectiveMax] as [number, number] },
    { label: '< ₹50K', range: [min, Math.min(50000, effectiveMax)] as [number, number] },
    { label: '₹50K - ₹2L', range: [Math.min(50000, effectiveMax), Math.min(200000, effectiveMax)] as [number, number] },
    { label: '₹2L - ₹5L', range: [Math.min(200000, effectiveMax), Math.min(500000, effectiveMax)] as [number, number] },
    { label: '> ₹5L', range: [Math.min(500000, effectiveMax), effectiveMax] as [number, number] },
  ].filter((p) => p.range[0] < p.range[1] || p.label === 'All');

  return (
    <div className="w-full flex flex-col gap-3 font-sans select-none">
      {/* Current Range Display */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-400">Selected Range</span>
          <span className="font-extrabold text-[#1A2766] text-sm">
            {formatValue(minVal)} — {formatValue(maxVal)}
          </span>
        </div>
        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setMinVal(min);
              setMaxVal(effectiveMax);
              minValRef.current = min;
              maxValRef.current = effectiveMax;
              onChange([min, effectiveMax]);
              if (onChangeCommit) onChangeCommit([min, effectiveMax]);
            }}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-0.5 rounded cursor-pointer transition-colors"
            title="Reset range filter to default"
          >
            <RotateCcw size={10} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Dual Slider Track */}
      <div className="relative w-full h-8 flex items-center">
        {/* Visual Background Track */}
        <div className="absolute w-full h-2 bg-slate-200 rounded-full" />

        {/* Visual Active Highlighted Range */}
        <div
          className="absolute h-2 bg-[#1A2766] rounded-full transition-all"
          style={{
            left: `${minPercent}%`,
            width: `${Math.max(0, maxPercent - minPercent)}%`,
          }}
        />

        {/* Min Input Thumb */}
        <input
          type="range"
          min={min}
          max={effectiveMax}
          step={step}
          value={minVal}
          disabled={disabled}
          onChange={handleMinChange}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          onKeyUp={handleCommit}
          className="dual-range-input dual-range-min z-20 pointer-events-none absolute w-full h-2 bg-transparent appearance-none cursor-pointer"
          aria-label="Minimum net outstanding amount"
          aria-valuemin={min}
          aria-valuemax={maxVal}
          aria-valuenow={minVal}
        />

        {/* Max Input Thumb */}
        <input
          type="range"
          min={min}
          max={effectiveMax}
          step={step}
          value={maxVal}
          disabled={disabled}
          onChange={handleMaxChange}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          onKeyUp={handleCommit}
          className="dual-range-input dual-range-max z-21 pointer-events-none absolute w-full h-2 bg-transparent appearance-none cursor-pointer"
          aria-label="Maximum net outstanding amount"
          aria-valuemin={minVal}
          aria-valuemax={effectiveMax}
          aria-valuenow={maxVal}
        />
      </div>

      {/* Boundary Labels */}
      <div className="flex justify-between text-[10px] text-slate-400 font-medium">
        <span>Min: {formatValue(min)}</span>
        <span>Max: {formatValue(effectiveMax)}</span>
      </div>

      {/* Quick Presets */}
      <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
          Presets:
        </span>
        {presets.map((p) => {
          const isActive = minVal === p.range[0] && maxVal === p.range[1];
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setMinVal(p.range[0]);
                setMaxVal(p.range[1]);
                minValRef.current = p.range[0];
                maxValRef.current = p.range[1];
                onChange(p.range);
                if (onChangeCommit) onChangeCommit(p.range);
              }}
              className={`text-[10.5px] px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer border ${
                isActive
                  ? 'bg-[#1A2766] text-white border-[#1A2766]'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom Styles for webkit / moz slider thumbs */}
      <style jsx>{`
        .dual-range-input::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background-color: #ffffff;
          border: 2.5px solid #1a2766;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          transition: transform 0.1s ease, border-color 0.1s ease;
        }
        .dual-range-input::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          border-color: #25368a;
        }
        .dual-range-input::-webkit-slider-thumb:active {
          transform: scale(1.2);
          background-color: #1a2766;
        }
        .dual-range-input::-moz-range-thumb {
          pointer-events: auto;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background-color: #ffffff;
          border: 2.5px solid #1a2766;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
