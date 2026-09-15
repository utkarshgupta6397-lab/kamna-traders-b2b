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

  /**
   * Plays the dispatch incoming chime (double chime with 800ms spacing).
   */
  public async playChime(): Promise<void> {
    if (typeof window === 'undefined') return;

    if (!this.audio) {
      this.init();
    }

    if (!this.audio) return;

    try {
      this.audio.currentTime = 0;
      this.audio.volume = 1;
      await this.audio.play();

      setTimeout(() => {
        if (this.audio) {
          try {
            this.audio.currentTime = 0;
            this.audio.play().catch((err) => {
              console.warn('[DispatchAudio] Second chime playback restricted:', err);
            });
          } catch (innerErr) {
            console.warn('[DispatchAudio] Second chime error:', innerErr);
          }
        }
      }, 800);
    } catch (err: any) {
      console.warn('[DispatchAudio] Chime playback blocked or failed:', err?.message || err);
    }
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

export function playDispatchChime(): Promise<void> {
  return getDispatchAudioManager().playChime();
}
