const fs = require('fs');

const path = 'src/app/staff/dashboard/catalog-pricing/products/create/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add useSearchParams to imports
content = content.replace(
  "import { useRouter } from 'next/navigation';",
  "import { useRouter, useSearchParams } from 'next/navigation';"
);

// Add editId and isEditMode state
const target = "  const router = useRouter();\n  const [currentStep, setCurrentStep]       = useState(0);";
const replace = `  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const [currentStep, setCurrentStep]       = useState(0);`;

content = content.replace(target, replace);

// Add useEffect for fetching
const targetUseEffect = "  const updateForm = (key: keyof typeof formData, value: any) =>";
const replaceUseEffect = `  useEffect(() => {
    if (editId) {
      setIsEditMode(true);
      setIsInitializing(true);
      fetch(\`/api/staff/catalog/products/\${editId}\`)
        .then(res => res.json())
        .then(data => {
          const variant = data.variants?.[0] || {};
          setFormData({
            type: data.type || 'Goods',
            name: data.name || '',
            code: data.code || '',
            description: data.description || '',
            remarks: data.remarks || '',
            brandId: data.brandId || '',
            manufacturerId: data.manufacturerId || '',
            categoryId: data.categoryId || '',
            hsnCodeId: data.hsnCodeId || '',
            taxRateId: data.taxRateId || '',
            unitId: data.unitId || '',
            purchasePrice: variant.purchasePrice || 0,
            sellingPrice: variant.sellingPrice || 0,
            trackInventory: variant.trackInventory ?? true,
            trackSerials: variant.trackSerials ?? false,
            incentiveTag: data.incentiveTag || '',
            thumbnailBase64: data.thumbnailBase64 || '',
          });
        })
        .finally(() => setIsInitializing(false));
    }
  }, [editId]);

  const updateForm = (key: keyof typeof formData, value: any) =>`;

content = content.replace(targetUseEffect, replaceUseEffect);

// Change API URL if editing
content = content.replace(
  "const res = await fetch('/api/staff/catalog/products', {",
  "const url = isEditMode ? `/api/staff/catalog/products/${editId}` : '/api/staff/catalog/products';\n      const method = isEditMode ? 'PUT' : 'POST';\n      const res = await fetch(url, {"
);
content = content.replace(
  "method: 'POST',",
  "method,"
);

// If isInitializing is true, show loader
content = content.replace(
  "return (\n    <div className=\"min-h-screen",
  "if (isInitializing) return <div className=\"min-h-screen bg-[#F6F8FB] flex items-center justify-center\"><Loader2 className=\"animate-spin text-blue-600\" size={32} /></div>;\n\n  return (\n    <div className=\"min-h-screen"
);

// Change title
content = content.replace(
  "<h1 className=\"text-2xl font-bold text-gray-900 tracking-tight\">Create Product</h1>",
  "<h1 className=\"text-2xl font-bold text-gray-900 tracking-tight\">{isEditMode ? 'Edit Product' : 'Create Product'}</h1>"
);

content = content.replace(
  "<p className=\"text-sm text-gray-500 mt-1.5\">Add a new product to your master catalog</p>",
  "<p className=\"text-sm text-gray-500 mt-1.5\">{isEditMode ? 'Modify existing product details' : 'Add a new product to your master catalog'}</p>"
);

fs.writeFileSync(path, content);
console.log('done');
