'use client';

import { useState, useEffect } from 'react';
import { Quote } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getHourlyQuote, MotivationalQuote } from '@/utils/quotes';

export default function MotivationalQuoteBanner() {
  const [mounted, setMounted] = useState(false);
  const [quoteData, setQuoteData] = useState<MotivationalQuote>(() => getHourlyQuote());

  useEffect(() => {
    setMounted(true);

    const updateQuote = () => {
      setQuoteData(getHourlyQuote());
    };

    updateQuote();

    // Check once every minute to see if the hour has changed
    const timer = setInterval(() => {
      const current = getHourlyQuote();
      setQuoteData((prev) => {
        if (prev.quote !== current.quote || prev.author !== current.author) {
          return current;
        }
        return prev;
      });
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-xl border border-blue-100/80 bg-gradient-to-r from-blue-50/70 via-white to-indigo-50/60 px-4 py-2.5 shadow-2xs shrink-0">
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Left: Large quote icon */}
        <div className="w-8 h-8 rounded-lg bg-[#1A2766]/10 border border-[#1A2766]/15 flex items-center justify-center text-[#1A2766] shrink-0">
          <Quote size={16} className="text-[#1A2766]" />
        </div>

        {/* Center & Right: Label, Quote text, and Author */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#1A2766]/80 mb-0.5">
            Today&apos;s Motivation
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={quoteData.quote}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex items-baseline justify-between gap-3 flex-wrap lg:flex-nowrap"
            >
              <div className="text-sm lg:text-[14.5px] font-semibold text-slate-800 italic leading-snug truncate">
                &ldquo;{quoteData.quote}&rdquo;
              </div>
              <div className="text-xs font-bold text-slate-600 not-italic shrink-0 tracking-tight whitespace-nowrap">
                — {quoteData.author}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
