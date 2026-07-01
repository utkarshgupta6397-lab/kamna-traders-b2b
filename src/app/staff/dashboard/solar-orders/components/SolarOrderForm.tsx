'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ZohoDuplicateAlertModal } from '@/components/ZohoDuplicateAlertModal';
import { Search, Loader2, User, Phone, CheckCircle2, Zap, FileText, X, AlertTriangle, MapPin, ClipboardList, Check, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface StaffUser {
  id: string;
  name: string;
}

interface ZohoCustomer {
  id: string;
  name: string;
  gstNumber: string;
}

interface SubVendor {
  id: string;
  name: string;
  active: boolean;
}

interface City {
  id: string;
  name: string;
  active: boolean;
}

export default function SolarOrderForm({ mode = 'CREATE', initialOrder, users, canMasterEdit, session }: { mode?: 'CREATE' | 'EDIT' | 'VIEW', initialOrder?: any, users?: any[], canMasterEdit?: boolean, session?: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState(mode);
  
  // Data State
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [vendorList, setVendorList] = useState<SubVendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [vendorsError, setVendorsError] = useState(false);
  const [cityList, setCityList] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [citiesError, setCitiesError] = useState(false);
  
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

  // Form State
  const [customerName, setCustomerName] = useState(initialOrder?.customerName || '');
  const [phoneNumber, setPhoneNumber] = useState(initialOrder?.phoneNumber || '');
  const [orderDate, setOrderDate] = useState(initialOrder ? new Date(initialOrder.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [leadSource, setLeadSource] = useState(initialOrder?.leadSource?.replace('_', ' ') || 'Walk-in');
  
  // Conditional Lead Source Fields
  const [referralName, setReferralName] = useState(initialOrder?.referralName || '');
  const [callingExecutiveId, setCallingExecutiveId] = useState(initialOrder?.callingExecutiveId || '');
  const [otherLeadSource, setOtherLeadSource] = useState('');
  const [subVendorId, setSubVendorId] = useState(initialOrder?.subVendorId || '');
  
  // Mandatory Address Fields
  const [address, setAddress] = useState(parsed.address);
  const [city, setCity] = useState(parsed.city);
  const [cityQuery, setCityQuery] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  
  // System Specs
  const [systemSize, setSystemSize] = useState(initialOrder?.systemSize?.toString() || '');
  const [systemType, setSystemType] = useState(initialOrder?.systemType || 'ON_GRID');
  const [totalOrderAmount, setTotalOrderAmount] = useState(initialOrder?.totalOrderAmount?.toString() || '');
  const [loanCustomer, setLoanCustomer] = useState(initialOrder?.loanCustomer || false);
  
  // Assignment
  const [salesmanId, setSalesmanId] = useState(initialOrder?.salesmanId || '');
  
  // Site & Item Details
  const [panels, setPanels] = useState<{ id: string; description: string; quantity: string }[]>(initialOrder?.panels?.length ? initialOrder.panels.map((p: any) => ({ id: p.id, description: p.description, quantity: p.quantity.toString() })) : [{ id: '1', description: '', quantity: '' }]);
  const [inverters, setInverters] = useState<{ id: string; description: string; quantity: string }[]>(initialOrder?.inverters?.length ? initialOrder.inverters.map((i: any) => ({ id: i.id, description: i.description, quantity: i.quantity.toString() })) : [{ id: '1', description: '', quantity: '' }]);
  const [floorNumber, setFloorNumber] = useState(initialOrder?.floorNumber?.toString() || '');
  const [siteImages, setSiteImages] = useState<{ id: string; file: File; preview: string }[]>(initialOrder?.files?.length ? initialOrder.files.map((f: any) => ({ id: f.id, file: null as any, preview: f.url })) : []);

  // Remarks
  const [remarks, setRemarks] = useState(parsed.remarks);

  // Sub Vendor Search State
  const [subVendorQuery, setSubVendorQuery] = useState('');
  const [showSubVendorDropdown, setShowSubVendorDropdown] = useState(false);

  // Zoho Integration State
  const [zohoSearchQuery, setZohoSearchQuery] = useState('');
  const [zohoSearching, setZohoSearching] = useState(false);
  const [zohoResults, setZohoResults] = useState<ZohoCustomer[]>([]);
  const [selectedZohoCustomer, setSelectedZohoCustomer] = useState<ZohoCustomer | null>(null);

  // Review Modal State
  const [showPreview, setShowPreview] = useState(false);
  const [duplicateError, setDuplicateError] = useState<any>(null);

  useEffect(() => {
    // Fetch Staff
    fetch('/api/solar-orders/staff')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setStaffList(data);
      });
      
    // Fetch Sub Vendors
    setVendorsLoading(true);
    setVendorsError(false);
    fetch('/api/admin/sub-vendors')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch vendors');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setVendorList(data.filter((v: SubVendor) => v.active));
        }
        setVendorsLoading(false);
      })
      .catch(() => {
        setVendorsError(true);
        setVendorsLoading(false);
      });
      
    // Fetch Cities
    setCitiesLoading(true);
    setCitiesError(false);
    fetch('/api/admin/cities')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch cities');
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setCityList(data.filter((c: City) => c.active));
        }
        setCitiesLoading(false);
      })
      .catch(() => {
        setCitiesError(true);
        setCitiesLoading(false);
      });
  }, []);

  // Clear conditional fields on Lead Source change
  useEffect(() => {
    if (leadSource !== 'Referral') setReferralName('');
    if (leadSource !== 'Calling Activity') setCallingExecutiveId('');
    if (leadSource !== 'Other') setOtherLeadSource('');
    if (leadSource !== 'Sub-Vendor') {
      setSubVendorId('');
      setSubVendorQuery('');
    }
    // Salesman behaves differently: only hidden for Sub-Vendor
    if (leadSource === 'Sub-Vendor') {
      setSalesmanId('');
    }
  }, [leadSource]);

  // Debounced Zoho Search
  useEffect(() => {
    if (zohoSearchQuery.length < 3) {
      setZohoResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      setZohoSearching(true);
      try {
        const res = await fetch(`/api/admin/customer-statement/search?q=${encodeURIComponent(zohoSearchQuery)}`);
        const data = await res.json();
        if (data.success && data.customers) {
          setZohoResults(data.customers);
        }
      } catch (e) {
        console.error('Zoho search failed', e);
      } finally {
        setZohoSearching(false);
      }
    }, 600);

    return () => clearTimeout(handler);
  }, [zohoSearchQuery]);

  const validateForm = () => {
    if (!customerName.trim()) {
      toast.error('Customer Name is required');
      return false;
    }
    if (!phoneNumber || phoneNumber.length !== 10 || !/^\d{10}$/.test(phoneNumber)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return false;
    }
    if (!orderDate) {
      toast.error('Order Date is required');
      return false;
    }
    const today = new Date().toISOString().split('T')[0];
    const maxPastDate = new Date();
    maxPastDate.setDate(maxPastDate.getDate() - 365);
    const minDateStr = maxPastDate.toISOString().split('T')[0];
    if (orderDate > today) {
      toast.error('Order date cannot be in the future.');
      return false;
    }
    if (orderDate < minDateStr) {
      toast.error('Order date cannot be older than one year.');
      return false;
    }
    if (!address.trim()) {
      toast.error('Address is required');
      return false;
    }
    if (!city.trim()) {
      toast.error('City is required');
      return false;
    }
    if (leadSource === 'Referral' && !referralName.trim()) {
      toast.error('Referred By is required');
      return false;
    }
    if (leadSource === 'Calling Activity' && !callingExecutiveId) {
      toast.error('Calling Executive is required');
      return false;
    }
    if (leadSource === 'Other' && !otherLeadSource.trim()) {
      toast.error('Please specify the custom lead source');
      return false;
    }
    if (leadSource === 'Sub-Vendor' && !subVendorId) {
      toast.error('Sub-Vendor is required');
      return false;
    }
    if (leadSource !== 'Sub-Vendor' && !salesmanId) {
      toast.error('Salesman is required');
      return false;
    }
    if (!systemSize || Number(systemSize) <= 0 || !/^\d+(\.\d)?$/.test(systemSize)) {
      toast.error('Please enter a valid system size (positive number, max 1 decimal place)');
      return false;
    }
    if (!totalOrderAmount || !/^\d+$/.test(totalOrderAmount) || Number(totalOrderAmount) < 0) {
      toast.error('Total Order Amount must be a positive integer');
      return false;
    }
    if (panels.length === 0 || panels.some(p => !p.description.trim() || !p.quantity || Number(p.quantity) <= 0 || !Number.isInteger(Number(p.quantity)))) {
      toast.error('Please add at least one valid panel with description and positive integer quantity');
      return false;
    }
    if (inverters.length === 0 || inverters.some(i => !i.description.trim() || !i.quantity || Number(i.quantity) <= 0 || !Number.isInteger(Number(i.quantity)))) {
      toast.error('Please add at least one valid inverter with description and positive integer quantity');
      return false;
    }
    if (floorNumber && (Number(floorNumber) < 0 || Number(floorNumber) > 100 || !Number.isInteger(Number(floorNumber)))) {
      toast.error('Floor number must be an integer between 0 and 100');
      return false;
    }
    return true;
  };

  const handleSystemSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d{0,1}$/.test(val)) {
      setSystemSize(val);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(val);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); // Remove non-digits
    setTotalOrderAmount(val);
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setShowPreview(true);
    }
  };

  const addPanelRow = () => setPanels([...panels, { id: Math.random().toString(), description: '', quantity: '' }]);
  const removePanelRow = (id: string) => setPanels(panels.filter(p => p.id !== id));
  const updatePanel = (id: string, field: string, value: string) => {
    setPanels(panels.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addInverterRow = () => setInverters([...inverters, { id: Math.random().toString(), description: '', quantity: '' }]);
  const removeInverterRow = (id: string) => setInverters(inverters.filter(i => i.id !== id));
  const updateInverter = (id: string, field: string, value: string) => {
    setInverters(inverters.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (files: File[]) => {
    const validFiles = files.filter(f => {
      const isType = ['image/jpeg', 'image/png', 'image/heic'].includes(f.type) || f.name.toLowerCase().endsWith('.heic');
      const isSize = f.size <= 5 * 1024 * 1024;
      if (!isType) toast.error(`${f.name} has unsupported format.`);
      if (!isSize) toast.error(`${f.name} exceeds 5MB limit.`);
      return isType && isSize;
    });

    if (siteImages.length + validFiles.length > 5) {
      toast.error('Maximum 5 images allowed.');
      validFiles.splice(5 - siteImages.length);
    }

    const newImages = validFiles.map(file => ({
      id: Math.random().toString(),
      file,
      preview: URL.createObjectURL(file)
    }));

    setSiteImages([...siteImages, ...newImages]);
  };
  
  const removeImage = (id: string) => {
    setSiteImages(siteImages.filter(img => img.id !== id));
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);
    const combinedRemarks = [
      remarks.trim(),
      `Address: ${address.trim()}`,
      `City: ${city.trim()}`
    ].filter(Boolean).join('\\n');

    try {
      const uploadedImages = [];
      for (const img of siteImages) {
        if (!img.file) continue;
        const formData = new FormData();
        formData.append('file', img.file);
        
        try {
          const upRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          if (upRes.ok) {
            const result = await upRes.json();
            uploadedImages.push({
              url: result.url,
              fileName: result.fileName,
              fileSize: result.fileSize,
              mimeType: result.mimeType,
            });
          } else {
            throw new Error('Upload failed');
          }
        } catch (e) {
          toast.error(`Failed to upload image`);
          setLoading(false);
          return;
        }
      }

      const payload: any = {
        customerName,
        phoneNumber, 
        whatsappEnabled: false, 
        leadSource: leadSource === 'Other' ? otherLeadSource : leadSource,
        referralName: leadSource === 'Referral' ? referralName : null,
        callingExecutiveId: leadSource === 'Calling Activity' ? callingExecutiveId : null,
        salesmanId: leadSource !== 'Sub-Vendor' ? salesmanId : null,
        subVendorId: leadSource === 'Sub-Vendor' ? subVendorId : null,
        loanCustomer,
        totalOrderAmount: parseFloat(totalOrderAmount),
        systemSize: parseFloat(systemSize),
        systemType,
        remarks: combinedRemarks,
        zohoBooksCustomerId: selectedZohoCustomer?.id || null,
        zohoBooksCustomerName: selectedZohoCustomer?.name || null,
        floorNumber: floorNumber ? Number(floorNumber) : null,
        orderDate,
        panels: panels.map(p => ({ description: p.description, quantity: Number(p.quantity) })),
        inverters: inverters.map(i => ({ description: i.description, quantity: Number(i.quantity) })),
        siteImages: uploadedImages
      };

      if (currentMode === 'CREATE') {
        const res = await fetch('/api/solar-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) {
          toast.success(`Order ${data.order.orderNumber} created successfully`);
          setTimeout(() => { router.push(`/staff/dashboard/solar-orders/orders/${data.order.id}`); }, 1500);
        } else if (res.status === 409 && data.code === 'ZOHO_CUSTOMER_ALREADY_LINKED') {
          setDuplicateError({ ...data, customerName: selectedZohoCustomer?.name || 'Unknown' });
          setShowPreview(false);
        } else {
          toast.error(data.error || 'Failed to create order');
          setShowPreview(false);
        }
      } else if (currentMode === 'EDIT') {
        payload.isMasterEdit = true;
        const res = await fetch(`/api/solar-orders/${initialOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (res.ok) {
          toast.success('Order updated successfully');
          setTimeout(() => { window.location.reload(); }, 1500);
        } else if (res.status === 409 && data.code === 'ZOHO_CUSTOMER_ALREADY_LINKED') {
          setDuplicateError({ ...data, customerName: selectedZohoCustomer?.name || 'Unknown' });
          setShowPreview(false);
        } else {
          toast.error(data.error || 'Failed to update order');
          setShowPreview(false);
        }
      }
    } catch (err) {
      toast.error('Network error occurred');
      setShowPreview(false);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubVendors = vendorList.filter(v => v.name.toLowerCase().includes(subVendorQuery.toLowerCase()));
  const selectedSubVendor = vendorList.find(v => v.id === subVendorId);

  const filteredCities = cityList.filter(c => c.name.toLowerCase().includes(cityQuery.toLowerCase()));

  // Validation Statuses for Real-Time Summary
  const isNameValid = customerName.trim().length > 0;
  const isPhoneValid = phoneNumber.length === 10;
  const isAddressValid = address.trim().length > 0;
  const isCityValid = city.trim().length > 0;
  const isLeadSourceValid = 
    leadSource === 'Referral' ? referralName.trim().length > 0 :
    leadSource === 'Calling Activity' ? !!callingExecutiveId :
    leadSource === 'Other' ? otherLeadSource.trim().length > 0 :
    leadSource === 'Sub-Vendor' ? !!subVendorId : true;
  const isSystemValid = systemSize && Number(systemSize) > 0;
  const isAmountValid = totalOrderAmount && /^\d+$/.test(totalOrderAmount);
  const isAssignmentValid = leadSource === 'Sub-Vendor' ? !!subVendorId : !!salesmanId;

  const totalSteps = 7;
  const completedSteps = [
    isNameValid && isPhoneValid && !!orderDate,
    isAddressValid && isCityValid,
    isLeadSourceValid,
    isSystemValid,
    isAmountValid,
    isAssignmentValid
  ].filter(Boolean).length;

  
  const isView = currentMode === 'VIEW';
  const inputClasses = isView 
    ? "w-full text-sm font-medium text-gray-900 bg-transparent border-transparent px-0 py-1.5 cursor-default focus:outline-none appearance-none pointer-events-none resize-none" 
    : "w-full bg-transparent border-b border-gray-200 px-0 py-2 text-sm focus:outline-none focus:border-blue-600 transition-colors placeholder:text-gray-300";
  const selectClasses = isView
    ? "w-full text-sm font-medium text-gray-900 bg-transparent border-transparent px-0 py-1.5 cursor-default focus:outline-none appearance-none pointer-events-none" 
    : "w-full bg-transparent border-b border-gray-200 px-0 py-2 text-sm focus:outline-none focus:border-blue-600 transition-colors placeholder:text-gray-300";

  
  const labelClasses = "block text-xs font-semibold text-gray-400 mb-1 tracking-wider uppercase";
  const RequiredMark = () => <span className="text-red-500 ml-0.5 font-bold">*</span>;
  const sectionClasses = "bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6";
  const sectionTitleClasses = "text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b border-gray-50 pb-2";

  return (
    <>
      
      {currentMode !== 'CREATE' && (
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            {currentMode === 'EDIT' && <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-md tracking-wider">EDIT MODE</span>}
          </div>
          {currentMode === 'VIEW' && canMasterEdit && (
            <button
              onClick={() => setCurrentMode('EDIT')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Edit Order
            </button>
          )}
        </div>
      )}
<form onSubmit={handlePreview} className="w-full pb-28 animate-in fade-in duration-300">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (Core Details) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Customer & Lead Information */}
            <div className={sectionClasses}>
              <h2 className={sectionTitleClasses}>
                <User size={14} className="text-blue-500" />
                Customer & Lead Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className="md:col-span-2">
                  <label className={labelClasses}>Full Name <RequiredMark/></label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    readOnly={isView} disabled={isView} className={inputClasses}
                    placeholder="e.g. Ramesh Patel"
                  />
                </div>
                
                <div>
                  <label className={labelClasses}>Phone Number <RequiredMark/></label>
                  <div className="flex items-end border-b border-gray-200 focus-within:border-blue-600 transition-colors">
                    <span className="text-sm text-gray-400 font-medium pb-2 pr-2 border-r border-gray-200 select-none">+91</span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      className="w-full bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-gray-300"
                      placeholder="9876543210"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClasses}>Order Date <RequiredMark/></label>
                  <input
                    type="date"
                    value={orderDate}
                    max={new Date().toISOString().split('T')[0]}
                    min={new Date(new Date().setDate(new Date().getDate() - 365)).toISOString().split('T')[0]}
                    onChange={e => setOrderDate(e.target.value)}
                    readOnly={isView} disabled={isView} className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Lead Source <RequiredMark/></label>
                  <select
                    value={leadSource}
                    onChange={e => setLeadSource(e.target.value)}
                    disabled={isView} className={selectClasses}
                  >
                    <option value="Walk-in">Walk-in</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Referral">Referral</option>
                    <option value="Friends & Family">Friends & Family</option>
                    <option value="Calling Activity">Calling Activity</option>
                    <option value="Sub-Vendor">Sub-Vendor</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {leadSource === 'Referral' && (
                  <div className="md:col-span-2 animate-in slide-in-from-top-2 fade-in">
                    <label className={labelClasses}>Referred By <RequiredMark/></label>
                    <input
                      type="text"
                      value={referralName}
                      onChange={e => setReferralName(e.target.value)}
                      readOnly={isView} disabled={isView} className={inputClasses}
                      placeholder="e.g. Suresh Kumar"
                    />
                  </div>
                )}

                {leadSource === 'Other' && (
                  <div className="md:col-span-2 animate-in slide-in-from-top-2 fade-in">
                    <label className={labelClasses}>Specify Lead Source <RequiredMark/></label>
                    <input
                      type="text"
                      value={otherLeadSource}
                      onChange={e => setOtherLeadSource(e.target.value)}
                      readOnly={isView} disabled={isView} className={inputClasses}
                      placeholder="e.g. Exhibition, Newspaper Ad"
                    />
                  </div>
                )}

                <div className="relative">
                  <label className={labelClasses}>City <RequiredMark/></label>
                  <input
                    type="text"
                    value={cityQuery}
                    onFocus={() => setShowCityDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                    onChange={e => {
                      setCityQuery(e.target.value);
                      setShowCityDropdown(true);
                    }}
                    className={`${inputClasses} pr-8`}
                    placeholder={city || "Search active cities..."}
                  />
                  {showCityDropdown && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                      {citiesLoading ? (
                        <div className="px-4 py-2 text-sm text-gray-400">Loading cities...</div>
                      ) : citiesError ? (
                        <div className="px-4 py-2 text-sm text-red-500 flex justify-between items-center">
                          Unable to load cities.
                          <button type="button" onClick={() => window.location.reload()} className="text-xs underline text-red-600 hover:text-red-800">Retry</button>
                        </div>
                      ) : filteredCities.length > 0 ? filteredCities.map(c => (
                        <div
                          key={c.id}
                          onMouseDown={() => {
                            setCity(c.name);
                            setCityQuery('');
                            setShowCityDropdown(false);
                          }}
                          className="px-4 py-2 hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-sm text-gray-700 transition-colors"
                        >
                          {c.name}
                        </div>
                      )) : (
                        <div className="px-4 py-2 text-sm text-gray-400">No cities found</div>
                      )}
                    </div>
                  )}
                  {city && !showCityDropdown && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center pt-5">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium truncate max-w-[120px]">{city}</span>
                      <button type="button" onMouseDown={() => setCity('')} className="ml-1 text-gray-400 hover:text-red-500"><X size={14}/></button>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClasses}>Address <RequiredMark/></label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    readOnly={isView} disabled={isView} className={inputClasses}
                    placeholder="Building name, Street address"
                  />
                </div>
              </div>
            </div>

            {/* System & Commercials */}
            <div className={sectionClasses}>
              <h2 className={sectionTitleClasses}>
                <Zap size={14} className="text-amber-500" />
                System & Commercials
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <label className={labelClasses}>System Size (kW) <RequiredMark/></label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={systemSize}
                    onChange={handleSystemSizeChange}
                    readOnly={isView} disabled={isView} className={inputClasses}
                    placeholder="0.0"
                  />
                </div>
                
                <div>
                  <label className={labelClasses}>System Type <RequiredMark/></label>
                  <select
                    value={systemType}
                    onChange={e => setSystemType(e.target.value)}
                    disabled={isView} className={selectClasses}
                  >
                    <option value="ON_GRID">On-Grid</option>
                    <option value="OFF_GRID">Off-Grid</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className={labelClasses}>Total Order Amount (₹) <RequiredMark/></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={totalOrderAmount}
                    onChange={handleAmountChange}
                    readOnly={isView} disabled={isView} className={inputClasses}
                    placeholder="0"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-3 cursor-pointer group bg-gray-50/50 hover:bg-blue-50/50 px-4 py-2.5 rounded-xl border border-gray-100 hover:border-blue-100 transition-colors w-full">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={loanCustomer}
                        onChange={e => setLoanCustomer(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-4 h-4 border border-gray-300 rounded bg-white peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-colors"></div>
                      <CheckCircle2 size={12} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">Requires Loan Processing</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Site & Item Details */}
            <div className={sectionClasses}>
              <h2 className={sectionTitleClasses}>
                <ClipboardList size={14} className="text-blue-500" />
                Site & Item Details
              </h2>
              
              <div className="space-y-6">
                {/* Solar Panels */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className={labelClasses}>1. Solar Panels <RequiredMark/></label>
                    <button type="button" onClick={addPanelRow} className="text-xs text-blue-600 font-semibold hover:text-blue-800">+ Add Panel</button>
                  </div>
                  <div className="space-y-3">
                    {panels.map((panel, idx) => (
                      <div key={panel.id} className="flex gap-4 items-start">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={panel.description}
                            onChange={(e) => updatePanel(panel.id, 'description', e.target.value)}
                            className={`${inputClasses} bg-gray-50/50 px-3 rounded-lg`}
                            placeholder="e.g. Adani DCR 545 Watt"
                          />
                        </div>
                        <div className="w-24">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={panel.quantity}
                            onChange={(e) => updatePanel(panel.id, 'quantity', e.target.value.replace(/\D/g, ''))}
                            className={`${inputClasses} bg-gray-50/50 px-3 rounded-lg text-center`}
                            placeholder="Qty"
                          />
                        </div>
                        {panels.length > 1 && (
                          <button type="button" onClick={() => removePanelRow(panel.id)} className="mt-2 text-gray-400 hover:text-red-500 p-1">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* Inverters */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className={labelClasses}>2. Inverter <RequiredMark/></label>
                    <button type="button" onClick={addInverterRow} className="text-xs text-blue-600 font-semibold hover:text-blue-800">+ Add Inverter</button>
                  </div>
                  <div className="space-y-3">
                    {inverters.map((inverter, idx) => (
                      <div key={inverter.id} className="flex gap-4 items-start">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={inverter.description}
                            onChange={(e) => updateInverter(inverter.id, 'description', e.target.value)}
                            className={`${inputClasses} bg-gray-50/50 px-3 rounded-lg`}
                            placeholder="e.g. Sungrow SG5K-D"
                          />
                        </div>
                        <div className="w-24">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={inverter.quantity}
                            onChange={(e) => updateInverter(inverter.id, 'quantity', e.target.value.replace(/\D/g, ''))}
                            className={`${inputClasses} bg-gray-50/50 px-3 rounded-lg text-center`}
                            placeholder="Qty"
                          />
                        </div>
                        {inverters.length > 1 && (
                          <button type="button" onClick={() => removeInverterRow(inverter.id)} className="mt-2 text-gray-400 hover:text-red-500 p-1">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* Floor Number & Site Images */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className={labelClasses}>3. Floor No. (Optional)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={floorNumber}
                      onChange={(e) => setFloorNumber(e.target.value.replace(/\D/g, ''))}
                      readOnly={isView} disabled={isView} className={inputClasses}
                      placeholder="e.g. 0 for Ground Floor, 1 for First Floor"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100"></div>

                {/* File Uploads */}
                <div>
                  <label className={labelClasses}>4. Site Images (Optional)</label>
                  <p className="text-xs text-gray-400 mb-3">Maximum 5 Images • 5 MB each • PNG, JPG, JPEG, HEIC</p>
                  
                  <div 
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleFileDrop}
                    className="border-2 border-dashed border-gray-200 hover:border-blue-400 transition-colors rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50/50 text-center cursor-pointer relative"
                  >
                    <input 
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/heic"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      title="Upload site images"
                    />
                    <div className="bg-white p-3 rounded-full shadow-sm mb-3">
                      <FileText size={20} className="text-blue-500" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Drag & Drop Images Here</p>
                    <p className="text-xs text-gray-500 mt-1">or click to Browse Files</p>
                  </div>
                  
                  {siteImages.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                      {siteImages.map(img => (
                        <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square">
                          <img src={img.preview} alt="Site" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              type="button" 
                              onClick={() => removeImage(img.id)}
                              className="bg-white text-red-500 p-1.5 rounded-full hover:bg-red-50"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Additional Remarks */}
            <div className={sectionClasses}>
              <h2 className={sectionTitleClasses}>
                <FileText size={14} className="text-gray-400" />
                Additional Remarks
              </h2>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                className={`${inputClasses} border border-gray-200 rounded-lg p-3 bg-gray-50/50 focus:bg-white resize-none`}
                placeholder="Any special requests, installation constraints or notes..."
              />
            </div>
            
            {/* Zoho Mapping (Lightweight bottom element) */}
            <div className={`${sectionClasses} border-emerald-50 bg-emerald-50/10`}>
              <h2 className={sectionTitleClasses}>
                <img src="https://cdn.worldvectorlogo.com/logos/zoho-1.svg" className="w-3.5 h-3.5 opacity-70" alt="Zoho" />
                Zoho Mapping (Optional)
              </h2>
              
              {selectedZohoCustomer ? (
                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm flex items-start justify-between max-w-md">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <p className="font-bold text-xs text-gray-900 leading-tight">{selectedZohoCustomer.name}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 ml-3.5">ID: {selectedZohoCustomer.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedZohoCustomer(null); setZohoSearchQuery(''); }}
                    className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search Zoho contact by name..."
                    value={zohoSearchQuery}
                    onChange={e => setZohoSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500 bg-white"
                  />
                  {zohoSearching && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 animate-spin" size={12} />}
                  
                  {zohoResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg max-h-40 overflow-y-auto py-1 text-xs">
                      {zohoResults.map(c => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedZohoCustomer(c);
                            setZohoResults([]);
                          }}
                          className="px-3 py-2 hover:bg-emerald-50 cursor-pointer border-b border-gray-50 last:border-0"
                        >
                          <p className="font-semibold text-gray-800">{c.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">GST: {c.gstNumber || 'N/A'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Right Column (Assignment & Live Preview Sidebar) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Assignment Card */}
            {leadSource !== 'Sub-Vendor' || leadSource === 'Sub-Vendor' ? (
              <div className={sectionClasses}>
                <h2 className={sectionTitleClasses}>
                  <ClipboardList size={14} className="text-purple-500" />
                  Assignment
                </h2>
                
                <div className="space-y-5">
                  {leadSource === 'Sub-Vendor' && (
                    <div className="animate-in fade-in slide-in-from-top-2 relative">
                      <label className={labelClasses}>Sub-Vendor <RequiredMark/></label>
                      <div className="relative">
                        <input
                          type="text"
                          value={subVendorQuery}
                          onFocus={() => setShowSubVendorDropdown(true)}
                          onBlur={() => setTimeout(() => setShowSubVendorDropdown(false), 200)}
                          onChange={e => {
                            setSubVendorQuery(e.target.value);
                            setShowSubVendorDropdown(true);
                          }}
                          className={`${inputClasses} pr-8`}
                          placeholder={selectedSubVendor?.name || "Search active vendors..."}
                        />
                        {showSubVendorDropdown && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                            {vendorsLoading ? (
                              <div className="px-4 py-2 text-sm text-gray-400">Loading vendors...</div>
                            ) : vendorsError ? (
                              <div className="px-4 py-2 text-sm text-red-500 flex justify-between items-center">
                                Unable to load vendors.
                                <button type="button" onClick={() => window.location.reload()} className="text-xs underline text-red-600 hover:text-red-800">Retry</button>
                              </div>
                            ) : filteredSubVendors.length > 0 ? filteredSubVendors.map(vendor => (
                              <div
                                key={vendor.id}
                                onClick={() => {
                                  setSubVendorId(vendor.id);
                                  setSubVendorQuery('');
                                  setShowSubVendorDropdown(false);
                                }}
                                className="px-4 py-2 hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-sm text-gray-700 transition-colors"
                              >
                                {vendor.name}
                              </div>
                            )) : (
                              <div className="px-4 py-2 text-sm text-gray-400">No vendors found</div>
                            )}
                          </div>
                        )}
                        {selectedSubVendor && !showSubVendorDropdown && (
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium truncate max-w-[120px]">{selectedSubVendor.name}</span>
                            <button type="button" onClick={() => setSubVendorId('')} className="ml-1 text-gray-400 hover:text-red-500"><X size={14}/></button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {leadSource === 'Calling Activity' && (
                    <div className="animate-in slide-in-from-top-2">
                      <label className={labelClasses}>Calling Executive <RequiredMark/></label>
                      <select
                        value={callingExecutiveId}
                        onChange={e => setCallingExecutiveId(e.target.value)}
                        disabled={isView} className={selectClasses}
                      >
                        <option value="">-- Select --</option>
                        {staffList.map(staff => (
                          <option key={`ce-${staff.id}`} value={staff.id}>{staff.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {leadSource !== 'Sub-Vendor' && (
                    <div className="animate-in slide-in-from-top-2">
                      <label className={labelClasses}>Salesman <RequiredMark/></label>
                      <select
                        value={salesmanId}
                        onChange={e => setSalesmanId(e.target.value)}
                        disabled={isView} className={selectClasses}
                      >
                        <option value="">-- Select --</option>
                        {staffList.map(staff => (
                          <option key={`sm-${staff.id}`} value={staff.id}>{staff.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Live Order Summary Card (Premium Stripe/Linear style sidebar panel) */}
            <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Order Preview</h3>
                <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                  Step {completedSteps} of {totalSteps}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Client</span>
                  <p className="text-sm font-semibold truncate text-white">{customerName || '—'}</p>
                  <p className="text-xs text-slate-400">{phoneNumber ? `+91 ${phoneNumber}` : 'No phone number'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{city || address ? `${city || '—'}, ${address || '—'}` : 'No address specified'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-800/60 pt-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">System Size</span>
                    <p className="text-sm font-bold text-white">{systemSize ? `${systemSize} kWp` : '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Type</span>
                    <p className="text-sm font-semibold text-white">{systemType.replace('_', '-')}</p>
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-3 space-y-2">
                  <span className="text-[10px] text-slate-500 block uppercase">Items & Site</span>
                  
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400">Solar Panels</span>
                    <ul className="text-xs text-white space-y-0.5">
                      {panels.filter(p => p.description && p.quantity).length > 0 ? 
                        panels.filter(p => p.description && p.quantity).map(p => (
                          <li key={p.id}>• {p.description} × {p.quantity}</li>
                        )) : <li className="text-slate-500">—</li>
                      }
                    </ul>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400">Inverters</span>
                    <ul className="text-xs text-white space-y-0.5">
                      {inverters.filter(i => i.description && i.quantity).length > 0 ? 
                        inverters.filter(i => i.description && i.quantity).map(i => (
                          <li key={i.id}>• {i.description} × {i.quantity}</li>
                        )) : <li className="text-slate-500">—</li>
                      }
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[10px] text-slate-400">Floor</span>
                      <p className="text-xs text-white">{floorNumber || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Images</span>
                      <p className="text-xs text-white">{siteImages.length} Uploaded</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-3">
                  <span className="text-[10px] text-slate-500 block uppercase">Commercial Value</span>
                  <div className="flex justify-between items-end">
                    <p className="text-lg font-extrabold text-emerald-400">
                      {totalOrderAmount ? `₹${parseInt(totalOrderAmount, 10).toLocaleString('en-IN')}` : '—'}
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                      {totalOrderAmount && systemSize && Number(systemSize) > 0 ? `₹${(parseInt(totalOrderAmount, 10) / Number(systemSize)).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / kW` : '— / kW'}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-3 space-y-1">
                  <span className="text-[10px] text-slate-500 block uppercase">Fulfillment / Assignment</span>
                  <p className="text-xs text-slate-300">
                    <span className="text-slate-500">Source:</span> {leadSource === 'Other' ? otherLeadSource || 'Other' : leadSource}
                  </p>
                  {leadSource === 'Sub-Vendor' ? (
                    <p className="text-xs text-slate-300">
                      <span className="text-slate-500">Vendor:</span> {selectedSubVendor?.name || 'Unassigned'}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-slate-300">
                        <span className="text-slate-500">Salesman:</span> {staffList.find(s => s.id === salesmanId)?.name || 'Unassigned'}
                      </p>
                      {leadSource === 'Calling Activity' && (
                        <p className="text-xs text-slate-300">
                          <span className="text-slate-500">Calling Exec:</span> {staffList.find(s => s.id === callingExecutiveId)?.name || 'Unassigned'}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Checklist validation */}
                <div className="border-t border-slate-800 pt-4 space-y-2">
                  <span className="text-[10px] text-slate-500 block uppercase mb-1">Required Checklist</span>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${isNameValid && isPhoneValid ? 'bg-green-500/20 text-green-400' : 'bg-slate-800'}`}>
                        <Check size={8} />
                      </div>
                      <span>Customer Details</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${isAddressValid && isCityValid ? 'bg-green-500/20 text-green-400' : 'bg-slate-800'}`}>
                        <Check size={8} />
                      </div>
                      <span>Address & City</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${isLeadSourceValid ? 'bg-green-500/20 text-green-400' : 'bg-slate-800'}`}>
                        <Check size={8} />
                      </div>
                      <span>Lead Logic</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${isSystemValid ? 'bg-green-500/20 text-green-400' : 'bg-slate-800'}`}>
                        <Check size={8} />
                      </div>
                      <span>Capacity Specs</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${isAmountValid ? 'bg-green-500/20 text-green-400' : 'bg-slate-800'}`}>
                        <Check size={8} />
                      </div>
                      <span>Order Value</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${isAssignmentValid ? 'bg-green-500/20 text-green-400' : 'bg-slate-800'}`}>
                        <Check size={8} />
                      </div>
                      <span>Assignment</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-200 p-4 z-10">
          <div className="w-full px-6 2xl:px-12 mx-auto flex items-center justify-between font-medium">
            <p className="text-xs text-gray-500 hidden sm:flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Double check parameters in preview before confirmation.
            </p>
            <div className="flex justify-end gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 text-xs font-bold text-white bg-[#1A2766] rounded-lg shadow-sm hover:bg-[#152054] transition-all"
              >
                Review & Confirm
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Review Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                <AlertTriangle size={18} className="text-blue-600" />
                Review Order Details
              </h2>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-900 p-1 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Customer Information */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Customer Info</h3>
                  <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Name</span>
                      <span className="text-xs font-semibold text-gray-900">{customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Phone</span>
                      <span className="text-xs font-semibold text-gray-900">+91 {phoneNumber}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2">
                      <span className="text-xs text-gray-500">City</span>
                      <span className="text-xs font-semibold text-gray-900">{city}</span>
                    </div>
                    <div className="flex flex-col gap-1 border-t border-gray-200 pt-2">
                      <span className="text-[10px] text-gray-500">Address</span>
                      <span className="text-xs font-medium text-gray-800">{address}</span>
                    </div>
                  </div>
                </div>

                {/* Lead Information */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lead Info</h3>
                  <div className="bg-blue-50/20 p-4 rounded-xl border border-blue-50 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Source</span>
                      <span className="text-xs font-bold text-blue-600 bg-blue-100/50 px-2 py-0.5 rounded">
                        {leadSource === 'Other' ? otherLeadSource : leadSource}
                      </span>
                    </div>
                    {leadSource === 'Referral' && (
                      <div className="flex justify-between border-t border-blue-50/50 pt-2">
                        <span className="text-xs text-gray-500">Referred By</span>
                        <span className="text-xs font-semibold text-gray-900">{referralName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* System Specs */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">System Specifications</h3>
                  <div className="bg-amber-50/30 p-4 rounded-xl border border-amber-100/50 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Size</span>
                      <span className="text-xs font-bold text-gray-900">{systemSize} kWp</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Type</span>
                      <span className="text-xs font-semibold text-gray-900">{systemType.replace('_', '-')}</span>
                    </div>
                    <div className="flex justify-between border-t border-amber-100/50 pt-2">
                      <span className="text-xs text-gray-500">Amount</span>
                      <div className="text-right">
                        <div className="text-xs font-bold text-green-600">₹{parseInt(totalOrderAmount, 10).toLocaleString('en-IN')}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {totalOrderAmount && systemSize && Number(systemSize) > 0 ? `₹${(parseInt(totalOrderAmount, 10) / Number(systemSize)).toLocaleString('en-IN', { maximumFractionDigits: 0 })} / kW` : '— / kW'}
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Financing</span>
                      <span className="text-xs font-semibold text-gray-900">{loanCustomer ? 'Loan Processing Required' : 'Direct Payment'}</span>
                    </div>
                  </div>
                </div>

                {/* Site & Items Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Site & Items</h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500">Panels</span>
                      <ul className="text-xs font-semibold text-gray-900 space-y-0.5">
                        {panels.filter(p => p.description && p.quantity).length > 0 ? 
                          panels.filter(p => p.description && p.quantity).map(p => (
                            <li key={p.id}>• {p.description} × {p.quantity}</li>
                          )) : <li className="text-gray-400">—</li>
                        }
                      </ul>
                    </div>
                    <div className="flex flex-col gap-1 border-t border-slate-200 pt-2">
                      <span className="text-xs text-gray-500">Inverters</span>
                      <ul className="text-xs font-semibold text-gray-900 space-y-0.5">
                        {inverters.filter(i => i.description && i.quantity).length > 0 ? 
                          inverters.filter(i => i.description && i.quantity).map(i => (
                            <li key={i.id}>• {i.description} × {i.quantity}</li>
                          )) : <li className="text-gray-400">—</li>
                        }
                      </ul>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="text-xs text-gray-500">Floor</span>
                      <span className="text-xs font-semibold text-gray-900">{floorNumber || '—'}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2">
                      <span className="text-xs text-gray-500">Images</span>
                      <span className="text-xs font-semibold text-gray-900">{siteImages.length} Uploaded</span>
                    </div>
                  </div>
                </div>

                {/* Assignment */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assignment</h3>
                  <div className="bg-purple-50/20 p-4 rounded-xl border border-purple-50 space-y-3">
                    {leadSource !== 'Sub-Vendor' && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Salesman</span>
                        <span className="text-xs font-semibold text-gray-900">{staffList.find(s => s.id === salesmanId)?.name || 'Unassigned'}</span>
                      </div>
                    )}
                    {leadSource === 'Calling Activity' && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Calling Exec</span>
                        <span className="text-xs font-semibold text-gray-900">{staffList.find(s => s.id === callingExecutiveId)?.name || 'Unassigned'}</span>
                      </div>
                    )}
                    {leadSource === 'Sub-Vendor' && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Sub-Vendor</span>
                        <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                          {selectedSubVendor?.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Remarks */}
                <div className="space-y-4 lg:col-span-2">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Additional Info</h3>
                  <div className="bg-gray-50 p-4 rounded-xl space-y-3 h-full">
                    <div className="flex justify-start gap-4">
                      <span className="text-xs text-gray-500 w-24">Zoho Mapping:</span>
                      <span className="text-xs font-semibold text-gray-900">{selectedZohoCustomer ? selectedZohoCustomer.name : 'Unlinked'}</span>
                    </div>
                    {remarks && (
                      <div className="flex flex-col gap-1 pt-2 border-t border-gray-200">
                        <span className="text-[10px] text-gray-400">Remarks</span>
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{remarks}</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit Order
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 text-xs font-bold text-white bg-[#1A2766] rounded-lg hover:bg-[#152054] shadow-md hover:shadow-lg transition-all disabled:opacity-70"
              >
                {loading && <Loader2 size={12} className="animate-spin" />}
                {loading ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
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
}
