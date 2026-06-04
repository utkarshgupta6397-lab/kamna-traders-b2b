import PendingSerialsClient from './PendingSerialsClient';

export const metadata = {
  title: 'Pending Serials | Kamna Traders B2B ERP',
  description: 'Manage and allocate serial numbers against approved DCR invoices.',
};

export default function PendingSerialsPage() {
  return <PendingSerialsClient />;
}
