/**
 * Audio Notification Manager for Dispatch Incoming Queue
 * Handles preloading, browser interaction unlocking, HTMLAudioElement playback,
 * and graceful fallback chime synthesis via Web Audio API.
 */

class DispatchAudioManager {
  private audio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private isUnlocked = false;
  private unlockListenersAttached = false;
  private readonly audioSrc = '/sounds/dispatch-bell.wav';

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    try {
      this.audio = new Audio(this.audioSrc);
      this.audio.preload = 'auto';
      this.audio.load();
      this.attachUnlockListeners();
    } catch (err) {
      console.warn('[DispatchAudio] Failed to initialize audio element:', err);
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        try {
          this.audioCtx = new AudioCtxClass();
        } catch (e) {
          console.warn('[DispatchAudio] Could not create AudioContext:', e);
        }
      }
    }
    return this.audioCtx;
  }

  private attachUnlockListeners() {
    if (this.unlockListenersAttached || typeof window === 'undefined') return;
    this.unlockListenersAttached = true;

    const handleUnlock = () => {
      this.unlockAudio();
    };

    window.addEventListener('click', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });
    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    window.addEventListener('touchstart', handleUnlock, { passive: true });
  }

  public async unlockAudio(): Promise<boolean> {
    if (this.isUnlocked) return true;

    // 1. Resume AudioContext if suspended
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('[DispatchAudio] AudioContext resume failed:', err);
      }
    }

    // 2. Unlock HTMLAudioElement via brief silent play
    if (this.audio) {
      try {
        this.audio.volume = 0;
        await this.audio.play();
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.volume = 1;
        this.isUnlocked = true;
        console.log('[DispatchAudio] Audio successfully unlocked by user interaction.');
        return true;
      } catch (err) {
        // May fail if interaction was not trusted yet, keep volume at 1
        this.audio.volume = 1;
      }
    }

    if (ctx && ctx.state === 'running') {
      this.isUnlocked = true;
      return true;
    }

    return false;
  }

  /**
   * Synthesizes a pleasant melodic bell chime using Web Audio API
   * as a rock-solid zero-network fallback if the audio file fails or is blocked.
   */
  private playSynthesizedChime(frequency = 880): Promise<void> {
    return new Promise((resolve) => {
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return resolve();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        // Exponential frequency drop for bell harmonic feel
        osc.frequency.exponentialRampToValueAtTime(frequency * 0.6, ctx.currentTime + 0.35);

        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
        osc.onended = () => resolve();
      } catch (err) {
        console.warn('[DispatchAudio] Web Audio fallback synthesis error:', err);
        resolve();
      }
    });
  }

  private async playAudioOnce(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (!this.audio) {
      this.init();
    }

    if (this.audio) {
      try {
        this.audio.currentTime = 0;
        this.audio.volume = 1;
        await this.audio.play();
        return;
      } catch (err: any) {
        console.warn('[DispatchAudio] HTMLAudioElement.play() blocked or failed:', err?.message || err);
        // Fallback to Web Audio synthesis
        await this.playSynthesizedChime(880);
      }
    } else {
      await this.playSynthesizedChime(880);
    }
  }

  /**
   * Plays the dispatch chime:
   * - count = 1: exactly ONE chime (used for Truck Photo Upload)
   * - count = 2: exactly TWO chimes with 800ms spacing (used for New Sales Order / New Push)
   */
  public async playChimes(count: 1 | 2 = 1): Promise<void> {
    if (typeof window === 'undefined') return;

    await this.playAudioOnce();

    if (count === 2) {
      setTimeout(() => {
        this.playAudioOnce().catch((innerErr) => {
          console.warn('[DispatchAudio] Second chime error:', innerErr);
        });
      }, 800);
    }
  }

  /**
   * Backward-compatible chime player. Defaults to 2 chimes.
   */
  public async playChime(): Promise<void> {
    return this.playChimes(2);
  }
}

// Singleton instance
let instance: DispatchAudioManager | null = null;

export function getDispatchAudioManager(): DispatchAudioManager {
  if (!instance) {
    instance = new DispatchAudioManager();
  }
  return instance;
}

export type NotificationEventType =
  | 'NEW_PUSH'
  | 'NEW_SALES_ORDER'
  | 'TRUCK_PHOTO_UPLOADED'
  | 'UPDATE_ORDER';

/**
 * Centralized Sound Policy Decision Point
 * - NEW_PUSH / NEW_SALES_ORDER: 2 chimes
 * - TRUCK_PHOTO_UPLOADED: 1 chime
 * - UPDATE_ORDER / others: No sound
 */
export function playNotificationSound(eventType: NotificationEventType): Promise<void> {
  const manager = getDispatchAudioManager();
  switch (eventType) {
    case 'NEW_PUSH':
    case 'NEW_SALES_ORDER':
      return manager.playChimes(2);
    case 'TRUCK_PHOTO_UPLOADED':
      return manager.playChimes(1);
    case 'UPDATE_ORDER':
    default:
      return Promise.resolve();
  }
}

export function playDispatchChime(count: 1 | 2 = 2): Promise<void> {
  return getDispatchAudioManager().playChimes(count);
}
