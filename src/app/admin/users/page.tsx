import { PrismaClient } from '@prisma/client';
import { createUser, updateUser, deleteUser } from '../actions';
import { Trash2, Save } from 'lucide-react';
import SafeDeleteButton from '@/components/SafeDeleteButton';
import ActionForm from '@/components/ActionForm';
import ResetPinButton from '@/components/ResetPinButton';

const prisma = new PrismaClient();

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1'));
  const perPage = 20;
  const [users, total] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
    prisma.user.count(),
  ]);
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Users ({total})</h1>

      {/* Add */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold mb-3 text-gray-600 uppercase tracking-wider">Add New User</h2>
        <ActionForm action={createUser} successMessage="User created!" resetOnSuccess className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input type="text" name="name" required className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Mobile</label>
            <input type="text" name="mobile" required className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" maxLength={10} /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
            <select name="role" className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#1A2766] outline-none">
              <option value="STAFF">Staff</option><option value="ADMIN">Admin</option>
            </select></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">PIN (6-digit)</label>
            <input type="text" name="pin" maxLength={6} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none" placeholder="Auto if empty" /></div>
          <button type="submit" className="bg-[#AE1B1E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-800 transition-colors">Add User</button>
        </ActionForm>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="flex bg-gray-50 border-b text-gray-500 uppercase tracking-wider text-xs font-medium">
            <div className="w-48 p-3">Name</div>
            <div className="w-40 p-3">Mobile</div>
            <div className="w-32 p-3">PIN</div>
            <div className="w-32 p-3">Role</div>
            <div className="w-32 p-3">Status</div>
            <div className="flex-1 p-3 text-right">Actions</div>
          </div>
          
          {/* Body */}
          <div className="divide-y divide-gray-50 text-gray-700">
            {users.map(u => (
              <ActionForm key={u.id} action={updateUser} successMessage="User updated" className="flex items-center hover:bg-gray-50/50 transition-colors">
                <input type="hidden" name="id" value={u.id} />
                <div className="w-48 p-2">
                  <input type="text" name="name" defaultValue={u.name} className="w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#1A2766] outline-none" />
                </div>
                <div className="w-40 p-2">
                  <input type="text" name="mobile" defaultValue={u.mobile} className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-[#1A2766] outline-none" maxLength={10} />
                </div>
                <div className="w-32 p-2 flex gap-1 items-center">
                  <input type="text" name="pin" defaultValue="" className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-[#1A2766] outline-none" maxLength={6} placeholder="••••••" />
                  <ResetPinButton mobile={u.mobile} />
                </div>
                <div className="w-32 p-2">
                  <select name="role" defaultValue={u.role} className="w-full border rounded px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#1A2766] outline-none">
                    <option value="STAFF">Staff</option><option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="w-32 p-2">
                  <select name="active" defaultValue={String(u.active)} className="w-full border rounded px-2 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#1A2766] outline-none">
                    <option value="true">Active</option><option value="false">Inactive</option>
                  </select>
                </div>
                <div className="flex-1 p-2 flex justify-end items-center gap-1">
                  <button type="submit" className="text-[#1A2766] hover:bg-blue-50 p-1.5 rounded transition-colors" title="Save">
                    <Save size={14} />
                  </button>
                  <SafeDeleteButton action={deleteUser} id={u.id} label="user" className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors">
                    <Trash2 size={14} />
                  </SafeDeleteButton>
                </div>
              </ActionForm>
            ))}
            {users.length === 0 && <div className="p-8 text-center text-gray-400">No users found.</div>}
          </div>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-3 border-t">
            {Array.from({ length: totalPages }, (_, i) => (
              <a key={i} href={`/admin/users?page=${i + 1}`} className={`px-3 py-1 rounded text-xs font-medium ${page === i + 1 ? 'bg-[#1A2766] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{i + 1}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
