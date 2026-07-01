import re

with open('src/app/staff/dashboard/solar-orders/components/SolarOrderForm.tsx', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace("import { Badge } from '@/components/ui/badge';", "import { Badge } from '@/components/ui/badge';\nimport { ZohoDuplicateAlertModal } from '@/components/ZohoDuplicateAlertModal';")

# 2. State
content = content.replace("const [showPreview, setShowPreview] = useState(false);", "const [showPreview, setShowPreview] = useState(false);\n  const [duplicateError, setDuplicateError] = useState<any>(null);")

# 3. Create POST handler
create_err_block = """        } else {
          toast.error(data.error || 'Failed to create order');
          setShowPreview(false);
        }"""
new_create_err_block = """        } else if (res.status === 409 && data.code === 'ZOHO_CUSTOMER_ALREADY_LINKED') {
          setDuplicateError({ ...data, customerName: selectedZohoCustomer?.name || 'Unknown' });
          setShowPreview(false);
        } else {
          toast.error(data.error || 'Failed to create order');
          setShowPreview(false);
        }"""
content = content.replace(create_err_block, new_create_err_block, 1)

# 4. Edit PATCH handler
edit_err_block = """        } else {
          toast.error('Failed to update order');
          setShowPreview(false);
        }"""
new_edit_err_block = """        } else if (res.status === 409 && data.code === 'ZOHO_CUSTOMER_ALREADY_LINKED') {
          setDuplicateError({ ...data, customerName: selectedZohoCustomer?.name || 'Unknown' });
          setShowPreview(false);
        } else {
          toast.error(data.error || 'Failed to update order');
          setShowPreview(false);
        }"""
content = content.replace(edit_err_block, new_edit_err_block, 1)

# 5. JSX Bottom
jsx_bottom = """      )}
    </>
  );
}"""
new_jsx_bottom = """      )}
      {duplicateError && (
        <ZohoDuplicateAlertModal
          customerName={duplicateError.customerName}
          existingOrderId={duplicateError.existingOrderId}
          existingOrderNumber={duplicateError.existingOrderNumber}
          existingStatus={duplicateError.existingStatus}
          onClose={() => setDuplicateError(null)}
        />
      )}
    </>
  );
}"""
content = content.replace(jsx_bottom, new_jsx_bottom)

with open('src/app/staff/dashboard/solar-orders/components/SolarOrderForm.tsx', 'w') as f:
    f.write(content)
