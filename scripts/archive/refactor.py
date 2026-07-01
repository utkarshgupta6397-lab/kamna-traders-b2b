import os
import re

file_path = '/Users/utkarshgupta/Downloads/kamna-b2b-erp/src/app/staff/dashboard/solar-orders/orders/new/OrderCreationForm.tsx'
dest_path = '/Users/utkarshgupta/Downloads/kamna-b2b-erp/src/app/staff/dashboard/solar-orders/components/SolarOrderForm.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Component Signature
content = content.replace(
    'export default function OrderCreationForm() {',
    "export default function SolarOrderForm({ mode = 'CREATE', initialOrder, users, canMasterEdit, session }: { mode?: 'CREATE' | 'EDIT' | 'VIEW', initialOrder?: any, users?: any[], canMasterEdit?: boolean, session?: any }) {"
)

# 2. State Initialization
# We need to replace the state lines with initialOrder fallbacks
state_replacements = {
    "const [customerName, setCustomerName] = useState('');": "const [customerName, setCustomerName] = useState(initialOrder?.customerName || '');",
    "const [phoneNumber, setPhoneNumber] = useState('');": "const [phoneNumber, setPhoneNumber] = useState(initialOrder?.phoneNumber || '');",
    "const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);": "const [orderDate, setOrderDate] = useState(initialOrder ? new Date(initialOrder.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);",
    "const [leadSource, setLeadSource] = useState('Walk-in');": "const [leadSource, setLeadSource] = useState(initialOrder?.leadSource?.replace('_', ' ') || 'Walk-in');",
    "const [referralName, setReferralName] = useState('');": "const [referralName, setReferralName] = useState(initialOrder?.referralName || '');",
    "const [callingExecutiveId, setCallingExecutiveId] = useState('');": "const [callingExecutiveId, setCallingExecutiveId] = useState(initialOrder?.callingExecutiveId || '');",
    "const [subVendorId, setSubVendorId] = useState('');": "const [subVendorId, setSubVendorId] = useState(initialOrder?.subVendorId || '');",
    "const [systemSize, setSystemSize] = useState('');": "const [systemSize, setSystemSize] = useState(initialOrder?.systemSize?.toString() || '');",
    "const [systemType, setSystemType] = useState('ON_GRID');": "const [systemType, setSystemType] = useState(initialOrder?.systemType || 'ON_GRID');",
    "const [totalOrderAmount, setTotalOrderAmount] = useState('');": "const [totalOrderAmount, setTotalOrderAmount] = useState(initialOrder?.totalOrderAmount?.toString() || '');",
    "const [loanCustomer, setLoanCustomer] = useState(false);": "const [loanCustomer, setLoanCustomer] = useState(initialOrder?.loanCustomer || false);",
    "const [salesmanId, setSalesmanId] = useState('');": "const [salesmanId, setSalesmanId] = useState(initialOrder?.salesmanId || '');",
    "const [panels, setPanels] = useState<{ id: string; description: string; quantity: string }[]>([{ id: '1', description: '', quantity: '' }]);": "const [panels, setPanels] = useState<{ id: string; description: string; quantity: string }[]>(initialOrder?.panels?.length ? initialOrder.panels.map((p: any) => ({ id: p.id, description: p.description, quantity: p.quantity.toString() })) : [{ id: '1', description: '', quantity: '' }]);",
    "const [inverters, setInverters] = useState<{ id: string; description: string; quantity: string }[]>([{ id: '1', description: '', quantity: '' }]);": "const [inverters, setInverters] = useState<{ id: string; description: string; quantity: string }[]>(initialOrder?.inverters?.length ? initialOrder.inverters.map((i: any) => ({ id: i.id, description: i.description, quantity: i.quantity.toString() })) : [{ id: '1', description: '', quantity: '' }]);",
    "const [floorNumber, setFloorNumber] = useState('');": "const [floorNumber, setFloorNumber] = useState(initialOrder?.floorNumber?.toString() || '');",
}

for old, new_s in state_replacements.items():
    content = content.replace(old, new_s)

