export interface Option {
  id: string;
  name?: string;
  code?: string;
  percentage?: number;
  abbreviation?: string;
  taxType?: string;
  parentId?: string | null;
  parent?: { id: string; name: string };
  _count?: { children: number };
  [key: string]: any;
}

const globalLookupCache = new Map<string, { data: Option[]; timestamp: number }>();

export class LookupService {
  static clearCache() {
    globalLookupCache.clear();
  }

  /**
   * Sort options alphabetically ignoring case and leading/trailing spaces.
   * Special handling for categories to preserve hierarchy.
   */
  static sortOptions(options: Option[], isCategory: boolean = false): Option[] {
    if (!isCategory) {
      return [...options].sort((a, b) => {
        const nameA = (a.name || a.code || '').trim();
        const nameB = (b.name || b.code || '').trim();
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      });
    }

    // For categories, we need to sort siblings but preserve hierarchy.
    const rootNodes = options.filter((o) => !o.parentId);
    const childrenByParent = new Map<string, Option[]>();

    options.forEach((o) => {
      if (o.parentId) {
        if (!childrenByParent.has(o.parentId)) {
          childrenByParent.set(o.parentId, []);
        }
        childrenByParent.get(o.parentId)!.push(o);
      }
    });

    const sortNodes = (nodes: Option[]) => {
      return [...nodes].sort((a, b) => {
        const nameA = (a.name || '').trim();
        const nameB = (b.name || '').trim();
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      });
    };

    const sortedRoots = sortNodes(rootNodes);
    const result: Option[] = [];

    const traverse = (node: Option) => {
      result.push(node);
      const children = childrenByParent.get(node.id) || [];
      if (children.length > 0) {
        const sortedChildren = sortNodes(children);
        sortedChildren.forEach(traverse);
      }
    };

    sortedRoots.forEach(traverse);
    
    // Fallback for missing parents (orphans)
    const processedIds = new Set(result.map(r => r.id));
    const orphans = options.filter(o => !processedIds.has(o.id));
    if (orphans.length > 0) {
      result.push(...sortNodes(orphans));
    }

    return result;
  }

  static getCacheKey(endpoint: string, query: string, extraQueryParams?: Record<string, string>): string {
    const qs = new URLSearchParams();
    qs.set('status', 'Active');
    qs.set('limit', '100');
    if (query) qs.set('search', query);
    if (extraQueryParams) {
      Object.entries(extraQueryParams).forEach(([k, v]) => qs.set(k, v));
    }
    return `${endpoint}?${qs.toString()}`;
  }

  static async fetchOptions(
    endpoint: string,
    query: string = '',
    extraQueryParams?: Record<string, string>
  ): Promise<Option[]> {
    const cacheKey = this.getCacheKey(endpoint, query, extraQueryParams);
    const cached = globalLookupCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < 1000 * 60 * 5) {
      return cached.data;
    }

    const res = await fetch(cacheKey);
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`API Error: ${res.status} ${res.statusText} - ${errorText}`);
    }

    const data = await res.json();
    let records: Option[] = data.records || [];

    const isCategory = endpoint.includes('/categories');
    records = this.sortOptions(records, isCategory);

    globalLookupCache.set(cacheKey, { data: records, timestamp: Date.now() });
    return records;
  }

  static async fetchById(endpoint: string, id: string): Promise<Option | null> {
    try {
      // Check cache first
      for (const [key, cached] of globalLookupCache.entries()) {
        if (key.startsWith(endpoint)) {
          const found = cached.data.find((o) => o.id === id);
          if (found) return found;
        }
      }

      const res = await fetch(`${endpoint}/${id}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Silent error
    }
    return null;
  }
}
