import { prisma } from '@/lib/db';
import { revokeSession, clearStaleSessions } from './actions';
import { Shield, Smartphone, Monitor, Trash2, Clock, Globe, User as UserIcon } from 'lucide-react';
import ActionForm, { FormSubmit } from '@/components/ActionForm';

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1'));
  const perPage = 20;

  const [sessions, total] = await Promise.all([
    prisma.activeSession.findMany({
      include: { user: true },
      orderBy: { lastSeenAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.activeSession.count(),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Active Sessions ({total})</h1>
          <p className="text-sm text-gray-500">Manage parallel logins and device sessions.</p>
        </div>
        <ActionForm action={clearStaleSessions} successMessage="Stale sessions cleared">
          <FormSubmit className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg border flex items-center gap-1.5">
            <Clock size={14} /> Cleanup Stale
          </FormSubmit>
        </ActionForm>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* Header */}
          <div className="flex bg-gray-50 border-b text-gray-500 uppercase tracking-wider text-[10px] font-bold">
            <div className="w-48 p-4">User</div>
            <div className="w-32 p-4">Device Type</div>
            <div className="w-48 p-4">IP Address</div>
            <div className="w-64 p-4">Last Active</div>
            <div className="flex-1 p-4 text-right">Action</div>
          </div>

          {/* Body */}
          <div className="divide-y divide-gray-50 text-gray-700">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center hover:bg-gray-50/50 transition-colors">
                {/* User */}
                <div className="w-48 p-4 flex items-center gap-2.5">
                  <div className="bg-blue-50 p-2 rounded-lg text-[#1A2766]">
                    <UserIcon size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{s.user.name}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{s.user.mobile}</div>
                  </div>
                </div>

                {/* Device */}
                <div className="w-32 p-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                    s.deviceType === 'mobile' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {s.deviceType === 'mobile' ? <Smartphone size={10} /> : <Monitor size={10} />}
                    {s.deviceType}
                  </span>
                </div>

                {/* Network */}
                <div className="w-48 p-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Globe size={12} className="text-gray-400" />
                    {s.ipAddress || 'Unknown'}
                  </div>
                  <div className="text-[9px] text-gray-400 truncate max-w-[180px]" title={s.userAgent || ''}>
                    {s.userAgent}
                  </div>
                </div>

                {/* Time */}
                <div className="w-64 p-4">
                  <div className="text-xs text-gray-600">
                    {new Date(s.lastSeenAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Started: {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Revoke */}
                <div className="flex-1 p-4 flex justify-end">
                  <ActionForm action={revokeSession} successMessage="Session revoked">
                    <input type="hidden" name="sessionToken" value={s.sessionToken} />
                    <FormSubmit 
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      icon={<Trash2 size={16} />}
                    />
                  </ActionForm>
                </div>
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="p-12 text-center">
                <Shield size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm italic">No active sessions found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t bg-gray-50/50">
            {Array.from({ length: totalPages }, (_, i) => (
              <a
                key={i}
                href={`/admin/sessions?page=${i + 1}`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  page === i + 1 ? 'bg-[#1A2766] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border'
                }`}
              >
                {i + 1}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
