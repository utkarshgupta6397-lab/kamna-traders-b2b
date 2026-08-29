import re

with open('src/components/SolarAccessoriesStockClient.tsx', 'r') as f:
    content = f.read()

# Replace useMemo with buildMatrixRows
content = content.replace(
    'const { matrixRows, maxBody, maxGt } = useMemo(() => {',
    'const buildMatrixRows = (forceExpand: boolean = false) => {'
)

content = content.replace(
    'const isExpanded = expandedCategories.has(catName);',
    'const isExpanded = forceExpand || expandedCategories.has(catName);'
)

content = content.replace(
    'return { matrixRows: rows, maxBody: maxB, maxGt: maxG };\n  }, [filteredItems, meaningfulWarehouses, expandedCategories]);',
    'return { matrixRows: rows, maxBody: maxB, maxGt: maxG };\n  };\n\n  const { matrixRows, maxBody, maxGt } = useMemo(() => buildMatrixRows(), [filteredItems, meaningfulWarehouses, expandedCategories]);'
)

content = content.replace(
    'const body = matrixRows.map(row => {',
    'const { matrixRows: exportRows } = buildMatrixRows(true);\n      const body = exportRows.map(row => {'
)

with open('src/components/SolarAccessoriesStockClient.tsx', 'w') as f:
    f.write(content)

