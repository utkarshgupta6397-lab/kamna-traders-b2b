import IncomingQueueClient from './IncomingQueueClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Incoming Orders | Dispatch | KAMNA ERP',
};

export default function IncomingQueuePage() {
  return <IncomingQueueClient />;
}
