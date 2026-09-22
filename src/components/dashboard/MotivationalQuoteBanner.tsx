'use client';

import { useState, useEffect } from 'react';
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

  const isGita = quoteData.displayMode === 'GITA';

  return (
    <div className="relative w-full rounded-none border-t border-b-0 border-x-0 border-blue-100/70 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/40 px-6 py-2.5 sm:py-3 shadow-xs shrink-0 text-center overflow-hidden">
      {/* Centered Compact Quote Composition Container with readable max-width */}
      <div className="max-w-[1000px] mx-auto flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={quoteData.id || quoteData.quote}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center w-full"
          >
            {isGita ? (
              /* Bhagavad Gita Centered Compact Presentation (no category heading) */
              <div className="flex flex-col items-center">
                {/* Large centered Sanskrit/Devanagari shloka */}
                <h2 className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-bold text-slate-800 tracking-wide font-sans leading-snug text-center">
                  &ldquo;{quoteData.quote}&rdquo;
                </h2>
                {/* Smaller muted centered English meaning */}
                {quoteData.englishMeaning && (
                  <p className="text-xs sm:text-[13px] text-slate-500 font-normal leading-snug max-w-[860px] text-center italic mt-0.5">
                    {quoteData.englishMeaning}
                  </p>
                )}
                {/* Centered Chapter/Verse attribution */}
                <div className="text-[11px] sm:text-xs font-semibold text-slate-600 not-italic tracking-tight mt-1">
                  — भगवद्गीता · अध्याय {quoteData.chapter}, श्लोक {quoteData.verse}
                </div>
              </div>
            ) : (
              /* Standard Centered Compact Quote Presentation (no category heading) */
              <div className="flex flex-col items-center">
                {/* Large, prominent centered quote */}
                <h2 className="text-base sm:text-lg lg:text-xl xl:text-[22px] font-bold text-slate-800 italic leading-snug tracking-tight text-center">
                  &ldquo;{quoteData.quote}&rdquo;
                </h2>
                {/* Centered author attribution directly below */}
                <div className="text-xs sm:text-[13px] font-medium text-slate-500 not-italic tracking-normal mt-1">
                  — <span className="font-semibold text-slate-700">{quoteData.author}</span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
