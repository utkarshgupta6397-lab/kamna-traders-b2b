export interface AdvancedSkuRow {
  skuId: string;
  brandId: string | null;
  brandName: string | null;
  categoryId: string | null;
  unitShort: string | null;
  attrValues: Record<string, string>;
  warehouseQty: Record<string, number>;
  warehouseHistoricalStock: Record<string, Record<string, number | null>>;
  currentStock: number;
  historicalStock: Record<string, number | null>;
  avgDailyConsumption: number;
  productName: string;
}

export interface HierarchyNode {
  id: string;
  label: string;
  depth: number;
  isCategory: boolean;
  isWarehouse?: boolean;
  isSku?: boolean;
  currentStock: number;
  avgDailyConsumption: number;
  maxLevel: number;
  historicalStock: Record<string, number | null>;
  unitShort: string | null;
  children: HierarchyNode[];
  skuCount: number;
}

export function getDimensionValue(sku: AdvancedSkuRow, dimension: string): string | null {
  if (dimension === 'brand') {
    return sku.brandName || null;
  }
  return sku.attrValues[dimension] || null;
}

export function buildCategoryHierarchy(
  categoryName: string,
  categoryId: string,
  skus: AdvancedSkuRow[],
  groupBy: string[],
  config: { leadTimeDays: number; safetyFactor: number },
  historicalDates: string[],
  warehouses: { id: string; name: string }[]
): HierarchyNode {
  
  const root: HierarchyNode = {
    id: categoryId,
    label: categoryName,
    depth: 0,
    isCategory: true,
    currentStock: 0,
    avgDailyConsumption: 0,
    maxLevel: 0,
    historicalStock: {},
    unitShort: null,
    children: [],
    skuCount: skus.length
  };
  
  historicalDates.forEach(d => root.historicalStock[d] = null);
  
  if (skus.length === 0) return root;

  root.unitShort = skus[0].unitShort;

  skus.forEach(sku => {
    let currentNode = root;
    let actualDepth = 1;
    
    // Traverse analytical dimensions
    for (let i = 0; i < groupBy.length; i++) {
      const dim = groupBy[i];
      const val = getDimensionValue(sku, dim);
      
      if (val === null) {
        continue;
      }
      
      const nodeId = `${currentNode.id}|${dim}:${val}`;
      let child = currentNode.children.find(c => c.id === nodeId);
      
      if (!child) {
        child = {
          id: nodeId,
          label: val,
          depth: actualDepth,
          isCategory: false,
          currentStock: 0,
          avgDailyConsumption: 0,
          maxLevel: 0,
          historicalStock: {},
          unitShort: sku.unitShort,
          children: [],
          skuCount: 0
        };
        historicalDates.forEach(d => child!.historicalStock[d] = null);
        currentNode.children.push(child);
      }
      
      currentNode = child;
      actualDepth++;
    }
    
    // currentNode is the analytical leaf node. 
    // Now drill down to Warehouse -> SKU levels
    
    // Create or find Warehouse nodes for this SKU
    warehouses.forEach(wh => {
      const whQty = sku.warehouseQty[wh.id] || 0;
      const whHist = sku.warehouseHistoricalStock?.[wh.id] || {};
      
      const hasAnyHistory = Object.values(whHist).some(v => v !== null && v > 0);
      if (whQty === 0 && !hasAnyHistory) {
         return; // Skip warehouse if sku has absolutely no presence here
      }
      
      const whNodeId = `${currentNode.id}|wh:${wh.id}`;
      let whNode = currentNode.children.find(c => c.id === whNodeId);
      
      if (!whNode) {
        whNode = {
          id: whNodeId,
          label: wh.name,
          depth: actualDepth,
          isWarehouse: true,
          isCategory: false,
          currentStock: 0,
          avgDailyConsumption: 0, // Warehouse-specific consumption is hard to isolate, keep 0 to not inflate totals
          maxLevel: 0,
          historicalStock: {},
          unitShort: sku.unitShort,
          children: [],
          skuCount: 0
        };
        historicalDates.forEach(d => whNode!.historicalStock[d] = null);
        currentNode.children.push(whNode);
      }

      // Create SKU node under this Warehouse
      const skuNodeId = `${whNode.id}|sku:${sku.skuId}`;
      let skuNode = whNode.children.find(c => c.id === skuNodeId);
      if (!skuNode) {
        const skuNodeObj: HierarchyNode = {
          id: skuNodeId,
          label: sku.productName || sku.skuId,
          depth: actualDepth + 1,
          isSku: true,
          isCategory: false,
          currentStock: whQty,
          avgDailyConsumption: 0, 
          maxLevel: 0,
          historicalStock: {},
          unitShort: sku.unitShort,
          children: [],
          skuCount: 1
        };
        historicalDates.forEach(d => {
          skuNodeObj.historicalStock[d] = whHist[d] ?? null;
        });
        whNode.children.push(skuNodeObj);
      }
    });

    currentNode.currentStock += sku.currentStock;
    currentNode.avgDailyConsumption += sku.avgDailyConsumption;
    currentNode.skuCount += 1;
    
    historicalDates.forEach(d => {
      const hQty = sku.historicalStock[d];
      if (hQty !== null) {
        currentNode.historicalStock[d] = (currentNode.historicalStock[d] || 0) + hQty;
      }
    });
  });

  const calculateLeafMaxLevels = (node: HierarchyNode) => {
    // Determine if this is an analytical leaf (i.e. its children are Warehouses)
    const isAnalyticalLeaf = node.children.length === 0 || (node.children[0] && node.children[0].isWarehouse);
    
    if (isAnalyticalLeaf) {
      node.maxLevel = node.avgDailyConsumption * config.leadTimeDays * config.safetyFactor;
    } else {
      node.children.forEach(calculateLeafMaxLevels);
    }
  };
  calculateLeafMaxLevels(root);

  aggregateNode(root, historicalDates);

  return root;
}

