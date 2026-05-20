'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Shield, Users, Lock, Loader2, Info, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { PERMISSIONS, PermissionKey } from '@/lib/permissions';

interface User {
  id: string;
  name: string;
  mobile: string;
  role: string;
  canManageCarts: boolean;
  canAdjustInventory: boolean;
  canManageTransfers: boolean;
  canDeleteTransfers: boolean;
  [key: string]: any;
}


export default function UserPermissionsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
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
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, [key]: newValue } : u));
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

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           u.mobile.includes(searchQuery);
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter(u => u.role === 'ADMIN').length,
      staff: users.filter(u => u.role === 'STAFF').length,
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
    <div className="space-y-3 w-full max-w-screen-2xl mx-auto px-4 pb-8 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#1A2766] uppercase tracking-tight flex items-center gap-2 leading-none">
            <Lock size={20} />
            User Permissions
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage operational access rights for staff members</p>
        </div>
      </div>

      {/* Summary Cards - High Density */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Admin', value: stats.admins, icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Staff', value: stats.staff, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
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

      {/* Compressed Toolbar */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search by name or phone..."
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

      {/* Simplified List Table - High Density */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-200px)]">
          <table className="w-full border-collapse relative">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-2 px-2.5 text-left border-b border-gray-200 min-w-[180px] bg-gray-50/95 backdrop-blur-sm">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">User Details</span>
                </th>
                {PERMISSIONS.map(p => (
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
                    <td className="py-1.5 px-2.5 border-b border-gray-100">
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

                    {PERMISSIONS.map(p => {
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
    </div>
  );
}
