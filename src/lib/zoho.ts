/**
 * Builds the Zoho POS Sync API URL from environment variables.
 * Returns null if env vars are missing.
 */
export function getZohoSyncUrl(): string | null {
  const url = process.env.ZOHO_POS_SYNC_URL;
  const key = process.env.ZOHO_POS_SYNC_PUBLIC_KEY;

  if (!url || !key) return null;

  // Append publickey param
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}publickey=${key}`;
}
