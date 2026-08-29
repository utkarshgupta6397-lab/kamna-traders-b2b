import re

with open('src/components/CurrentStockShared.tsx', 'r') as f:
    content = f.read()

# I want to change the return type to include pdfFillColor, but React.CSSProperties doesn't have it natively.
# Let's define an interface for the return type.
new_interface = """export interface HeatmapStyleResult extends React.CSSProperties {
  pdfFillColor?: [number, number, number];
  pdfTextColor?: [number, number, number];
}

export function getSharedHeatmapStyle(
"""

content = content.replace('export function getSharedHeatmapStyle(', new_interface)
content = content.replace('): React.CSSProperties {', '): HeatmapStyleResult {')

# Now add the rgb equivalent to the returns
content = content.replace(
    "return { backgroundColor: '#1A2766', color: '#ffffff', fontWeight: 700 };",
    "return { backgroundColor: '#1A2766', color: '#ffffff', fontWeight: 700, pdfFillColor: [26, 39, 102], pdfTextColor: [255, 255, 255] };"
)
content = content.replace(
    "return { backgroundColor: '#FFFFFF', color: '#9CA3AF' };",
    "return { backgroundColor: '#FFFFFF', color: '#9CA3AF', pdfFillColor: [255, 255, 255], pdfTextColor: [156, 163, 175] };"
)
content = content.replace(
    "return { backgroundColor: '#F0FDF4', color: '#166534', fontWeight: 500 };",
    "return { backgroundColor: '#F0FDF4', color: '#166534', fontWeight: 500, pdfFillColor: [240, 253, 244], pdfTextColor: [22, 101, 52] };"
)
content = content.replace(
    "return { backgroundColor: '#BBF7D0', color: '#166534', fontWeight: 500 };",
    "return { backgroundColor: '#BBF7D0', color: '#166534', fontWeight: 500, pdfFillColor: [187, 247, 208], pdfTextColor: [22, 101, 52] };"
)
content = content.replace(
    "return { backgroundColor: '#22C55E', color: '#FFFFFF', fontWeight: 600 };",
    "return { backgroundColor: '#22C55E', color: '#FFFFFF', fontWeight: 600, pdfFillColor: [34, 197, 94], pdfTextColor: [255, 255, 255] };"
)
content = content.replace(
    "return { backgroundColor: '#FDE68A', color: '#92400E', fontWeight: 600 };",
    "return { backgroundColor: '#FDE68A', color: '#92400E', fontWeight: 600, pdfFillColor: [253, 230, 138], pdfTextColor: [146, 64, 14] };"
)
content = content.replace(
    "return { backgroundColor: '#FDBA74', color: '#9A3412', fontWeight: 600 };",
    "return { backgroundColor: '#FDBA74', color: '#9A3412', fontWeight: 600, pdfFillColor: [253, 186, 116], pdfTextColor: [154, 52, 18] };"
)
content = content.replace(
    "return { backgroundColor: '#EF4444', color: '#FFFFFF', fontWeight: 700 };",
    "return { backgroundColor: '#EF4444', color: '#FFFFFF', fontWeight: 700, pdfFillColor: [239, 68, 68], pdfTextColor: [255, 255, 255] };"
)

with open('src/components/CurrentStockShared.tsx', 'w') as f:
    f.write(content)
