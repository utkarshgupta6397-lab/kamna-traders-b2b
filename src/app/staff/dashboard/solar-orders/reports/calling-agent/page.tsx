import { prisma } from '@/lib/db';
import CallingAgentReportClient from './CallingAgentReportClient';

export default async function CallingAgentReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Fetch users for filter (for Phase 1, just grabbing all active users)
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    where: { active: true },
  });

  const agentUsers = allUsers.map(u => ({ value: u.id, label: u.name }));

  return <CallingAgentReportClient users={agentUsers} />;
}
