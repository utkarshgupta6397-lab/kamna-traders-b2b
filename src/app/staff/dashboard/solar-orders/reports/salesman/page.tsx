import { prisma } from '@/lib/db';
import SalesmanReportClient from './SalesmanReportClient';

export default async function SalesmanReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Fetch users for filter
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    where: { active: true },
  });

  const salesmanUsers = allUsers.map(u => ({ value: u.id, label: u.name }));

  return <SalesmanReportClient users={salesmanUsers} />;
}
