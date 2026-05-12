'use client';

import React, { useState } from 'react';
import { Printer, Settings, Bell, Monitor, Zap, Share2, ChevronRight } from 'lucide-react';

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
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  return (
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 flex-shrink-0">
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-[#1A2766] text-white shadow-md shadow-[#1A2766]/20' 
                    : 'text-gray-600 hover:bg-white hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/10' : 'bg-gray-100 group-hover:bg-white'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold">{tab.label}</div>
                  </div>
                </div>
                {isActive && <ChevronRight className="w-4 h-4 opacity-50" />}
              </button>
            );
          })}

          {/* Future Placeholder Tabs */}
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
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* Content Area */}
      <main className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-white to-gray-50/50">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#1A2766] flex items-center gap-2">
                <activeTab.icon className="w-5 h-5" />
                {activeTab.label}
              </h2>
              <p className="text-sm text-gray-500">{activeTab.description}</p>
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