# Handle remarks, address, city
remarks_logic = """
  const parseRemarks = (raw: string) => {
    let address = '';
    let city = '';
    let remainder = raw || '';
    if (remainder.includes('Address: ')) {
      const parts = remainder.split('Address: ');
      const afterAddress = parts[1].split('\\nCity: ');
      address = afterAddress[0];
      if (afterAddress.length > 1) {
        city = afterAddress[1];
      } else if (parts[0].includes('City: ')) {
         // handle edge case
      }
      remainder = parts[0];
    } else if (remainder.includes('City: ')) {
      const parts = remainder.split('City: ');
      city = parts[1];
      remainder = parts[0];
    }
    return { remarks: remainder.trim(), address, city };
  };
  const parsed = initialOrder ? parseRemarks(initialOrder.remarks) : { remarks: '', address: '', city: '' };

  const [address, setAddress] = useState(parsed.address);
  const [city, setCity] = useState(parsed.city);
  const [remarks, setRemarks] = useState(parsed.remarks);
"""
content = content.replace("const [address, setAddress] = useState('');", remarks_logic)
content = content.replace("const [city, setCity] = useState('');", "")
content = content.replace("const [remarks, setRemarks] = useState('');", "")

# Save Logic Diffing
save_logic_replacement = """
  const handleConfirmSubmit = async () => {
    setLoading(true);
    const combinedRemarks = [
      remarks.trim(),
      `Address: ${address.trim()}`,
      `City: ${city.trim()}`
    ].filter(Boolean).join('\\n');

    try {
      const uploadedImages = [];
      // handle images normally...
      for (const img of siteImages) {
        if (!img.file) continue; // Skip already uploaded ones if editing
        const formData = new FormData();
        formData.append('file', img.file);
        try {
          const upRes = await fetch('/api/upload', { method: 'POST', body: formData });
          if (upRes.ok) {
            const result = await upRes.json();
            uploadedImages.push({ url: result.url, fileName: result.fileName, fileSize: result.fileSize, mimeType: result.mimeType });
          }
        } catch (e) {
          toast.error(`Failed to upload ${img.file.name}`);
          setLoading(false);
          return;
        }
      }

      const payload: any = {
        customerName, phoneNumber, whatsappEnabled: false, 
        leadSource: leadSource === 'Other' ? otherLeadSource : leadSource,
        referralName: leadSource === 'Referral' ? referralName : null,
        callingExecutiveId: leadSource === 'Calling Activity' ? callingExecutiveId : null,
        salesmanId: leadSource !== 'Sub-Vendor' ? salesmanId : null,
        subVendorId: leadSource === 'Sub-Vendor' ? subVendorId : null,
        loanCustomer, totalOrderAmount: parseFloat(totalOrderAmount),
        systemSize: parseFloat(systemSize), systemType, remarks: combinedRemarks,
        zohoBooksCustomerId: selectedZohoCustomer?.id || null,
        zohoBooksCustomerName: selectedZohoCustomer?.name || null,
        floorNumber: floorNumber ? Number(floorNumber) : null, orderDate,
        panels: panels.map(p => ({ description: p.description, quantity: Number(p.quantity) })),
        inverters: inverters.map(i => ({ description: i.description, quantity: Number(i.quantity) })),
        siteImages: uploadedImages
      };

      if (mode === 'CREATE') {
        const res = await fetch('/api/solar-orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(`Order ${data.order.orderNumber} created successfully`);
          setTimeout(() => { router.push(`/staff/dashboard/solar-orders/orders/${data.order.id}`); }, 1500);
        } else {
          toast.error(data.error || 'Failed to create order');
          setLoading(false);
        }
      } else if (mode === 'EDIT') {
        payload.isMasterEdit = true;
        const res = await fetch(`/api/solar-orders/${initialOrder.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('Order updated successfully');
          setTimeout(() => { window.location.reload(); }, 1500);
        } else {
          toast.error('Failed to update order');
          setLoading(false);
        }
      }
    } catch (e) {
      toast.error('Network error');
      setLoading(false);
    }
  };
"""

# Find the start of handleConfirmSubmit and end of it.
# We will just regex replace the whole handleConfirmSubmit block.
content = re.sub(r'const handleConfirmSubmit = async \(\) => \{.*?(?=const )', save_logic_replacement, content, flags=re.DOTALL)

# Write out the modified file to dest_path
os.makedirs(os.path.dirname(dest_path), exist_ok=True)
with open(dest_path, 'w') as f:
    f.write(content)
