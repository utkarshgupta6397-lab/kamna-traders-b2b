/**
 * Builds the Zoho POS Sync API URL from environment variables.
 * Returns null if env vars are missing.
 */
export function getZohoSyncUrl(): string | null {
  // Priority 1: Creator direct URL (Local Dev/Custom Sync)
  if (process.env.ZOHO_CREATOR_SYNC_URL) {
    return process.env.ZOHO_CREATOR_SYNC_URL;
  }

  // Priority 2: Standard POS Sync URL construction
  const url = process.env.ZOHO_POS_SYNC_URL;
  const key = process.env.ZOHO_POS_SYNC_PUBLIC_KEY;

  if (!url || !key) return null;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}publickey=${key}`;
}
