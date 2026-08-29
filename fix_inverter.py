import re

with open('src/components/InverterStockClient.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    'const outBg = rawStyle.backgroundColor || cellBg;',
    'const outBg = (rawStyle as any).pdfFillColor || cellBg;'
)
content = content.replace(
    'const outText = rawStyle.color || textColor;',
    'const outText = (rawStyle as any).pdfTextColor || textColor;'
)

with open('src/components/InverterStockClient.tsx', 'w') as f:
    f.write(content)
