import { cache } from 'react';
import { prisma } from '@/lib/db';

export const fetchOrderWithDetails = cache(async (id: string) => {
  return prisma.solarOrder.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      salesman: { select: { name: true } },
      callingExecutive: { select: { name: true } },
      approvedBy: { select: { name: true } },
      subVendor: { select: { name: true } },
      panels: { orderBy: { orderIndex: 'asc' } },
      inverters: { orderBy: { orderIndex: 'asc' } },
      files: { where: { fileCategory: 'SITE_IMAGE', isDeleted: false } },
    }
  });
});
