'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, RefreshCw, Plus, Users, UserCheck, UserX, Shield, Briefcase, ChevronDown, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import ResetPinButton from '@/components/ResetPinButton';
import SafeDeleteButton from '@/components/SafeDeleteButton';
import UserDrawer from './UserDrawer';

interface User {
  id: string;
  name: string;
  mobile: string;
  role: string;
  active: boolean;
  pin: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UsersClientProps {
  users: User[];
  createUserAction: (data: FormData) => Promise<any>;
  updateUserAction: (data: FormData) => Promise<any>;
  deleteUserAction: (id: string) => Promise<void>;
}

type KpiType = 'TOTAL' | 'ACTIVE' | 'INACTIVE' | 'ADMINS' | 'STAFF' | null;
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type RoleFilter = 'ALL' | 'ADMIN' | 'STAFF';
type SortOption = 'NAME_AZ' | 'NAME_ZA' | 'MOBILE' | 'STATUS';

export default function UsersClient({ users, createUserAction, updateUserAction, deleteUserAction }: UsersClientProps) {
  // Filters State
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('NAME_AZ');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // ─── KPI Logic ───
  const kpiCounts = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.active).length,
    inactive: users.filter(u => !u.active).length,
    admins: users.filter(u => u.role === 'ADMIN').length,
    staff: users.filter(u => u.role === 'STAFF').length,
  }), [users]);

  // Determine active KPI based on strict match of current filters
  const activeKpi: KpiType = useMemo(() => {
    if (statusFilter === 'ALL' && roleFilter === 'ALL') return 'TOTAL';
    if (statusFilter === 'ACTIVE' && roleFilter === 'ALL') return 'ACTIVE';
    if (statusFilter === 'INACTIVE' && roleFilter === 'ALL') return 'INACTIVE';
    if (statusFilter === 'ALL' && roleFilter === 'ADMIN') return 'ADMINS';
    if (statusFilter === 'ALL' && roleFilter === 'STAFF') return 'STAFF';
    return null;
  }, [statusFilter, roleFilter]);

  const handleKpiClick = (kpi: KpiType) => {
    switch (kpi) {
      case 'TOTAL':
        setStatusFilter('ALL');
        setRoleFilter('ALL');
        break;
      case 'ACTIVE':
        setStatusFilter('ACTIVE');
        setRoleFilter('ALL');
        break;
      case 'INACTIVE':
        setStatusFilter('INACTIVE');
        setRoleFilter('ALL');
        break;
      case 'ADMINS':
        setStatusFilter('ALL');
        setRoleFilter('ADMIN');
        break;
      case 'STAFF':
        setStatusFilter('ALL');
        setRoleFilter('STAFF');
        break;
    }
    setPage(1);
  };

  const handleReset = () => {
    setStatusFilter('ACTIVE');
    setRoleFilter('ALL');
    setSearchQuery('');
    setSortOption('NAME_AZ');
    setRowsPerPage(10);
    setPage(1);
  };

  // ─── Filter & Sort Pipeline ───
  const processedUsers = useMemo(() => {
    let result = [...users];

    // Status Filter
    if (statusFilter === 'ACTIVE') result = result.filter(u => u.active);
    else if (statusFilter === 'INACTIVE') result = result.filter(u => !u.active);

    // Role Filter
    if (roleFilter !== 'ALL') {
      result = result.filter(u => u.role === roleFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(u => 
        u.name.toLowerCase().includes(q) || 
        u.mobile.includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'NAME_AZ': return a.name.localeCompare(b.name);
        case 'NAME_ZA': return b.name.localeCompare(a.name);
        case 'MOBILE': return a.mobile.localeCompare(b.mobile);
        case 'STATUS': return Number(b.active) - Number(a.active); // Active first
        default: return 0;
      }
    });

    return result;
  }, [users, statusFilter, roleFilter, searchQuery, sortOption]);

  // ─── Pagination Logic ───
  const totalPages = Math.ceil(processedUsers.length / rowsPerPage) || 1;
  // Clamp page if it goes out of bounds due to filtering
  const currentPage = Math.min(page, totalPages);
  
  // Only update state if clamped to avoid render loop
  if (currentPage !== page && processedUsers.length > 0) {
    setPage(currentPage);
  }

  const paginatedUsers = processedUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // ─── Handlers ───
  const openAddDrawer = () => {
    setEditingUser(null);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (user: User) => {
    setEditingUser(user);
    setIsDrawerOpen(true);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Users ({users.length})</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and control system users</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { id: 'TOTAL', label: 'Total Users', count: kpiCounts.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { id: 'ACTIVE', label: 'Active Users', count: kpiCounts.active, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
          { id: 'INACTIVE', label: 'Inactive Users', count: kpiCounts.inactive, icon: UserX, color: 'text-red-600', bg: 'bg-red-50' },
          { id: 'ADMINS', label: 'Admins', count: kpiCounts.admins, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
          { id: 'STAFF', label: 'Staff', count: kpiCounts.staff, icon: Briefcase, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((kpi) => {
          const isActive = activeKpi === kpi.id;
          const Icon = kpi.icon;
          return (
            <div 
              key={kpi.id}
              onClick={() => handleKpiClick(kpi.id as KpiType)}
              className={`bg-white rounded-xl p-4 border transition-all cursor-pointer ${
                isActive 
                  ? 'border-[#1A2766] ring-1 ring-[#1A2766] shadow-sm' 
                  : 'border-gray-100 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${kpi.bg}`}>
                  <Icon size={18} className={kpi.color} />
                </div>
                <span className={`text-sm font-medium ${isActive ? 'text-[#1A2766]' : 'text-gray-600'}`}>
                  {kpi.label}
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{kpi.count}</div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto flex-1">
          {/* Search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name or mobile..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A2766] focus:border-transparent transition-shadow"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}
              options={[
                { label: 'Status: All', value: 'ALL' },
                { label: 'Status: Active', value: 'ACTIVE' },
                { label: 'Status: Inactive', value: 'INACTIVE' },
              ]}
              className="w-36 h-9"
            />
            <Select
              value={roleFilter}
              onChange={(v) => { setRoleFilter(v as RoleFilter); setPage(1); }}
              options={[
                { label: 'Role: All', value: 'ALL' },
                { label: 'Role: Admin', value: 'ADMIN' },
                { label: 'Role: Staff', value: 'STAFF' },
              ]}
              className="w-32 h-9"
            />
            <Select
              value={sortOption}
              onChange={(v) => { setSortOption(v as SortOption); setPage(1); }}
              options={[
                { label: 'Sort: Name A–Z', value: 'NAME_AZ' },
                { label: 'Sort: Name Z–A', value: 'NAME_ZA' },
                { label: 'Sort: Mobile', value: 'MOBILE' },
                { label: 'Sort: Status', value: 'STATUS' },
              ]}
              className="w-36 h-9"
            />
            <button
              onClick={handleReset}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Reset Filters"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <button
          onClick={openAddDrawer}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#1A2766] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003347] transition-colors"
        >
          <Plus size={16} />
          Add New User
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 bg-gray-50 border-b border-gray-100 px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-3">User</div>
              <div className="col-span-2">Mobile</div>
              <div className="col-span-1">Role</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">PIN</div>
              <div className="col-span-1">Last Login</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-50">
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((u) => (
                  <div key={u.id} className="grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-gray-50/50 transition-colors">
                    {/* User */}
                    <div className="col-span-3 flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {getInitials(u.name)}
                      </div>
                      <span className="text-sm font-medium text-gray-900 truncate">{u.name}</span>
                    </div>

                    {/* Mobile */}
                    <div className="col-span-2">
                      <span className="text-sm text-gray-600 font-mono">{u.mobile}</span>
                    </div>

                    {/* Role */}
                    <div className="col-span-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {u.role === 'ADMIN' ? 'Admin' : 'Staff'}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-2 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${u.active ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                      <span className={`text-sm ${u.active ? 'text-gray-900' : 'text-gray-500'}`}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* PIN */}
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-sm text-gray-500 tracking-widest mt-1">••••</span>
                      <ResetPinButton mobile={u.mobile} />
                    </div>

                    {/* Last Login */}
                    <div className="col-span-1">
                      <span className="text-sm text-gray-400">—</span>
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex justify-end items-center gap-1">
                      <button 
                        onClick={() => openEditDrawer(u)}
                        className="text-gray-400 hover:text-[#1A2766] hover:bg-blue-50 p-1.5 rounded transition-colors"
                        title="Edit User"
                      >
                        <Edit2 size={16} />
                      </button>
                      <SafeDeleteButton 
                        action={deleteUserAction} 
                        id={u.id} 
                        label="user" 
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                      >
                        <UserX size={16} />
                      </SafeDeleteButton>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center flex flex-col items-center">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <Search className="text-gray-400" size={24} />
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">No users found</h3>
                  <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            {processedUsers.length > 0 ? (
              <span>
                Showing <span className="font-medium text-gray-900">{(currentPage - 1) * rowsPerPage + 1}</span>–
                <span className="font-medium text-gray-900">{Math.min(currentPage * rowsPerPage, processedUsers.length)}</span> of{' '}
                <span className="font-medium text-gray-900">{processedUsers.length}</span>
              </span>
            ) : (
              <span>No results</span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Rows per page:</span>
              <Select
                value={String(rowsPerPage)}
                onChange={(v) => { setRowsPerPage(Number(v)); setPage(1); }}
                options={[
                  { label: '10', value: '10' },
                  { label: '25', value: '25' },
                  { label: '50', value: '50' },
                  { label: '100', value: '100' },
                ]}
                className="w-20 h-8 text-xs"
              />
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || processedUsers.length === 0}
                className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-gray-700 font-medium px-2">
                {currentPage} <span className="text-gray-400 font-normal mx-1">/</span> {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || processedUsers.length === 0}
                className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <UserDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        user={editingUser}
        createUserAction={createUserAction}
        updateUserAction={updateUserAction}
      />
    </div>
  );
}