export function aggregateNode(node: HierarchyNode, historicalDates: string[]): void {
  if (node.children.length === 0) return;

  const isAnalyticalLeaf = node.children[0] && node.children[0].isWarehouse;

  if (isAnalyticalLeaf) {
    // Do not reset and sum from children for the analytical leaf itself, 
    // as it already has accurate currentStock, maxLevel, and avgDailyConsumption.
    // However, we must ensure the Warehouse children aggregate from their SKU children.
    for (const whNode of node.children) {
      aggregateOperationalNode(whNode, historicalDates);
    }
    return;
  }

  // Reset self before summing children
  node.currentStock = 0;
  node.avgDailyConsumption = 0;
  node.maxLevel = 0;
  historicalDates.forEach(d => node.historicalStock[d] = null);
  node.skuCount = 0;

  for (const child of node.children) {
    aggregateNode(child, historicalDates);

    node.currentStock += child.currentStock;
    node.avgDailyConsumption += child.avgDailyConsumption;
    node.maxLevel += child.maxLevel;
    node.skuCount += child.skuCount;

    historicalDates.forEach(d => {
      const hQty = child.historicalStock[d];
      if (hQty !== null) {
        node.historicalStock[d] = (node.historicalStock[d] || 0) + hQty;
      }
    });
  }
}

function aggregateOperationalNode(node: HierarchyNode, historicalDates: string[]): void {
  node.currentStock = 0;
  historicalDates.forEach(d => node.historicalStock[d] = null);
  node.skuCount = 0;
  
  for (const child of node.children) {
    node.currentStock += child.currentStock;
    node.skuCount += child.skuCount;
    historicalDates.forEach(d => {
      const hQty = child.historicalStock[d];
      if (hQty !== null) {
        node.historicalStock[d] = (node.historicalStock[d] || 0) + hQty;
      }
    });
  }
}
