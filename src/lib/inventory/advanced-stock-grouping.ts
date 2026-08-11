const STORAGE_KEY = 'kamna_advanced_stock_grouping_config_v1';

export interface CategoryGroupingConfig {
  groupBy: string[]; // ordered list of: attributeId | 'brand'
}

export type GroupingConfigStore = Record<string, CategoryGroupingConfig>;

export function loadGroupingConfig(): GroupingConfigStore {
  if (typeof window === 'undefined') return {};
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to load grouping config:', error);
    return {};
  }
}

export function saveGroupingConfig(store: GroupingConfigStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.error('Failed to save grouping config:', error);
  }
}

export function getCategoryGrouping(
  store: GroupingConfigStore,
  categoryId: string,
  validDimensions: string[] // valid attributeIds + 'brand'
): string[] {
  const config = store[categoryId];
  if (!config || !config.groupBy) {
    return ['brand'];
  }
  
  // Filter out any stale/deleted attribute IDs
  const validSet = new Set(validDimensions);
  const validated = config.groupBy.filter(dim => validSet.has(dim));
  
  return validated.length > 0 ? validated : ['brand'];
}

export function setCategoryGrouping(
  store: GroupingConfigStore,
  categoryId: string,
  groupBy: string[]
): GroupingConfigStore {
  return {
    ...store,
    [categoryId]: { groupBy }
  };
}
