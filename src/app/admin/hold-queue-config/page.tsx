'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  mobile: string;
  role: string;
  dcr_hold_release: boolean | null;
  holdQueueReviewEnabled: boolean | null;
  holdQueueReviewLimit: number | null;
  [key: string]: any;
}

export default function HoldQueueConfigPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
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

  const handleUpdate = async (userId: string, key: 'holdQueueReviewEnabled' | 'holdQueueReviewLimit', value: any) => {
    setUpdatingId(`${userId}-${key}`);
    try {
      const res = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error('Update failed');
      
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [key]: value } : u));
      toast.success('Configuration updated');
    } catch (err) {
      toast.error('Failed to update configuration');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (u.mobile || '').includes(searchQuery);
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#1A2766]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="text-blue-600" size={24} />
              Hold Queue Configuration
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Configure which staff members can review customers in the Hold Queue and define their maximum outstanding review limits.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 transition-all"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Hold Queue Status</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Can Review</th>
                <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">Limit Config</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map(user => {
                const isAdmin = user.role === 'ADMIN';
                const hasAccess = isAdmin || !!user.dcr_hold_release;
                const canEdit = hasAccess && !isAdmin; // Admins are implicitly unlimited and read-only here

                return (
                  <tr key={user.id} className={`hover:bg-blue-50/30 transition-colors ${!hasAccess ? 'opacity-60 bg-gray-50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">{user.mobile}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide
                        ${user.role === 'ADMIN' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {hasAccess ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <CheckCircle size={14} /> Has Access
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                          <XCircle size={14} /> No Access
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {isAdmin ? (
                        <span className="text-xs font-bold text-amber-600">Admin (Yes)</span>
                      ) : !hasAccess ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!user.holdQueueReviewEnabled}
                            onChange={(e) => handleUpdate(user.id, 'holdQueueReviewEnabled', e.target.checked)}
                            disabled={updatingId === `${user.id}-holdQueueReviewEnabled`}
                          />
                          <div className="w-8 h-4.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3.5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {isAdmin ? (
                        <div className="text-center text-xs font-bold text-amber-600">Unlimited</div>
                      ) : !hasAccess ? (
                        <div className="text-center text-xs text-gray-400">—</div>
                      ) : (
                        <div className="flex items-center justify-center gap-4">
                          {/* Unlimited Toggle */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 font-medium">Unlimited</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={user.holdQueueReviewLimit === null}
                                onChange={(e) => handleUpdate(user.id, 'holdQueueReviewLimit', e.target.checked ? null : 10000)}
                                disabled={updatingId === `${user.id}-holdQueueReviewLimit` || !user.holdQueueReviewEnabled}
                              />
                              <div className={`w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-3 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500 ${!user.holdQueueReviewEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                            </label>
                          </div>
                          
                          {/* Limit Input */}
                          <div className={`flex items-center gap-1 transition-opacity ${user.holdQueueReviewLimit === null || !user.holdQueueReviewEnabled ? 'opacity-30 pointer-events-none' : ''}`}>
                            <span className="text-xs font-medium text-gray-500">₹</span>
                            <input
                              type="number"
                              value={user.holdQueueReviewLimit || ''}
                              onChange={(e) => {
                                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, holdQueueReviewLimit: parseFloat(e.target.value) || 0 } : u));
                              }}
                              onBlur={(e) => {
                                handleUpdate(user.id, 'holdQueueReviewLimit', parseFloat(e.target.value) || 0);
                              }}
                              className="w-24 text-xs p-1.5 border border-gray-200 rounded outline-none focus:border-blue-400"
                              placeholder="Amount"
                            />
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
