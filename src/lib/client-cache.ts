const fetchCache = new Map<string, { data: any; timestamp: number }>();
const pendingRequests = new Map<string, Promise<any>>();

export interface FetchOptions extends RequestInit {
  /** Time to live in milliseconds. Default 15 mins. */
  ttl?: number;
  /** Force refetch bypassing cache */
  force?: boolean;
}

/**
 * Deduplicates concurrent identical requests and optionally caches the response.
 */
export async function fetchWithCache(url: string, options: FetchOptions = {}) {
  const { ttl = 15 * 60 * 1000, force = false, ...fetchOptions } = options;
  
  const isCacheable = !fetchOptions.method || fetchOptions.method.toUpperCase() === 'GET';
  
  if (!isCacheable || force) {
    if (force) {
      fetchCache.delete(url);
      pendingRequests.delete(url);
    }
    const res = await fetch(url, fetchOptions);
    return res.json();
  }

  const now = Date.now();
  const cached = fetchCache.get(url);

  // Return valid cached result
  if (cached && (now - cached.timestamp < ttl)) {
    return cached.data;
  }

  // If request is already pending, wait for it
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url);
  }

  // Create new request
  const promise = fetch(url, fetchOptions)
    .then(async (res) => {
      if (!res.ok) {
        let errorData;
        try { errorData = await res.json(); } catch { throw new Error(`HTTP error! status: ${res.status}`); }
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      fetchCache.set(url, { data, timestamp: Date.now() });
      pendingRequests.delete(url);
      return data;
    })
    .catch(err => {
      pendingRequests.delete(url);
      throw err;
    });

  pendingRequests.set(url, promise);

  return promise;
}
