'use client';

import { useState } from 'react';

interface Props {
  action: (id: string) => Promise<void>;
  id: string;
  label?: string;
  className?: string;
  children: React.ReactNode;
}

export default function SafeDeleteButton({ action, id, label = 'Delete', className, children }: Props) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete this ${label}?`)) return;
    setLoading(true);
    setError('');
    try {
      await action(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cannot delete — item is in use');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button onClick={handleDelete} disabled={loading} className={className}>
        {children}
      </button>
      {error && <span className="text-[10px] text-red-500 max-w-[150px] leading-tight">{error}</span>}
    </div>
  );
}
