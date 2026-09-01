import { getZohoOrgId, getZohoTokens } from './zoho-auth';

const globalForCustomFields = globalThis as unknown as { 
  __zoho_custom_fields_cache?: any[]
};

/**
 * Fetches and caches custom fields metadata for Sales Orders from Zoho Books.
 */
export async function getSalesOrderCustomFieldsMetadata(): Promise<any[]> {
  if (globalForCustomFields.__zoho_custom_fields_cache) {
    return globalForCustomFields.__zoho_custom_fields_cache;
  }
  
  const orgId = getZohoOrgId();
  const accessToken = await getZohoTokens();
  
  if (!orgId || !accessToken) {
    throw new Error('Missing Zoho credentials to fetch custom fields.');
  }

  const apiBase = process.env.ZOHO_API_BASE_URL || 'https://www.zohoapis.in';
  const url = `${apiBase}/books/v3/settings/preferences/customfields?entity=salesorder&organization_id=${orgId}`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Accept': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch custom fields metadata: ${response.status}`);
  }
  
  const data = await response.json();
  globalForCustomFields.__zoho_custom_fields_cache = data.customfields || [];
  return globalForCustomFields.__zoho_custom_fields_cache || [];
}

/**
 * Maps an object of API names to Zoho Books customfield_id payload structures.
 * E.g. { cf_is_locked: true } -> [ { customfield_id: '...', value: 'true' } ]
 */
export async function buildZohoCustomFieldsPayload(updates: Record<string, any>): Promise<any[]> {
  const metadata = await getSalesOrderCustomFieldsMetadata();
  const payload = [];
  
  for (const [key, value] of Object.entries(updates)) {
    // Match by placeholder (e.g. 'cf_is_locked') or label
    const field = metadata.find(f => f.placeholder === key || f.label === key);
    if (field) {
      payload.push({
        customfield_id: field.customfield_id,
        value: String(value)
      });
    } else {
      console.warn(`[Zoho Custom Fields] Could not find custom field ID for '${key}'. Skipping.`);
    }
  }
  
  return payload;
}
