import re

with open('src/components/SolarPanelStockClient.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const buildMatrixRows = (classification: 'DCR' | 'Non-DCR', activeWhs: Warehouse[]): PivotRowDef[] => {",
    "const buildMatrixRows = (classification: 'DCR' | 'Non-DCR', activeWhs: Warehouse[], forceExpand: boolean = false): PivotRowDef[] => {"
)

content = content.replace(
    "const isExpanded = isExportMode || expandedGroups.has(groupId);",
    "const isExpanded = forceExpand || isExportMode || expandedGroups.has(groupId);"
)

content = content.replace(
    "tables.push({\n           title: 'DCR Solar Panel Stock',\n           head: [['Series / SKU', ...dcrCols.map(c => c.label)]],\n           body: buildTableBody(dcrCols, dcrRows).map(r => {",
    "tables.push({\n           title: 'DCR Solar Panel Stock',\n           head: [['Series / SKU', ...dcrCols.map(c => c.label)]],\n           body: buildTableBody(dcrCols, buildMatrixRows('DCR', dcrWarehouses, true)).map(r => {"
)

content = content.replace(
    "tables.push({\n           title: 'Non-DCR Solar Panel Stock',\n           head: [['Series / SKU', ...nonDcrCols.map(c => c.label)]],\n           body: buildTableBody(nonDcrCols, nonDcrRows).map(r => {",
    "tables.push({\n           title: 'Non-DCR Solar Panel Stock',\n           head: [['Series / SKU', ...nonDcrCols.map(c => c.label)]],\n           body: buildTableBody(nonDcrCols, buildMatrixRows('Non-DCR', nonDcrWarehouses, true)).map(r => {"
)

with open('src/components/SolarPanelStockClient.tsx', 'w') as f:
    f.write(content)

