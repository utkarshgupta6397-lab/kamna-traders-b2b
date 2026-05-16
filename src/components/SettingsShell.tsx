'use client';

import React, { useState } from 'react';
import { Printer, Settings, Bell, Monitor, Zap, Share2, ChevronRight, Menu } from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
  component: React.ReactNode;
  description: string;
}

interface SettingsShellProps {
  tabs: Tab[];
  activeTabId?: string;
}

export default function SettingsShell({ tabs, activeTabId: initialTabId }: SettingsShellProps) {
  const [activeTabId, setActiveTabId] = useState(initialTabId || tabs[0].id);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const effectiveExpanded = isExpanded || isPinned;

  return (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4">
      {/* Sidebar Navigation */}
      <aside 
        className={`w-full ${effectiveExpanded ? 'md:w-64' : 'md:w-16'} transition-all duration-300 ease-in-out flex-shrink-0 bg-white md:bg-transparent border-r md:border-r-0 border-gray-100`}
        onMouseEnter={() => !isPinned && setIsExpanded(true)}
        onMouseLeave={() => !isPinned && setIsExpanded(false)}
      >
        <div className="p-2 flex justify-between items-center md:hidden">
          <button onClick={() => setIsPinned(!isPinned)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-[#1A2766]">{activeTab.label}</span>
        </div>

        <nav className={`space-y-1 p-2 ${!effectiveExpanded && 'md:items-center'} flex flex-col`}>
          {/* Desktop Pin Toggle */}
          <button 
            onClick={() => { setIsPinned(!isPinned); setIsExpanded(!isPinned); }}
            className="hidden md:flex items-center justify-center p-2 text-gray-400 hover:text-[#1A2766] rounded-lg self-end"
            title={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
          >
            <Menu className="w-4 h-4" />
          </button>

          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`w-full flex items-center ${effectiveExpanded ? 'justify-between p-3' : 'justify-center p-2'} rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-[#1A2766] text-white shadow-md shadow-[#1A2766]/20' 
                    : 'text-gray-600 hover:bg-white hover:shadow-sm'
                }`}
                title={!effectiveExpanded ? tab.label : undefined}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/10' : 'bg-gray-100 group-hover:bg-white'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {effectiveExpanded && (
                    <div className="text-left">
                      <div className="text-sm font-bold whitespace-nowrap">{tab.label}</div>
                    </div>
                  )}
                </div>
                {isActive && effectiveExpanded && <ChevronRight className="w-4 h-4 opacity-50" />}
              </button>
            );
          })}

          {/* Future Placeholder Tabs */}
          {effectiveExpanded && (
            <div className="pt-4 px-3">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Upcoming</h3>
              <div className="space-y-1">
                {[
                  { label: 'Notifications', icon: Bell },
                  { label: 'Display', icon: Monitor },
                  { label: 'Shortcuts', icon: Zap },
                  { label: 'Sync', icon: Share2 }
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-3 text-gray-400 cursor-not-allowed grayscale opacity-50">
                    <div className="p-1.5 bg-gray-100 rounded-lg">
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!effectiveExpanded && (
            <div className="pt-4 flex flex-col items-center gap-2">
              {[Bell, Monitor, Zap, Share2].map((Icon, idx) => (
                <div key={idx} className="p-2 text-gray-300 cursor-not-allowed opacity-50" title="Upcoming feature">
                  <Icon className="w-4 h-4" />
                </div>
              ))}
            </div>
          )}
        </nav>
      </aside>

      {/* Content Area */}
      <main className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-white to-gray-50/50">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#1A2766] flex items-center gap-2">
                <activeTab.icon className="w-5 h-5" />
                {activeTab.label}
              </h2>
              <p className="text-xs text-gray-500">{activeTab.description}</p>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeTab.component}
          </div>
        </div>
      </main>
    </div>
  );
}
