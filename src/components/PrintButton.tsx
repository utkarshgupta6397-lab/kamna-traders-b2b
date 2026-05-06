'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

interface Props {
  auto?: boolean;
}

export default function PrintButton({ auto }: Props) {
  const router = useRouter();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (auto && !hasTriggered.current) {
      hasTriggered.current = true;
      
      // Ensure the DOM is fully settled and all assets (like QR codes) are visible
      const triggerPrint = () => {
        // Remove the autoprint flag from the URL to "consume" the state
        // and prevent repeat triggers on manual refresh.
        const url = new URL(window.location.href);
        url.searchParams.delete('autoprint');
        router.replace(url.pathname + url.search, { scroll: false });

        // Trigger the print dialog
        window.print();
      };

      // requestAnimationFrame ensures we run after the next paint
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          triggerPrint();
        });
      }, 800); // Slightly longer timeout for thermal print stabilization

      return () => clearTimeout(timer);
    }
  }, [auto, router]);

  return (
    <button 
      className="bg-[#AE1B1E] text-white px-4 py-2 rounded font-medium text-sm hover:bg-red-800 transition-colors"
      onClick={() => window.print()}
    >
      Print Slips
    </button>
  );
}
