import re

with open('src/app/staff/dashboard/solar-orders/components/SolarOrderForm.tsx', 'r') as f:
    content = f.read()

# 1. Add `const data = await res.json();` back to the edit handler
edit_handler = """        const res = await fetch(`/api/solar-orders/${initialOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {"""
new_edit_handler = """        const res = await fetch(`/api/solar-orders/${initialOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) {"""
content = content.replace(edit_handler, new_edit_handler, 1)

with open('src/app/staff/dashboard/solar-orders/components/SolarOrderForm.tsx', 'w') as f:
    f.write(content)
