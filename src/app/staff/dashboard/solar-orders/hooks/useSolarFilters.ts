import { useState, useMemo, useEffect } from 'react';

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

export function useSolarFilters(allOrders: any[]) {
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Multi-select filters
  const [systemTypes, setSystemTypes] = useState<string[]>([]);
  const [quarters, setQuarters] = useState<string[]>([]);
  const [leadSources, setLeadSources] = useState<string[]>([]);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  
  // Search within filters
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [leadSourceSearch, setLeadSourceSearch] = useState('');

  // Pagination & outstanding payment
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [hasOutstandingPayment, setHasOutstandingPayment] = useState(false);

  const filteredOrders = useMemo(() => {
    let result = allOrders;

    // Apply Search
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(o => 
        o.orderNumber?.toLowerCase().includes(s) ||
        o.customerName?.toLowerCase().includes(s) ||
        o.phoneNumber?.includes(s) ||
        (o.zohoBooksCustomerId && o.zohoBooksCustomerId.toLowerCase().includes(s))
      );
    }

    // Apply Status Filter
    if (statusFilter !== 'All') {
      result = result.filter(o => {
        if (statusFilter === 'PENDING_APPROVAL') return o.status === 'PENDING_APPROVAL';
        if (statusFilter === 'EXECUTION') return ['APPROVED', 'EXECUTION', 'INSTALLATION_IN_PROGRESS'].includes(o.status);
        if (statusFilter === 'COMPLETED') return o.status === 'COMPLETED';
        if (statusFilter === 'REJECTED') return ['REJECTED', 'CANCELLED'].includes(o.status);
        return true;
      });
    }

    // Apply Multi-select Filters
    if (systemTypes.length > 0) {
      result = result.filter(o => systemTypes.includes(o.systemType));
    }
    if (quarters.length > 0) {
      result = result.filter(o => quarters.includes(getQuarter(o.orderDate)));
    }
    if (leadSources.length > 0) {
      result = result.filter(o => leadSources.includes(o.leadSource));
    }
    if (assignedTo.length > 0) {
      result = result.filter(o => {
        const assignee = o.salesman?.name || o.callingExecutive?.name || o.subVendor?.name || 'Unassigned';
        return assignedTo.includes(assignee);
      });
    }

    return result;
  }, [allOrders, search, statusFilter, systemTypes, quarters, leadSources, assignedTo]);

  // Compute status counts based ONLY on search
  const statusCounts = useMemo(() => {
    let base = allOrders;
    if (search.trim()) {
      const s = search.toLowerCase();
      base = base.filter(o => 
        o.orderNumber?.toLowerCase().includes(s) ||
        o.customerName?.toLowerCase().includes(s) ||
        o.phoneNumber?.includes(s)
      );
    }
    
    return {
      all: base.length,
      pendingApproval: base.filter(o => o.status === 'PENDING_APPROVAL').length,
      execution: base.filter(o => ['APPROVED', 'EXECUTION', 'INSTALLATION_IN_PROGRESS'].includes(o.status)).length,
      completed: base.filter(o => o.status === 'COMPLETED').length,
      rejected: base.filter(o => ['REJECTED', 'CANCELLED'].includes(o.status)).length,
    };
  }, [allOrders, search]);

  const filterOptions = useMemo(() => {
    const opts = {
      systemTypes: {} as Record<string, number>,
      quarters: {} as Record<string, number>,
      leadSources: {} as Record<string, number>,
      assignees: {} as Record<string, number>
    };

    filteredOrders.forEach(o => {
      const st = formatSystemType(o.systemType);
      opts.systemTypes[st] = (opts.systemTypes[st] || 0) + 1;
      
      const q = getQuarter(o.orderDate);
      opts.quarters[q] = (opts.quarters[q] || 0) + 1;
      
      const ls = o.leadSource || 'OTHER';
      opts.leadSources[ls] = (opts.leadSources[ls] || 0) + 1;
      
      const assignee = o.salesman?.name || o.callingExecutive?.name || o.subVendor?.name || 'Unassigned';
      opts.assignees[assignee] = (opts.assignees[assignee] || 0) + 1;
    });

    // Ensure selected options remain visible
    systemTypes.forEach(t => { if (opts.systemTypes[formatSystemType(t)] === undefined) opts.systemTypes[formatSystemType(t)] = 0; });
    quarters.forEach(q => { if (opts.quarters[q] === undefined) opts.quarters[q] = 0; });
    leadSources.forEach(ls => { if (opts.leadSources[ls] === undefined) opts.leadSources[ls] = 0; });
    assignedTo.forEach(a => { if (opts.assignees[a] === undefined) opts.assignees[a] = 0; });

    return {
      systemTypes: Object.entries(opts.systemTypes).map(([k, v]) => ({ label: k, value: k.toUpperCase().replace('-', '_'), count: v })).sort((a,b) => b.count - a.count),
      quarters: Object.entries(opts.quarters).map(([k, v]) => ({ label: k, value: k, count: v })).sort((a,b) => {
        const [qA, yA] = a.label.split(' ');
        const [qB, yB] = b.label.split(' ');
        if (yA !== yB) return parseInt(yB) - parseInt(yA);
        return qA.localeCompare(qB);
      }),
      leadSources: Object.entries(opts.leadSources).map(([k, v]) => ({ label: getLeadSourceBadge(k).label, value: k, count: v })).sort((a,b) => b.count - a.count),
      assignees: Object.entries(opts.assignees).map(([k, v]) => ({ label: k, value: k, count: v })).sort((a,b) => b.count - a.count)
    };
  }, [filteredOrders, systemTypes, quarters, leadSources, assignedTo]);

  const activeFilterCount = systemTypes.length + quarters.length + leadSources.length + assignedTo.length;

  const totalPages = Math.ceil(filteredOrders.length / limit);
  useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(1);
  }, [totalPages, page]);

  const paginatedOrders = filteredOrders.slice((page - 1) * limit, page * limit);

  const resetFilters = () => {
    setSystemTypes([]);
    setQuarters([]);
    setLeadSources([]);
    setAssignedTo([]);
    setSearch('');
    setStatusFilter('All');
    setHasOutstandingPayment(false);
    setPage(1);
    setAssigneeSearch('');
    setLeadSourceSearch('');
  };

  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
    setPage(1);
  };

  return {
    showFilters, setShowFilters,
    search, setSearch,
    statusFilter, setStatusFilter,
    systemTypes, setSystemTypes,
    quarters, setQuarters,
    leadSources, setLeadSources,
    assignedTo, setAssignedTo,
    assigneeSearch, setAssigneeSearch,
    leadSourceSearch, setLeadSourceSearch,
    hasOutstandingPayment, setHasOutstandingPayment,
    page, setPage,
    limit, setLimit,
    activeFilterCount,
    filterOptions,
    statusCounts,
    paginatedOrders,
    filteredOrders,
    totalPages,
    resetFilters,
    toggleArrayItem,
  };
}
