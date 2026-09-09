import { PrismaClient, Prisma } from '@prisma/client';

export interface RecordPostDispatchHistoryParams {
  invoiceId: string;
  workflowType?: string | null;
  eventType: string;
  userId?: string | null;
  userName?: string | null;
  submissionId?: string | null;
  rejectionReason?: string | null;
  metadata?: any;
}

/**
 * Centrally and immutably records a Post Dispatch Workflow History event.
 * Ensures zero secrets or tokens are stored in metadata.
 */
export async function recordPostDispatchHistory(
  client: Prisma.TransactionClient | PrismaClient,
  params: RecordPostDispatchHistoryParams
) {
  let resolvedUserName = params.userName;

  if (!resolvedUserName && params.userId) {
    try {
      const user = await (client as PrismaClient).user.findUnique({
        where: { id: params.userId },
        select: { name: true },
      });
      resolvedUserName = user?.name || 'Staff';
    } catch {
      resolvedUserName = 'Staff';
    }
  }

  // Sanitize metadata to never store secrets or file data
  let cleanMetadata: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput = Prisma.JsonNull;
  if (params.metadata && typeof params.metadata === 'object') {
    const copy = { ...(params.metadata as Record<string, unknown>) };
    delete copy.token;
    delete copy.accessToken;
    delete copy.refreshToken;
    delete copy.secret;
    delete copy.buffer;
    delete copy.fileContent;
    delete copy.base64;
    cleanMetadata = copy as Prisma.InputJsonObject;
  }

  return (client as PrismaClient).postDispatchHistory.create({
    data: {
      invoiceId: params.invoiceId,
      workflowType: params.workflowType || null,
      eventType: params.eventType,
      userId: params.userId || null,
      userName: resolvedUserName || null,
      submissionId: params.submissionId || null,
      rejectionReason: params.rejectionReason || null,
      metadata: cleanMetadata,
    },
  });
}
