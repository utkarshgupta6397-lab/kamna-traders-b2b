import { prisma } from '@/lib/db';
import { format } from 'date-fns';
import { Activity } from 'lucide-react';

export default async function TimelineTab({ params }: { params: { id: string } }) {
  const { id } = await params;

  const logs = await prisma.solarActivityLog.findMany({
    where: { solarOrderId: id },
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { name: true } } },
  });

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-6">Order Timeline & Activity</h2>
      
      {logs.length === 0 ? (
        <p className="text-gray-500 italic">No activity recorded yet.</p>
      ) : (
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
          {logs.map((log) => (
            <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${
                log.eventType === 'ORDER_APPROVED' ? 'bg-green-100 text-green-600' :
                log.eventType === 'ORDER_REJECTED' ? 'bg-red-100 text-red-600' :
                'bg-slate-200 text-slate-500'
              }`}>
                <Activity size={16} />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-bold ${
                    log.eventType === 'ORDER_APPROVED' ? 'text-green-700' :
                    log.eventType === 'ORDER_REJECTED' ? 'text-red-700' :
                    'text-slate-900'
                  }`}>
                    {log.eventType.replace('_', ' ')}
                  </span>
                  <time className="font-medium text-xs text-slate-500">{format(new Date(log.createdAt), 'MMM d, h:mm a')}</time>
                </div>
                <div className="text-slate-500 text-sm">{log.description}</div>
                <div className="text-slate-400 text-xs mt-2 text-right">
                  — {log.actor?.name || (log.actorName && log.actorName !== 'Staff' ? log.actorName : 'Unknown User')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
