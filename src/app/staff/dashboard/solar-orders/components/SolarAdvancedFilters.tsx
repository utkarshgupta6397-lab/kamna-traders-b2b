import React, { useState, useMemo } from 'react';
import { Filter, X } from 'lucide-react';

interface SolarAdvancedFiltersProps {
  filterOptions: {
    systemTypes: { label: string; value: string; count: number }[];
    quarters: { label: string; value: string; count: number }[];
    leadSources: { label: string; value: string; count: number }[];
    assignees: { label: string; value: string; count: number }[];
  };
  systemTypes: string[];
  setSystemTypes: React.Dispatch<React.SetStateAction<string[]>>;
  quarters: string[];
  setQuarters: React.Dispatch<React.SetStateAction<string[]>>;
  leadSources: string[];
  setLeadSources: React.Dispatch<React.SetStateAction<string[]>>;
  assignedTo: string[];
  setAssignedTo: React.Dispatch<React.SetStateAction<string[]>>;
  activeFilterCount: number;
  resetFilters: () => void;
  toggleArrayItem: (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => void;
}

const SolarAdvancedFilters = React.memo(function SolarAdvancedFilters({
  filterOptions,
  systemTypes,
  setSystemTypes,
  quarters,
  setQuarters,
  leadSources,
  setLeadSources,
  assignedTo,
  setAssignedTo,
  activeFilterCount,
  resetFilters,
  toggleArrayItem
}: SolarAdvancedFiltersProps) {
  const [leadSourceSearch, setLeadSourceSearch] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');

  const filteredLeadSources = useMemo(() => {
    if (!leadSourceSearch) return filterOptions.leadSources;
    const lowerSearch = leadSourceSearch.toLowerCase();
    return filterOptions.leadSources.filter(o => o.label.toLowerCase().includes(lowerSearch));
  }, [filterOptions.leadSources, leadSourceSearch]);

  const filteredAssignees = useMemo(() => {
    if (!assigneeSearch) return filterOptions.assignees;
    const lowerSearch = assigneeSearch.toLowerCase();
    return filterOptions.assignees.filter(o => o.label.toLowerCase().includes(lowerSearch));
  }, [filterOptions.assignees, assigneeSearch]);

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
        <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
          <Filter size={16} className="text-blue-500" />
          Advanced Filters
        </h3>
        {activeFilterCount > 0 && (
          <button onClick={resetFilters} className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-orange-200">
            <X size={12} /> Clear All Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* System Type */}
        {filterOptions.systemTypes.length > 0 && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">System Type</label>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {filterOptions.systemTypes.map(opt => (
                <label key={opt.value} className="flex items-center justify-between p-1.5 hover:bg-gray-50 rounded cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={systemTypes.includes(opt.value)} onChange={() => toggleArrayItem(setSystemTypes, opt.value)} className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                    <span className="text-xs text-gray-700 font-medium group-hover:text-blue-700 transition-colors">{opt.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{opt.count}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Quarter */}
        {filterOptions.quarters.length > 0 && (
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Quarter</label>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
              {filterOptions.quarters.map(opt => (
                <label key={opt.value} className="flex items-center justify-between p-1.5 hover:bg-gray-50 rounded cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={quarters.includes(opt.value)} onChange={() => toggleArrayItem(setQuarters, opt.value)} className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                    <span className="text-xs text-gray-700 font-medium group-hover:text-blue-700 transition-colors">{opt.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{opt.count}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Lead Source */}
        {filterOptions.leadSources.length > 0 && (
          <div className="space-y-2 flex flex-col h-full">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Lead Source</label>
            <input 
              type="text" 
              placeholder="Search sources..." 
              value={leadSourceSearch}
              onChange={(e) => setLeadSourceSearch(e.target.value)}
              className="w-full text-[10px] p-1.5 border border-gray-200 rounded mb-2 bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-400"
            />
            <div className="space-y-1 max-h-32 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {filteredLeadSources.map(opt => (
                <label key={opt.value} className="flex items-center justify-between p-1.5 hover:bg-gray-50 rounded cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={leadSources.includes(opt.value)} onChange={() => toggleArrayItem(setLeadSources, opt.value)} className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                    <span className="text-xs text-gray-700 font-medium group-hover:text-blue-700 transition-colors truncate max-w-[120px]">{opt.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{opt.count}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Assigned To */}
        {filterOptions.assignees.length > 0 && (
          <div className="space-y-2 flex flex-col h-full">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Assigned To</label>
            <input 
              type="text" 
              placeholder="Search assignees..." 
              value={assigneeSearch}
              onChange={(e) => setAssigneeSearch(e.target.value)}
              className="w-full text-[10px] p-1.5 border border-gray-200 rounded mb-2 bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-400"
            />
            <div className="space-y-1 max-h-32 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {filteredAssignees.map(opt => (
                <label key={opt.value} className="flex items-center justify-between p-1.5 hover:bg-gray-50 rounded cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={assignedTo.includes(opt.value)} onChange={() => toggleArrayItem(setAssignedTo, opt.value)} className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                    <span className="text-xs text-gray-700 font-medium group-hover:text-blue-700 transition-colors truncate max-w-[120px]" title={opt.label}>{opt.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{opt.count}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default SolarAdvancedFilters;
