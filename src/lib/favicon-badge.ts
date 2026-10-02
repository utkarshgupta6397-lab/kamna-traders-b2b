/**
 * Generates and updates a dynamic favicon with the Kamna logo and unaccepted count badge.
 */

const DEFAULT_FAVICON = '/logo.svg';
const faviconDataCache = new Map<number, string>();

/**
 * Updates the document favicon link tag.
 * - count === 0: restores original '/logo.svg'
 * - count > 0: generates a 64x64 dynamic icon with Kamna branding and a prominent truck count badge.
 */
export function updateFaviconBadge(count: number): void {
  if (typeof document === 'undefined') return;

  const link = (document.querySelector("link[rel*='icon']") as HTMLLinkElement) || createFaviconLink();

  if (count <= 0) {
    if (link.href !== DEFAULT_FAVICON && !link.href.endsWith(DEFAULT_FAVICON)) {
      link.href = DEFAULT_FAVICON;
    }
    return;
  }

  // Use cached data URL if already generated
  if (faviconDataCache.has(count)) {
    const cached = faviconDataCache.get(count)!;
    if (link.href !== cached) {
      link.href = cached;
    }
    return;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load base logo image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = DEFAULT_FAVICON;

    img.onload = () => {
      // 1. Draw base logo scaled to 52x52
      ctx.clearRect(0, 0, 64, 64);
      ctx.drawImage(img, 2, 6, 52, 52);

      // 2. Render badge circle in top-right
      const badgeX = 46;
      const badgeY = 18;
      const radius = 16;

      ctx.save();
      // Outer border / glow
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, radius + 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Main badge background (Kamna Red)
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#AE1B1E';
      ctx.fill();

      // Badge text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = count > 99 ? '99+' : String(count);
      ctx.fillText(label, badgeX, badgeY + 1);
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/png');
      faviconDataCache.set(count, dataUrl);
      link.href = dataUrl;
    };

    // If logo SVG fails to load or runs on an isolated offline worker, render solid badge
    img.onerror = () => {
      ctx.clearRect(0, 0, 64, 64);
      // Background square
      ctx.fillStyle = '#1A2766';
      ctx.beginPath();
      ctx.roundRect(2, 2, 60, 60, 12);
      ctx.fill();

      // Truck icon / text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(count), 32, 34);

      const dataUrl = canvas.toDataURL('image/png');
      faviconDataCache.set(count, dataUrl);
      link.href = dataUrl;
    };
  } catch (err) {
    console.warn('[FaviconBadge] Could not generate favicon badge:', err);
  }
}

function createFaviconLink(): HTMLLinkElement {
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'shortcut icon';
    document.head.appendChild(link);
  }
  return link;
}
