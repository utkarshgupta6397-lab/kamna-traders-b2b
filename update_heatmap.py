import re

with open('src/components/SolarPanelStockClient.tsx', 'r') as f:
    content = f.read()

# Add parentId to PivotRowDef
content = content.replace(
    'isExpanded?: boolean;\n  onToggle?: () => void;',
    'isExpanded?: boolean;\n  parentId?: string;\n  onToggle?: () => void;'
)

# Update buildMatrixRows child push
content = content.replace(
    'id: `row_${classification}_${series}_child_${childKey}`,\n            label: entry.label,',
    'id: `row_${classification}_${series}_child_${childKey}`,\n            parentId: groupId,\n            label: entry.label,'
)

# Rewrite buildHeatmap
new_buildHeatmap = """function buildHeatmap(rows: PivotRowDef[]) {
  let maxGroupV = 0, maxGT = 0;
  const childMaxMap: Record<string, number> = {};

  rows.forEach(r => {
    Object.entries(r.cells).forEach(([colId, cellObj]) => {
      const val = typeof cellObj === 'number' ? cellObj : (cellObj?.value || 0);
      if (colId === 'GT' || colId.startsWith('GT_')) {
        maxGT = Math.max(maxGT, val);
      } else {
        if (r.isGroupHeader) {
          maxGroupV = Math.max(maxGroupV, val);
        } else if (!r.isGrandTotal && r.parentId) {
          childMaxMap[r.parentId] = Math.max(childMaxMap[r.parentId] || 0, val);
        }
      }
    });
  });

  const getStyle = (row: PivotRowDef, colId: string, val: number, isGtCol: boolean): React.CSSProperties => {
    if (row.isGrandTotal || isGtCol) {
      return getSharedHeatmapStyle(val, isGtCol ? maxGT : maxGroupV, true, false);
    }
    if (row.isGroupHeader) {
      if (row.isExpanded) {
        return { backgroundColor: '#F8FAFC', color: '#334155', fontWeight: 600 };
      }
      return getSharedHeatmapStyle(val, maxGroupV, false, false);
    }
    if (row.parentId) {
      return getSharedHeatmapStyle(val, childMaxMap[row.parentId] || 1, false, false);
    }
    return getSharedHeatmapStyle(val, maxGroupV, false, false);
  };
  return { getStyle };
}"""

content = re.sub(r'function buildHeatmap\(rows: PivotRowDef\[\]\) \{.*?\n\}', new_buildHeatmap, content, flags=re.DOTALL)

# Update getStyle calls in PivotTable
content = content.replace(
    'const cs = getStyle(val, false, leaf.isGrandTotal);',
    'const cs = getStyle(row, leaf.id, val, leaf.isGrandTotal);'
)
content = content.replace(
    'const cs = getStyle(val, !!row.isGrandTotal, leaf.isGrandTotal);',
    'const cs = getStyle(row, leaf.id, val, leaf.isGrandTotal);'
)

with open('src/components/SolarPanelStockClient.tsx', 'w') as f:
    f.write(content)

