import { PrismaClient, Prisma } from '@prisma/client';

export interface RecordDispatchHistoryParams {
  dispatchOrderId: string;
  userId: string;
  userName?: string | null;
  action: string;
  fromStage: string;
  toStage: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Centrally and immutably records a Dispatch Workflow History event.
 * When passed a Prisma transaction client (tx), execution is atomic
 * with the workflow state mutation.
 */
export async function recordDispatchWorkflowHistory(
  client: Prisma.TransactionClient | PrismaClient,
  params: RecordDispatchHistoryParams
) {
  let resolvedUserName = params.userName;

  if (!resolvedUserName && params.userId) {
    try {
      const user = await (client as PrismaClient).user.findUnique({
        where: { id: params.userId },
        select: { name: true }
      });
      resolvedUserName = user?.name || 'Staff';
    } catch {
      resolvedUserName = 'Staff';
    }
  }

  return (client as unknown as { dispatchWorkflowHistory: Prisma.DispatchWorkflowHistoryDelegate }).dispatchWorkflowHistory.create({
    data: {
      dispatchOrderId: params.dispatchOrderId,
      userId: params.userId,
      userName: resolvedUserName || 'Staff',
      action: params.action,
      fromStage: params.fromStage,
      toStage: params.toStage,
      metadata: params.metadata !== undefined ? params.metadata : Prisma.JsonNull,
    },
  });
}
