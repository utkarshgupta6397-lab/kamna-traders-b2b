import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import FilesTabClient from './FilesTabClient';

export default async function FilesTab({ params }: { params: { id: string } }) {
  const { id } = await params;
  const session = await getSession();

  const files = await prisma.solarOrderFile.findMany({
    where: { solarOrderId: id, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: { select: { name: true } }
    }
  });

  const canUpload = session?.role === 'ADMIN' || session?.solar_orders_view;

  return (
    <div className="space-y-4">
      <FilesTabClient orderId={id} files={files} canUpload={!!canUpload} />
    </div>
  );
}
