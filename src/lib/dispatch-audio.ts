/**
 * Audio Notification Manager for Dispatch Incoming Queue
 * Handles preloading, browser interaction unlocking, and reliable chime playback.
 */

class DispatchAudioManager {
  private audio: HTMLAudioElement | null = null;
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
      console.warn('[DispatchAudio] Failed to initialize audio:', err);
    }
  }

  private attachUnlockListeners() {
    if (this.unlockListenersAttached || typeof window === 'undefined') return;
    this.unlockListenersAttached = true;

    const handleUnlock = () => {
      this.unlockAudio();
    };

    window.addEventListener('click', handleUnlock, { once: true, passive: true });
    window.addEventListener('keydown', handleUnlock, { once: true, passive: true });
    window.addEventListener('touchstart', handleUnlock, { once: true, passive: true });
  }

  public unlockAudio(): Promise<boolean> {
    if (this.isUnlocked || !this.audio) return Promise.resolve(this.isUnlocked);

    return new Promise<boolean>((resolve) => {
      // Attempt silent playback to satisfy browser autoplay policy
      this.audio!.volume = 0;
      this.audio!.play()
        .then(() => {
          this.audio!.pause();
          this.audio!.currentTime = 0;
          this.audio!.volume = 1;
          this.isUnlocked = true;
          console.log('[DispatchAudio] Audio successfully unlocked by user interaction.');
          resolve(true);
        })
        .catch((err) => {
          console.warn('[DispatchAudio] Interaction unlock could not start:', err);
          if (this.audio) this.audio.volume = 1;
          resolve(false);
        });
    });
  }

  private async playAudioOnce(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (!this.audio) {
      this.init();
    }

    if (!this.audio) return;

    try {
      this.audio.currentTime = 0;
      this.audio.volume = 1;
      await this.audio.play();
    } catch (err: any) {
      console.warn('[DispatchAudio] Chime playback blocked or failed:', err?.message || err);
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

