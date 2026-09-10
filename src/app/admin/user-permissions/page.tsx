'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Shield, Users, Lock, Loader2, Info, Check, Tags, PackageCheck, Truck, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { GENERAL_PERMISSIONS, CATALOG_MODULES, DISPATCH_PERMISSION_GROUPS, MOBILE_PERMISSION_SECTIONS, PermissionKey } from '@/lib/permissions';

interface User {
  id: string;
  name: string;
  mobile: string;
  role: string;
  canManageCarts: boolean;
  canAdjustInventory: boolean;
  canManageTransfers: boolean;
  canDeleteTransfers: boolean;
  accountsAccess: boolean;
  workflow_edits: boolean;
  [key: string]: any;
}

export default function UserPermissionsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'catalog' | 'dispatch' | 'mobile'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'STAFF'>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (userId: string, key: PermissionKey, currentValue: boolean) => {
    const newValue = !currentValue;
    
    // Optimistic Update
    const postDispatchChildren: PermissionKey[] = [
      'mobile_dispatch_post_dispatch_receiving_upload',
      'mobile_dispatch_post_dispatch_checked_upload',
    ];

    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const updated = { ...u, [key]: newValue };
      if (newValue && postDispatchChildren.includes(key)) {
        updated.mobile_dispatch = true;
        updated.mobile_dispatch_post_dispatch = true;
      }
      if (newValue && [
        'dispatch_post_dispatch_receiving_verify',
        'dispatch_post_dispatch_checked_verify',
        'dispatch_force_archive'
      ].includes(key)) {
        updated.dispatch_view = true;
        updated.dispatch_post_dispatch = true;
      } else if (newValue && [
        'dispatch_post_dispatch',
        'dispatch_post_dispatch_review',
        'dispatch_receiving_upload',
        'dispatch_checked_by'
      ].includes(key)) {
        updated.dispatch_view = true;
      }
      return updated;
    }));
    setUpdatingId(`${userId}-${key}`);

    try {
      const res = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: newValue }),
      });

      if (!res.ok) throw new Error('Update failed');
      toast.success('Permission updated');
    } catch (err) {
      // Rollback
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [key]: currentValue } : u));
      toast.error('Failed to update permission');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter users by search, role, and tab-specific access rules
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           u.mobile.includes(searchQuery);
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      // In Catalog & Pricing tab, strictly show users with accountsAccess (Catalog & Pricing access) enabled or ADMINs
      if (activeTab === 'catalog') {
        const hasCatalogAccess = Boolean(u.role === 'ADMIN' || u.accountsAccess);
        return matchesSearch && matchesRole && hasCatalogAccess;
      }

      if (activeTab === 'dispatch') {
        const hasDispatchAccess = Boolean(u.role === 'ADMIN' || u.dispatch_view);
        return matchesSearch && matchesRole && hasDispatchAccess;
      }

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter, activeTab]);

  const stats = useMemo(() => {
    const catalogEnabledUsers = users.filter(u => u.role === 'ADMIN' || u.accountsAccess);
    const dispatchEnabledUsers = users.filter(u => u.role === 'ADMIN' || u.dispatch_view);
    const mobileEnabledUsers = users.filter(
      u => u.role === 'ADMIN' || u.mobile_stock_management || u.mobile_accounts || u.mobile_dispatch
    );
    return {
      total: users.length,
      admins: users.filter(u => u.role === 'ADMIN').length,
      staff: users.filter(u => u.role === 'STAFF').length,
      catalogUsers: catalogEnabledUsers.length,
      dispatchUsers: dispatchEnabledUsers.length,
      mobileUsers: mobileEnabledUsers.length,
    };
  }, [users]);

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-[#1A2766]" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full max-w-screen-2xl mx-auto px-4 pb-8 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#1A2766] uppercase tracking-tight flex items-center gap-2 leading-none">
            <Lock size={20} />
            User Permissions Workspace
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage module access rights and granular action permissions for staff members</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center border-b border-gray-200 gap-1 bg-white px-3 pt-2 rounded-t-xl">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${
            activeTab === 'general'
              ? 'border-[#1A2766] text-[#1A2766]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Shield size={14} />
          General Permissions
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-600 text-[10px]">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${
            activeTab === 'catalog'
              ? 'border-[#1A2766] text-[#1A2766]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Tags size={14} />
          Catalog & Pricing
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
            {stats.catalogUsers}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('dispatch')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${
            activeTab === 'dispatch'
              ? 'border-[#1A2766] text-[#1A2766]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Truck size={14} />
          Dispatch
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px]">
            {stats.dispatchUsers}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('mobile')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px ${
            activeTab === 'mobile'
              ? 'border-[#1A2766] text-[#1A2766]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
          title={`${stats.mobileUsers} users have mobile access enabled`}
        >
          <Smartphone size={14} />
          Mobile Access
          <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 text-[10px]" title={`${stats.mobileUsers} users with mobile access`}>
            {stats.mobileUsers} Users
          </span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Admin', value: stats.admins, icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Staff', value: stats.staff, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Catalog Enabled', value: stats.catalogUsers, icon: PackageCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Mobile Enabled', value: `${stats.mobileUsers} Users`, icon: Smartphone, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map((card) => (
          <div key={card.label} className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${card.bg} ${card.color}`}>
              <card.icon size={14} />
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none">{card.label}</p>
              <p className="text-sm font-black text-gray-900 mt-0.5 leading-none">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder={activeTab === 'catalog' ? "Search Catalog-enabled staff..." : "Search by name or phone..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1 h-7 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-[#1A2766] transition-all text-xs"
          />
        </div>
        <div className="flex items-center gap-0.5 bg-gray-50 p-0.5 rounded-lg border border-gray-200">
          {(['ALL', 'ADMIN', 'STAFF'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all h-6 flex items-center justify-center ${
                roleFilter === role 
                  ? 'bg-[#1A2766] text-white shadow-sm' 
                  : 'text-gray-500 hover:text-[#1A2766]'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: GENERAL PERMISSIONS MATRIX */}
      {activeTab === 'general' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
            <table className="w-full border-collapse relative">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="py-2 px-2.5 text-left border-b border-gray-200 min-w-[180px] bg-gray-50/95 backdrop-blur-sm sticky left-0 z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">User Details</span>
                  </th>
                  {GENERAL_PERMISSIONS.map(p => (
                    <th key={p.key} className="py-2 px-1 text-center border-b border-gray-200 min-w-[90px] bg-gray-50/95 backdrop-blur-sm">
                      <div className="flex items-center justify-center gap-0.5 group cursor-help relative" title={p.description || p.label}>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">
                          {p.label}
                        </span>
                        {p.description && (
                          <Info size={10} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredUsers.map((user) => {
                  const isAdmin = user.role === 'ADMIN';
                  
                  return (
                    <tr key={user.id} className="hover:bg-blue-50/20 transition-colors group">
                      <td className="py-1.5 px-2.5 border-b border-gray-100 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#1A2766] text-white flex items-center justify-center font-bold text-[10px] shadow-sm flex-shrink-0">
                            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-gray-900 truncate" title={user.name}>{user.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-gray-400">{formatPhone(user.mobile)}</span>
                              <span className={`text-[8px] px-1 py-0.2 rounded-full font-bold uppercase tracking-tighter ${
                                isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {GENERAL_PERMISSIONS.map(p => {
                        const isUpdating = updatingId === `${user.id}-${p.key}`;
                        const hasPermission = !!user[p.key];

                        return (
                          <td key={p.key} className="py-1.5 px-1 border-b border-gray-100 text-center">
                            {isAdmin ? (
                              <div className="flex items-center justify-center gap-0.5 text-amber-600 bg-amber-50 py-0.5 px-1.5 rounded-full mx-auto w-fit border border-amber-100">
                                <Check size={10} strokeWidth={3} />
                                <span className="text-[8px] font-black uppercase tracking-wider">Full Access</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center">
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={hasPermission}
                                    onChange={() => handleToggle(user.id, p.key, hasPermission)}
                                    disabled={isUpdating}
                                  />
                                  <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                  {isUpdating && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full">
                                      <Loader2 size={10} className="animate-spin text-[#1A2766]" />
                                    </div>
                                  )}
                                </label>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="p-12 text-center flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                <Search size={20} />
              </div>
              <div>
                <p className="text-gray-900 font-bold text-xs">No users found</p>
                <p className="text-[11px] text-gray-500">Try adjusting your search or filters</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CATALOG & PRICING DEDICATED PERMISSION MATRIX */}
      {activeTab === 'catalog' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden space-y-3">
          <div className="px-4 py-2 bg-amber-50/50 border-b border-amber-100 text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info size={14} className="text-amber-600 flex-shrink-0" />
              <span>
                Displaying only staff members with <strong>Catalog & Pricing</strong> module access enabled. View access is inherited from main module access.
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
              {filteredUsers.length} Users Eligible
            </span>
          </div>

          <div className="overflow-x-auto max-h-[calc(100vh-270px)]">
            <table className="w-full border-collapse relative">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm text-center">
                {/* Upper Module Group Header */}
                <tr>
                  <th rowSpan={2} className="py-2 px-2.5 text-left border-b border-gray-200 min-w-[200px] bg-gray-50/95 backdrop-blur-sm sticky left-0 z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">User Details</span>
                  </th>
                  {CATALOG_MODULES.map(m => {
                    const colCount = 2 + (m.approveKey ? 1 : 0) + (m.archiveKey ? 1 : 0);
                    return (
                      <th key={m.moduleKey} colSpan={colCount} className="py-1.5 px-1 border-b border-r border-gray-200 bg-gray-100/80 text-center">
                        <span className="text-[11px] font-black text-[#1A2766] uppercase tracking-wider">
                          {m.moduleName}
                        </span>
                      </th>
                    );
                  })}
                </tr>
                {/* Lower Action Header */}
                <tr className="bg-gray-50/90 border-b border-gray-200">
                  {CATALOG_MODULES.map(m => {
                    const actions = [];
                    actions.push({ key: m.createKey, label: 'Create' });
                    actions.push({ key: m.modifyKey, label: 'Modify' });
                    if (m.approveKey) actions.push({ key: m.approveKey, label: 'Approve' });
                    if (m.archiveKey) actions.push({ key: m.archiveKey, label: 'Archive' });
                    
                    return (
                      <React.Fragment key={`${m.moduleKey}-subheaders`}>
                        {actions.map((act, idx) => (
                          <th key={act.key} className={`py-1 px-1 text-[9px] font-bold text-gray-500 uppercase tracking-wider border-b min-w-[65px] ${idx === actions.length - 1 ? 'border-r' : ''}`}>
                            {act.label}
                          </th>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredUsers.map((user) => {
                  const isAdmin = user.role === 'ADMIN';

                  return (
                    <tr key={user.id} className="hover:bg-blue-50/20 transition-colors group">
                      {/* User Cell */}
                      <td className="py-1.5 px-2.5 border-b border-gray-100 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#1A2766] text-white flex items-center justify-center font-bold text-[10px] shadow-sm flex-shrink-0">
                            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-gray-900 truncate" title={user.name}>{user.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-gray-400">{formatPhone(user.mobile)}</span>
                              <span className={`text-[8px] px-1 py-0.2 rounded-full font-bold uppercase tracking-tighter ${
                                isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Module Permissions (Create / Modify / Approve per module) */}
                      {CATALOG_MODULES.map(m => {
                        const actions = [];
                        actions.push({ key: m.createKey, label: 'Create' });
                        actions.push({ key: m.modifyKey, label: 'Modify' });
                        if (m.approveKey) actions.push({ key: m.approveKey, label: 'Approve' });
                        if (m.archiveKey) actions.push({ key: m.archiveKey, label: 'Archive' });

                        return (
                          <React.Fragment key={m.moduleKey}>
                            {actions.map((act, actIdx) => {
                              const isUpdating = updatingId === `${user.id}-${act.key}`;
                              const hasPermission = !!user[act.key];

                              return (
                                <td
                                  key={act.key}
                                  className={`py-1.5 px-1 border-b border-gray-100 text-center ${
                                    actIdx === actions.length - 1 ? 'border-r border-gray-200 bg-gray-50/30' : ''
                                  }`}
                                >
                                  {isAdmin ? (
                                    <div className="flex items-center justify-center text-amber-600 font-bold text-[10px]">
                                      <Check size={12} strokeWidth={3} />
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center">
                                      <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                          type="checkbox"
                                          className="sr-only peer"
                                          checked={hasPermission}
                                          onChange={() => handleToggle(user.id, act.key, hasPermission)}
                                          disabled={isUpdating}
                                        />
                                        <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                        {isUpdating && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full">
                                            <Loader2 size={10} className="animate-spin text-[#1A2766]" />
                                          </div>
                                        )}
                                      </label>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="p-12 text-center flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
                <Tags size={20} />
              </div>
              <div>
                <p className="text-gray-900 font-bold text-xs">No Catalog-enabled users found</p>
                <p className="text-[11px] text-gray-500">Enable "Catalog & Pricing" module access for staff in the General Permissions tab first.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DISPATCH PERMISSIONS MATRIX */}
      {activeTab === 'dispatch' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden space-y-3">
          <div className="px-4 py-2 bg-blue-50/50 border-b border-blue-100 text-xs text-blue-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info size={14} className="text-blue-600 flex-shrink-0" />
              <span>
                Displaying staff members with <strong>Dispatch</strong> module access enabled. Configure granular workflow permissions for eligible users.
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
              {filteredUsers.length} Users Eligible
            </span>
          </div>

          <div className="overflow-x-auto max-h-[calc(100vh-270px)]">
            <table className="w-full border-collapse relative">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm text-center">
                {/* Upper Group Header */}
                <tr>
                  <th rowSpan={2} className="py-2 px-2.5 text-left border-b border-gray-200 min-w-[200px] bg-gray-50/95 backdrop-blur-sm sticky left-0 z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">User Details</span>
                  </th>
                  <th rowSpan={2} className="py-2 px-1 text-center border-b border-r border-gray-200 min-w-[90px] bg-blue-50/80">
                    <span className="text-[10px] font-black text-[#1A2766] uppercase tracking-tight">
                      Dispatch Access
                    </span>
                  </th>
                  {DISPATCH_PERMISSION_GROUPS.map(g => (
                    <th key={g.groupKey} colSpan={g.permissions.length} className="py-1.5 px-1 border-b border-r border-gray-200 text-center bg-gray-100/80 text-[#1A2766]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-[11px] font-black uppercase tracking-wider">
                          {g.groupName}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
                {/* Lower Action Subheader */}
                <tr className="bg-gray-50/90 border-b border-gray-200">
                  {DISPATCH_PERMISSION_GROUPS.map(g => (
                    <React.Fragment key={`${g.groupKey}-headers`}>
                      {g.permissions.map((p, idx) => (
                        <th
                          key={p.key}
                          className={`py-1 px-1 text-[9px] font-bold uppercase tracking-wider border-b min-w-[80px] ${
                            idx === g.permissions.length - 1 ? 'border-r' : ''
                          } ${p.disabled ? 'text-gray-400 bg-gray-50/40' : 'text-gray-600'}`}
                          title={p.description || p.label}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>{p.label}</span>
                            {p.disabled && (
                              <span className="text-[7px] font-bold bg-amber-100 text-amber-800 px-1 py-0.2 rounded uppercase">
                                Soon
                              </span>
                            )}
                            {p.description && (
                              <Info size={9} className="text-gray-300" />
                            )}
                          </div>
                        </th>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredUsers.map((user) => {
                  const isAdmin = user.role === 'ADMIN';

                  return (
                    <tr key={user.id} className="hover:bg-blue-50/20 transition-colors group">
                      {/* User Cell */}
                      <td className="py-1.5 px-2.5 border-b border-gray-100 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#1A2766] text-white flex items-center justify-center font-bold text-[10px] shadow-sm flex-shrink-0">
                            {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-gray-900 truncate" title={user.name}>{user.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-gray-400">{formatPhone(user.mobile)}</span>
                              <span className={`text-[8px] px-1 py-0.2 rounded-full font-bold uppercase tracking-tighter ${
                                isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {user.role}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Parent Dispatch Access Column */}
                      <td className="py-1.5 px-1 border-b border-r border-gray-200 text-center bg-blue-50/20">
                        {isAdmin ? (
                          <div className="flex items-center justify-center gap-0.5 text-amber-600 bg-amber-50 py-0.5 px-1 rounded-full mx-auto w-fit border border-amber-100">
                            <Check size={10} strokeWidth={3} />
                            <span className="text-[8px] font-black uppercase tracking-wider">Full</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={!!user.dispatch_view}
                                onChange={() => handleToggle(user.id, 'dispatch_view', !!user.dispatch_view)}
                                disabled={updatingId === `${user.id}-dispatch_view`}
                              />
                              <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                              {updatingId === `${user.id}-dispatch_view` && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full">
                                  <Loader2 size={10} className="animate-spin text-[#1A2766]" />
                                </div>
                              )}
                            </label>
                          </div>
                        )}
                      </td>

                      {/* Granular Permission Columns grouped by section */}
                      {DISPATCH_PERMISSION_GROUPS.map(g => (
                        <React.Fragment key={g.groupKey}>
                          {g.permissions.map((p, pIdx) => {
                            const isUpdating = updatingId === `${user.id}-${p.key}`;
                            const hasPermission = !!user[p.key];
                            const isLastInGroup = pIdx === g.permissions.length - 1;

                            return (
                              <td
                                key={p.key}
                                className={`py-1.5 px-1 border-b border-gray-100 text-center ${
                                  isLastInGroup ? 'border-r border-gray-200' : ''
                                } ${p.disabled ? 'bg-gray-50/50' : ''}`}
                              >
                                {isAdmin ? (
                                  <div className="flex items-center justify-center text-amber-600 font-bold text-[10px]">
                                    <Check size={12} strokeWidth={3} />
                                  </div>
                                ) : p.disabled ? (
                                  <div className="flex items-center justify-center" title={p.description || "Coming Soon - Inventory Deduction (Phase 2)"}>
                                    <div className="w-7 h-4 bg-gray-100 rounded-full border border-gray-200 relative opacity-50 cursor-not-allowed">
                                      <div className="w-3 h-3 bg-gray-300 rounded-full absolute top-[1px] left-[2px]"></div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={hasPermission}
                                        onChange={() => handleToggle(user.id, p.key, hasPermission)}
                                        disabled={isUpdating || !user.dispatch_view}
                                      />
                                      <div className={`w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 ${
                                        !user.dispatch_view ? 'opacity-40 cursor-not-allowed' : ''
                                      }`}></div>
                                      {isUpdating && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full">
                                          <Loader2 size={10} className="animate-spin text-[#1A2766]" />
                                        </div>
                                      )}
                                    </label>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="p-12 text-center flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                <Truck size={20} />
              </div>
              <div>
                <p className="text-gray-900 font-bold text-xs">No Dispatch-enabled users found</p>
                <p className="text-[11px] text-gray-500">Enable "Dispatch" module access for staff in the General Permissions tab first.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MOBILE PERMISSIONS MATRIX */}
      {activeTab === 'mobile' && (
        <div className="space-y-3">
          {/* Informational Callout */}
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-purple-900 shadow-sm">
            <Info size={16} className="text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Hold Queue Architecture Note:</span> Hold Queue uses existing Accounts/Desktop permissions (<code className="bg-purple-100 px-1 py-0.5 rounded font-mono text-[11px]">dcr_hold_release</code>, <code className="bg-purple-100 px-1 py-0.5 rounded font-mono text-[11px]">holdQueueReviewEnabled</code>, <code className="bg-purple-100 px-1 py-0.5 rounded font-mono text-[11px]">holdQueueReviewLimit</code>).
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Subheader Toolbar / Filter indicators */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50/70 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Mobile Access & Feature Matrix
                </span>
                <span className="text-[10px] text-gray-400">|</span>
                <span className="text-[10px] text-gray-500 font-medium">
                  Manage mobile modules: Stock Management, Accounts, and Dispatch
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                {stats.mobileUsers} Users with Mobile Access
              </span>
            </div>

            <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
              <table className="w-full border-collapse relative">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  {/* Top Level Section Headers */}
                  <tr className="border-b border-gray-200">
                    <th
                      rowSpan={2}
                      className="py-2 px-2.5 text-left border-b border-gray-200 min-w-[200px] bg-gray-50/95 backdrop-blur-sm sticky left-0 z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                    >
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        User Details
                      </span>
                    </th>
                    {MOBILE_PERMISSION_SECTIONS.map((sec) => {
                      const colSpan = 1 + sec.children.length;
                      const isStock = sec.sectionKey === 'stock_management';
                      const isAccounts = sec.sectionKey === 'accounts';
                      const headerBg = isStock
                        ? 'bg-amber-50/70 text-amber-900'
                        : isAccounts
                        ? 'bg-purple-50/70 text-purple-900'
                        : 'bg-blue-50/70 text-blue-900';

                      return (
                        <th
                          key={sec.sectionKey}
                          colSpan={colSpan}
                          className={`py-1.5 px-2 border-b text-center border-r border-gray-200 ${headerBg}`}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-[11px] font-black uppercase tracking-wider">
                              {sec.sectionTitle}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-white/70 border border-current">
                              {colSpan === 1 ? 'Parent' : `Parent + ${sec.children.length} Children`}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>

                  {/* Sub-header Columns */}
                  <tr className="bg-gray-50/90 border-b border-gray-200">
                    {MOBILE_PERMISSION_SECTIONS.map((sec) => (
                      <React.Fragment key={`${sec.sectionKey}-cols`}>
                        {/* Parent Toggle Column */}
                        <th
                          className="py-1 px-1.5 text-[9px] font-black uppercase tracking-wider border-b border-r border-gray-200 text-gray-800 bg-gray-100/70 min-w-[105px]"
                          title={sec.parentDescription}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[#1A2766]">● Module Access</span>
                            <Info size={9} className="text-gray-400" />
                          </div>
                        </th>
                        {/* Child Columns */}
                        {sec.children.map((child, cIdx) => (
                          <th
                            key={child.key}
                            className={`py-1 px-1.5 text-[9px] font-bold uppercase tracking-wider border-b text-gray-600 min-w-[95px] ${
                              cIdx === sec.children.length - 1 ? 'border-r border-gray-200' : ''
                            }`}
                            title={child.description}
                          >
                            <div className="flex items-center justify-center gap-0.5">
                              <span>↳ {child.label}</span>
                              <Info size={9} className="text-gray-300" />
                            </div>
                          </th>
                        ))}
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {filteredUsers.map((user) => {
                    const isAdmin = user.role === 'ADMIN';

                    return (
                      <tr key={user.id} className="hover:bg-blue-50/20 transition-colors group">
                        {/* User Cell */}
                        <td className="py-1.5 px-2.5 border-b border-gray-100 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#1A2766] text-white flex items-center justify-center font-bold text-[10px] shadow-sm flex-shrink-0">
                              {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <p className="text-xs font-bold text-gray-900 truncate" title={user.name}>{user.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-mono text-gray-400">{formatPhone(user.mobile)}</span>
                                <span className={`text-[8px] px-1 py-0.2 rounded-full font-bold uppercase tracking-tighter ${
                                  isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {user.role}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Mobile Sections Columns */}
                        {MOBILE_PERMISSION_SECTIONS.map((sec) => {
                          const parentKey = sec.parentKey;
                          const hasParent = Boolean(user[parentKey]);
                          const isParentUpdating = updatingId === `${user.id}-${parentKey}`;

                          return (
                            <React.Fragment key={`${user.id}-${sec.sectionKey}`}>
                              {/* Parent Column */}
                              <td className="py-1.5 px-1 border-b border-r border-gray-200 text-center bg-gray-50/30">
                                {isAdmin ? (
                                  <div className="flex items-center justify-center gap-0.5 text-amber-600 bg-amber-50 py-0.5 px-1 rounded-full mx-auto w-fit border border-amber-100">
                                    <Check size={10} strokeWidth={3} />
                                    <span className="text-[8px] font-black uppercase tracking-wider">Full</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={hasParent}
                                        onChange={() => handleToggle(user.id, parentKey, hasParent)}
                                        disabled={isParentUpdating}
                                      />
                                      <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#1A2766]"></div>
                                      {isParentUpdating && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full">
                                          <Loader2 size={10} className="animate-spin text-[#1A2766]" />
                                        </div>
                                      )}
                                    </label>
                                  </div>
                                )}
                              </td>

                              {/* Children Columns */}
                              {sec.children.map((child, cIdx) => {
                                const childKey = child.key;
                                const hasChild = Boolean(user[childKey]);
                                const isChildUpdating = updatingId === `${user.id}-${childKey}`;
                                const isChildDisabled = !hasParent;
                                const isLastInSec = cIdx === sec.children.length - 1;

                                return (
                                  <td
                                    key={childKey}
                                    className={`py-1.5 px-1 border-b border-gray-100 text-center ${
                                      isLastInSec ? 'border-r border-gray-200' : ''
                                    }`}
                                  >
                                    {isAdmin ? (
                                      <div className="flex items-center justify-center text-amber-600 font-bold text-[10px]">
                                        <Check size={12} strokeWidth={3} />
                                      </div>
                                    ) : (
                                      <div
                                        className="flex items-center justify-center"
                                        title={isChildDisabled ? `Enable ${sec.parentLabel} parent access first` : ''}
                                      >
                                        <label className={`relative inline-flex items-center ${isChildDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                          <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={hasChild}
                                            onChange={() => handleToggle(user.id, childKey, hasChild)}
                                            disabled={isChildUpdating || isChildDisabled}
                                          />
                                          <div className={`w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500 ${
                                            isChildDisabled ? 'opacity-30' : ''
                                          }`}></div>
                                          {isChildUpdating && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full">
                                              <Loader2 size={10} className="animate-spin text-[#1A2766]" />
                                            </div>
                                          )}
                                        </label>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredUsers.length === 0 && (
              <div className="p-12 text-center flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
                <div>
                  <p className="text-gray-900 font-bold text-xs">No users found</p>
                  <p className="text-[11px] text-gray-500">Try adjusting your search query or role filter.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
