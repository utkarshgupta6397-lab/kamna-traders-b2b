export interface ChatMessageShape {
  id: string;
  message: string;
  createdAt: string;
  createdById: string;
  createdBy: {
    name: string;
  };
  status?: 'sending' | 'failed' | 'sent';
}
