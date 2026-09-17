/**
 * Browser Voice Notification Utility
 *
 * Provides non-blocking, client-side spoken announcements for successful ERP operations
 * using the Web Speech API (`window.speechSynthesis`).
 *
 * Configured Voice Profile:
 * - Volume: 0.4
 * - Rate: 0.95
 * - Pitch: 1.0
 * - Language: "en-IN" (falls back gracefully to browser default)
 */

export interface VoiceNotificationOptions {
  volume?: number;
  rate?: number;
  pitch?: number;
  lang?: string;
}

const DEFAULT_VOICE_OPTIONS: Required<VoiceNotificationOptions> = {
  volume: 0.4,
  rate: 1.2,
  pitch: 1.0,
  lang: 'en-IN',
};

/**
 * Clean and normalize names/phrases for speech synthesis.
 * Strips superfluous whitespace, punctuation glitches, or undefined values.
 */
export function sanitizeSpokenText(text: string | null | undefined, fallback = 'Customer'): string {
  if (!text || typeof text !== 'string') return fallback;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed || fallback;
}

// Chromium bug workaround: Keep reference to active utterance in module/window scope
// so it is not garbage-collected before onstart/onend fires.
let activeUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Generic voice notification player.
 * Safe for SSR (no-ops when window/speechSynthesis is undefined).
 * Cancels prior queued utterances so rapid triggers do not queue up.
 */
export function speakVoiceNotification(
  message: string,
  options?: VoiceNotificationOptions
): void {
  // 1. SSR & Browser capability guards
  if (typeof window === 'undefined') {
    console.log('[VOICE DEBUG] speakVoiceNotification called on SSR (window undefined)');
    return;
  }
  const hasSynth = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  console.log(`[VOICE DEBUG] speechSynthesis available = ${hasSynth}`);
  if (!hasSynth) return;

  const cleanMessage = sanitizeSpokenText(message, '');
  if (!cleanMessage) {
    console.log('[VOICE DEBUG] cleanMessage is empty, skipping');
    return;
  }

  try {
    const synth = window.speechSynthesis;

    // 2. Resume if paused
    if (synth.paused) {
      synth.resume();
    }

    // 3. Clear existing speech
    const isBusy = synth.speaking || synth.pending;
    synth.cancel();

    // Workaround for Chrome/WebKit bug: defer speak execution by 100ms when cancel() is invoked
    // so the cancellation doesn't kill the new utterance before it starts.
    const startSpeaking = () => {
      try {
        if (synth.paused) {
          synth.resume();
        }

        const utterance = new SpeechSynthesisUtterance(cleanMessage);
        const volume = options?.volume ?? DEFAULT_VOICE_OPTIONS.volume;
        const rate = options?.rate ?? DEFAULT_VOICE_OPTIONS.rate;
        const pitch = options?.pitch ?? DEFAULT_VOICE_OPTIONS.pitch;
        const lang = options?.lang ?? DEFAULT_VOICE_OPTIONS.lang;

        utterance.volume = volume;
        utterance.rate = rate;
        utterance.pitch = pitch;
        utterance.lang = lang;

        console.log(`[VOICE DEBUG] utterance created`);
        console.log(`[VOICE DEBUG] message = "${cleanMessage}"`);
        console.log(`[VOICE DEBUG] volume = ${volume}`);
        console.log(`[VOICE DEBUG] rate = ${rate}`);
        console.log(`[VOICE DEBUG] lang = ${lang}`);

        // Match voice for en-IN:
        // IMPORTANT: On macOS, setting utterance.voice to macOS system voices (like "Rishi")
        // causes Web Speech API in Chrome to enter a deadlocked speaking state without audio.
        // If a Google / browser-native voice exists, use it. Otherwise, do NOT override utterance.voice;
        // letting Chrome route via utterance.lang ("en-IN") works seamlessly.
        try {
          const voices = synth.getVoices();
          console.log(`[VOICE DEBUG] voices count = ${voices?.length || 0}`);
          if (Array.isArray(voices) && voices.length > 0) {
            const googleIndianVoice = voices.find(
              (v) => (v.lang?.toLowerCase() === 'en-in' || v.lang?.toLowerCase().startsWith('en')) && v.name.toLowerCase().includes('google')
            );
            if (googleIndianVoice) {
              console.log(`[VOICE DEBUG] selected voice = ${googleIndianVoice.name}`);
              utterance.voice = googleIndianVoice;
            } else {
              console.log(`[VOICE DEBUG] using browser default synthesizer for lang: ${lang}`);
            }
          }
        } catch (voiceErr) {
          console.log('[VOICE DEBUG] voice matching error:', voiceErr);
        }

        utterance.onstart = () => {
          console.log(`[VOICE DEBUG] speech started: "${cleanMessage}"`);
        };
        utterance.onend = () => {
          console.log(`[VOICE DEBUG] speech ended: "${cleanMessage}"`);
          activeUtterance = null;
        };
        utterance.onerror = (e) => {
          if (e.error === 'canceled' || e.error === 'interrupted') {
            console.log(`[VOICE DEBUG] prior speech ${e.error}`);
          } else {
            console.error(`[VOICE DEBUG] speech error =`, e.error || e);
          }
          activeUtterance = null;
        };

        // Retain in module scope to prevent GC in Chrome/Safari
        activeUtterance = utterance;

        synth.speak(utterance);
        console.log(`[VOICE DEBUG] synth.speak() called. speaking=${synth.speaking}, pending=${synth.pending}, paused=${synth.paused}`);
      } catch (innerErr) {
        console.error('[VOICE DEBUG] synth.speak execution error:', innerErr);
      }
    };

    if (isBusy) {
      setTimeout(startSpeaking, 100);
    } else {
      startSpeaking();
    }
  } catch (err) {
    console.error('[VOICE DEBUG] SpeechSynthesis exception:', err);
  }
}

/**
 * Plays: "[Customer Name] invoice created successfully."
 */
export function speakInvoiceCreated(customerName: string | null | undefined): void {
  const safeName = sanitizeSpokenText(customerName, 'Customer');
  speakVoiceNotification(`${safeName} invoice created successfully.`);
}

/**
 * Plays: "[Customer Name] payment recorded successfully."
 */
export function speakPaymentRecorded(customerName: string | null | undefined): void {
  const safeName = sanitizeSpokenText(customerName, 'Customer');
  speakVoiceNotification(`${safeName} payment recorded successfully.`);
}

/**
 * Plays: "[Customer Name] dispatch completed successfully."
 */
export function speakDispatchCompleted(customerName: string | null | undefined): void {
  const safeName = sanitizeSpokenText(customerName, 'Customer');
  speakVoiceNotification(`${safeName} dispatch completed successfully.`);
}
