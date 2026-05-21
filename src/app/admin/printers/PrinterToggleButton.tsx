'use client';

import { useTransition } from 'react';
import { Power, PowerOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

type Props = {
  printerId: string;
  enabled: boolean;
  action: (id: string, enabled: boolean) => Promise<void>;
};

export default function PrinterToggleButton({ printerId, enabled, action }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleToggle = () => {
    startTransition(async () => {
      try {
        await action(printerId, !enabled);
        toast.success(enabled ? 'Printer disabled' : 'Printer enabled');
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update printer');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      title={enabled ? 'Disable printer' : 'Enable printer'}
      className={`p-1.5 rounded transition-colors disabled:opacity-50 ${
        enabled
          ? 'text-emerald-600 hover:bg-emerald-50'
          : 'text-gray-400 hover:bg-gray-100'
      }`}
    >
      {enabled ? <Power size={14} /> : <PowerOff size={14} />}
    </button>
  );
}
