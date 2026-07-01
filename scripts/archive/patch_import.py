import re

with open('src/app/staff/dashboard/solar-orders/components/SolarOrderForm.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { useRouter } from 'next/navigation';", "import { useRouter } from 'next/navigation';\nimport { ZohoDuplicateAlertModal } from '@/components/ZohoDuplicateAlertModal';")

with open('src/app/staff/dashboard/solar-orders/components/SolarOrderForm.tsx', 'w') as f:
    f.write(content)
