import { prisma } from '@/lib/db';
import { CommunicationChannel, CommunicationDirection, CommunicationType, CommunicationStatus } from '@prisma/client';

export interface CreateCommunicationParams {
  customerId: string;
  solarOrderId?: string;
  invoiceId?: string;
  dcrInvoiceId?: string;
  relatedRecord?: string;
  relatedRecordType?: string;
  relatedRecordId?: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  type: CommunicationType;
  subject?: string;
  body: string;
  fromAddress?: string;
  fromName?: string;
  toAddress?: string;
  templateId?: string;
  templateName?: string;
  templateLanguage?: string;
  templateCategory?: string;
  variablesJson?: any;
  headerType?: string;
  headerMediaUrl?: string;
  footer?: string;
  buttonsJson?: any;
  providerName?: string;
  providerMessageId?: string;
  providerResponse?: any;
  createdById: string;
  assignedToUserId?: string;
  customerName?: string;
  metadata?: any;
}

export class CommunicationService {
  /**
   * Creates a communication record directly with a specific status.
   */
  static async createCommunication(params: CreateCommunicationParams, status: CommunicationStatus = CommunicationStatus.DRAFT) {
    return prisma.communication.create({
      data: {
        ...params,
        status,
      }
    });
  }



  /**
   * Updates the status of a communication record.
   */
  static async updateStatus(id: string, status: CommunicationStatus, errorMessage?: string, providerMessageId?: string, providerResponse?: any) {
    const data: any = { status };
    
    if (errorMessage !== undefined) data.errorMessage = errorMessage;
    if (providerMessageId !== undefined) data.providerMessageId = providerMessageId;
    if (providerResponse !== undefined) data.providerResponse = providerResponse;

    if (status === CommunicationStatus.API_ACCEPTED) data.apiAcceptedAt = new Date();
    if (status === CommunicationStatus.SENT) data.sentAt = new Date();
    if (status === CommunicationStatus.DELIVERED) data.deliveredAt = new Date();
    if (status === CommunicationStatus.READ) data.readAt = new Date();
    if (status === CommunicationStatus.FAILED) data.failedAt = new Date();

    return prisma.communication.update({
      where: { id },
      data
    });
  }

  /**
   * Attaches a document to a communication record.
   */
  static async attachDocument(communicationId: string, attachment: { fileName: string; mimeType: string; url: string; size?: number }) {
    return prisma.communicationAttachment.create({
      data: {
        communicationId,
        ...attachment
      }
    });
  }
}
