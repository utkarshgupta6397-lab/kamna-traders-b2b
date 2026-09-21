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
    <div className="relative rounded-2xl border border-blue-100/70 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/40 px-6 py-4 xl:py-5 shadow-xs shrink-0 text-center overflow-hidden">
      {/* Centered Quote Composition Container with readable max-width */}
      <div className="max-w-[960px] mx-auto flex flex-col items-center justify-center">
        {/* Subtle Category Pill / Minimal Label */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1A2766]/5 border border-[#1A2766]/10 text-[10px] font-bold uppercase tracking-widest text-[#1A2766] mb-2">
          <span>{isGita ? 'Bhagavad Gita' : "Today's Motivation"}</span>
          {isGita && quoteData.chapter && quoteData.verse && (
            <span className="text-[#1A2766]/60">
              · अध्याय {quoteData.chapter}, श्लोक {quoteData.verse}
            </span>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={quoteData.id || quoteData.quote}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex flex-col items-center justify-center w-full"
          >
            {isGita ? (
              /* Bhagavad Gita Centered Presentation */
              <div className="flex flex-col items-center gap-1.5 my-0.5">
                {/* Large centered Sanskrit/Devanagari shloka */}
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800 tracking-wide font-sans leading-relaxed text-center">
                  &ldquo;{quoteData.quote}&rdquo;
                </h2>
                {/* Smaller muted centered English meaning */}
                {quoteData.englishMeaning && (
                  <p className="text-xs sm:text-sm text-slate-500 font-normal leading-normal max-w-[840px] text-center italic mt-0.5">
                    {quoteData.englishMeaning}
                  </p>
                )}
                {/* Centered Chapter/Verse attribution */}
                <div className="text-xs sm:text-sm font-semibold text-slate-600 not-italic tracking-tight mt-1.5">
                  — भगवद्गीता · अध्याय {quoteData.chapter}, श्लोक {quoteData.verse}
                </div>
              </div>
            ) : (
              /* Standard Centered Quote Presentation */
              <div className="flex flex-col items-center gap-1.5 my-0.5">
                {/* Large, prominent centered quote */}
                <h2 className="text-lg sm:text-xl lg:text-2xl xl:text-[26px] font-bold text-slate-800 italic leading-snug tracking-tight text-center">
                  &ldquo;{quoteData.quote}&rdquo;
                </h2>
                {/* Centered author attribution */}
                <div className="text-xs sm:text-sm font-medium text-slate-500 not-italic tracking-normal mt-1">
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
