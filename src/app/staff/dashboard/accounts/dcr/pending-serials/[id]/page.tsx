import AllocateSerialsClient from './AllocateSerialsClient';

export const metadata = {
  title: 'Allocate Serials | Kamna Traders B2B ERP',
  description: 'Allocate DCR serial numbers for invoice items.',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AllocatePage({ params }: PageProps) {
  const { id } = await params;
  return <AllocateSerialsClient invoiceId={id} />;
}
