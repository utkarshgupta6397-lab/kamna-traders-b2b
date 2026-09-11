/**
 * Client-side image compression utility.
 * Compresses camera captures to a maximum dimension of 1600px at ~0.80 JPEG quality.
 * Preserves aspect ratio, corrects orientation, prevents upscaling,
 * and falls back safely to original file if compression fails.
 */

export interface CompressionResult {
  file: File;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  width: number;
  height: number;
  wasCompressed: boolean;
}

export async function compressImage(
  file: File,
  options?: {
    maxEdge?: number;
    quality?: number;
  }
): Promise<CompressionResult> {
  const maxEdge = options?.maxEdge ?? 1600;
  const quality = options?.quality ?? 0.8;

  // Non-image files or already tiny files (< 50KB) don't need canvas compression
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return {
      file,
      originalSizeBytes: file.size,
      compressedSizeBytes: file.size,
      width: 0,
      height: 0,
      wasCompressed: false,
    };
  }

  // If already processed/compressed by this utility
  if ((file as any).__alreadyCompressed) {
    return {
      file,
      originalSizeBytes: file.size,
      compressedSizeBytes: file.size,
      width: 0,
      height: 0,
      wasCompressed: false,
    };
  }

  try {
    let origWidth = 0;
    let origHeight = 0;
    let width = 0;
    let height = 0;
    let drawSource: CanvasImageSource;

    // Use createImageBitmap if available, fallback to HTMLImageElement
    if (typeof createImageBitmap !== 'undefined') {
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        bitmap = await createImageBitmap(file);
      }
      origWidth = bitmap.width;
      origHeight = bitmap.height;
      width = bitmap.width;
      height = bitmap.height;
      drawSource = bitmap;
    } else {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);
      origWidth = img.naturalWidth || img.width;
      origHeight = img.naturalHeight || img.height;
      width = origWidth;
      height = origHeight;
      drawSource = img;
    }

    // Check if resize is necessary without upscaling
    const longestEdge = Math.max(width, height);
    if (longestEdge > maxEdge) {
      if (width > height) {
        height = Math.round((height * maxEdge) / width);
        width = maxEdge;
      } else {
        width = Math.round((width * maxEdge) / height);
        height = maxEdge;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context could not be created');
    }

    ctx.drawImage(drawSource, 0, 0, width, height);

    // Convert to JPEG Blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });

    if (!blob) {
      throw new Error('Failed to encode image to JPEG blob');
    }

    // Clean up bitmap memory if supported
    if ('close' in drawSource && typeof (drawSource as any).close === 'function') {
      (drawSource as any).close();
    }

    // Generate sensible filename
    const baseName = file.name.replace(/\.[^/.]+$/, '') || 'evidence';
    const compressedFileName = `${baseName}.jpg`;

    const compressedFile = new File([blob], compressedFileName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    (compressedFile as any).__alreadyCompressed = true;

    // Log diagnostic information ONLY in development
    if (process.env.NODE_ENV === 'development') {
      const origMB = (file.size / (1024 * 1024)).toFixed(2);
      const compMB = (compressedFile.size / (1024 * 1024)).toFixed(2);
      const ratio = (((file.size - compressedFile.size) / file.size) * 100).toFixed(1);
      console.log(
        `[Image Compression Diagnostics] ${file.name}:\n` +
          `  - Original Size: ${origMB}MB (${file.size} bytes)\n` +
          `  - Compressed Size: ${compMB}MB (${compressedFile.size} bytes)\n` +
          `  - Compression Ratio: -${ratio}%\n` +
          `  - Original Dimensions: ${origWidth}x${origHeight}\n` +
          `  - Compressed Dimensions: ${width}x${height}`
      );
    }

    return {
      file: compressedFile,
      originalSizeBytes: file.size,
      compressedSizeBytes: compressedFile.size,
      width,
      height,
      wasCompressed: true,
    };
  } catch (err) {
    console.warn('[Image Compression] Failed to compress image, falling back to original:', err);
    return {
      file,
      originalSizeBytes: file.size,
      compressedSizeBytes: file.size,
      width: 0,
      height: 0,
      wasCompressed: false,
    };
  }
}
