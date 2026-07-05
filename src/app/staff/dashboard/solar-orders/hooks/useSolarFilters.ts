import { useState, useMemo, useCallback } from 'react';

// Utility to determine Quarter
export const getQuarter = (dateString: string): string => {
  const d = new Date(dateString);
  const m = d.getMonth();
  const y = d.getFullYear();
  if (m < 3) return `Q1 ${y}`;
  if (m < 6) return `Q2 ${y}`;
  if (m < 9) return `Q3 ${y}`;
  return `Q4 ${y}`;
};

export const formatSystemType = (type: string) => {
  if (!type) return '';
  return type.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join('-');
};

export const getLeadSourceBadge = (source: string) => {
  switch(source?.toUpperCase()) {
    case 'WALK_IN': 
    case 'WALK-IN': 
      return { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Walk-in' };
    case 'WHATSAPP': 
    case 'ONLINE':
      return { bg: 'bg-green-50', text: 'text-green-700', label: 'Online' };
    case 'REFERRAL': 
      return { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Referral' };
    case 'FRIENDS & FAMILY':
    case 'FRIENDS_AND_FAMILY':
      return { bg: 'bg-pink-50', text: 'text-pink-700', label: 'Friends & Family' };
    case 'CALLING_ACTIVITY': 
    case 'CALLING ACTIVITY': 
      return { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Calling Activity' };
    case 'SUB_VENDOR': 
    case 'SUB-VENDOR': 
      return { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Sub-Vendor' };
    default: 
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Other' };
  }
};

export function useSolarFilters() {
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Multi-select filters
  const [systemTypes, setSystemTypes] = useState<string[]>([]);
  const [quarters, setQuarters] = useState<string[]>([]);
  const [leadSources, setLeadSources] = useState<string[]>([]);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);

  // Pagination & outstanding payment
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [hasOutstandingPayment, setHasOutstandingPayment] = useState(false);

  const resetFilters = useCallback(() => {
    setSystemTypes([]);
    setQuarters([]);
    setLeadSources([]);
    setAssignedTo([]);
    setSearch('');
    setStatusFilter('All');
    setHasOutstandingPayment(false);
    setPage(1);
  }, []);

  const toggleArrayItem = useCallback((setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    setPage(1);
  }, []);

  const activeFilterCount = systemTypes.length + quarters.length + leadSources.length + assignedTo.length;

  const onSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const onStatusChange = useCallback((val: string) => {
    setStatusFilter(val);
    setPage(1);
  }, []);

  return useMemo(() => ({
    showFilters, setShowFilters,
    search, setSearch: onSearchChange,
    statusFilter, setStatusFilter: onStatusChange,
    systemTypes, setSystemTypes,
    quarters, setQuarters,
    leadSources, setLeadSources,
    assignedTo, setAssignedTo,
    hasOutstandingPayment, setHasOutstandingPayment,
    page, setPage,
    limit, setLimit,
    activeFilterCount,
    resetFilters,
    toggleArrayItem,
  }), [
    showFilters, search, statusFilter, systemTypes, quarters, 
    leadSources, assignedTo, hasOutstandingPayment, page, limit, 
    activeFilterCount, onSearchChange, onStatusChange, resetFilters, toggleArrayItem
  ]);
}
