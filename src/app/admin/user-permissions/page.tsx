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
  canRunSkuSync: boolean;
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#1A2766]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1A2766] uppercase tracking-tight flex items-center gap-3">
            <Lock size={28} />
            User Permissions
          </h1>
          <p className="text-sm text-gray-500 font-medium">Manage operational access rights for staff members</p>
        </div>
      </div>

      {/* Summary Cards - Simplified */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Admin', value: stats.admins, icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Staff', value: stats.staff, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((card) => (
          <div key={card.label} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
              <card.icon size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{card.label}</p>
              <p className="text-lg font-black text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#1A2766]/10 focus:border-[#1A2766] transition-all text-sm"
          />
        </div>
        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
          {(['ALL', 'ADMIN', 'STAFF'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                roleFilter === role 
                  ? 'bg-[#1A2766] text-white shadow-md' 
                  : 'text-gray-500 hover:text-[#1A2766]'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Simplified List Table */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-[#F8FAFC]">
            <tr>
              <th className="p-4 text-left border-b border-gray-200 min-w-[240px]">
                <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">User Details</span>
              </th>
              {PERMISSIONS.map(p => (
                <th key={p.key} className="p-4 text-center border-b border-gray-200 min-w-[160px]">
                  <div className="flex flex-col items-center gap-1 group cursor-help">
                    <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">{p.label}</span>
                    {p.description && (
                      <div className="relative">
                        <Info size={12} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl z-50 pointer-events-none normal-case font-medium">
                          {p.description}
                        </div>
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const isAdmin = user.role === 'ADMIN';
              
              return (
                <tr key={user.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1A2766] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{user.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono text-gray-500">{formatPhone(user.mobile)}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter ${
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
                      <td key={p.key} className="p-4 border-b border-gray-100 text-center">
                        {isAdmin ? (
                          <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 py-1.5 px-3 rounded-full mx-auto w-fit">
                            <Check size={14} strokeWidth={3} />
                            <span className="text-[10px] font-black uppercase tracking-wider">Full Access</span>
                          </div>
                        ) : (
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={hasPermission}
                              onChange={() => handleToggle(user.id, p.key, hasPermission)}
                              disabled={isUpdating}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1A2766]/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                            {isUpdating && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full">
                                <Loader2 size={12} className="animate-spin text-[#1A2766]" />
                              </div>
                            )}
                          </label>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredUsers.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
              <Search size={32} />
            </div>
            <div>
              <p className="text-gray-900 font-bold">No users found</p>
              <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
