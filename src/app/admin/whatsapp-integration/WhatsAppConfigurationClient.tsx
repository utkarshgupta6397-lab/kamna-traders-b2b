'use client';

import { useState, useEffect } from 'react';
import { Eye, EyeOff, Copy, Save, Plug, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

const MASKED_TOKEN_PLACEHOLDER = '••••••••••••••••••••••••••••••••••••••••';

export default function WhatsAppConfigurationClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const [formData, setFormData] = useState({
    appId: '',
    encryptedAccessToken: '',
    phoneNumberId: '',
    businessAccountId: '',
    businessName: '',
    displayPhoneNumber: '',
    apiVersion: 'v25.0',
    webhookVerifyToken: '',
    integrationEnabled: false,
    connectionStatus: 'NOT_TESTED',
    testPhoneNumber: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/admin/whatsapp-integration');
      const json = await res.json();
      
      if (json.data) {
        const config = json.data;
        setFormData({
          appId: config.appId || '',
          encryptedAccessToken: config.encryptedAccessToken || '',
          phoneNumberId: config.phoneNumberId || '',
          businessAccountId: config.businessAccountId || '',
          businessName: config.businessName || '',
          displayPhoneNumber: config.displayPhoneNumber || '',
          apiVersion: config.apiVersion || 'v25.0',
          webhookVerifyToken: config.webhookVerifyToken || '',
          integrationEnabled: config.integrationEnabled ?? false,
          connectionStatus: config.connectionStatus || 'NOT_TESTED',
          testPhoneNumber: config.testPhoneNumber || ''
        });
        setIsSaved(true);
      }
    } catch (err) {
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    setIsSaved(false);
  };

  const generateVerifyToken = () => {
    const randomToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    handleChange('webhookVerifyToken', randomToken);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (text === MASKED_TOKEN_PLACEHOLDER) {
      toast.error('Cannot copy masked token');
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.appId) newErrors.appId = 'Meta App ID cannot be empty.';
    if (!formData.encryptedAccessToken) newErrors.encryptedAccessToken = 'Access Token cannot be empty.';
    if (!formData.phoneNumberId) newErrors.phoneNumberId = 'Phone Number ID cannot be empty.';
    if (!formData.businessAccountId) newErrors.businessAccountId = 'WhatsApp Business Account ID cannot be empty.';
    if (!formData.apiVersion) newErrors.apiVersion = 'API Version cannot be empty.';
    if (!formData.webhookVerifyToken) newErrors.webhookVerifyToken = 'Verify Token cannot be empty.';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix the validation errors.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/whatsapp-integration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Configuration saved successfully!');
        await loadConfig(); // Reload from DB to ensure state is perfectly synced
      } else {
        toast.error(json.error || 'Failed to save configuration');
      }
    } catch (err) {
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    const loadingToast = toast.loading('Testing connection to Meta Graph API...');
    try {
      const res = await fetch('/api/admin/whatsapp-integration/test-connection', {
        method: 'POST'
      });
      
      const json = await res.json();
      
      if (res.ok && json.success) {
        toast.success('Connection successful!', { id: loadingToast });
        await loadConfig(); // Reload from DB to get the newly saved business name, etc
      } else {
        toast.error(`Connection failed: ${json.error || 'Unknown error'}`, { id: loadingToast, duration: 5000 });
        await loadConfig(); // Reload to reflect FAILED status
      }
    } catch (err) {
      toast.error('An error occurred while testing the connection.', { id: loadingToast });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex justify-center items-center h-48">
        <RefreshCw className="animate-spin text-gray-400" size={24} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-4xl">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-[#1A2766]">Meta Cloud API Credentials</h3>
          {formData.connectionStatus === 'CONNECTED' && (
            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase">Connected</span>
          )}
          {formData.connectionStatus === 'FAILED' && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase">Failed</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-700 cursor-pointer" htmlFor="enable-switch">Integration Enabled</label>
          <div 
            className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${formData.integrationEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
            onClick={() => handleChange('integrationEnabled', !formData.integrationEnabled)}
            id="enable-switch"
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${formData.integrationEnabled ? 'translate-x-5' : ''}`}></div>
          </div>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Meta App ID <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 outline-none ${errors.appId ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-[#1A2766]/20'}`}
              placeholder="e.g. 123456789012345"
              value={formData.appId}
              onChange={(e) => handleChange('appId', e.target.value)}
            />
            {errors.appId && <p className="text-xs text-red-500 mt-1">{errors.appId}</p>}
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Access Token <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input 
                type={showToken ? 'text' : 'password'} 
                className={`w-full pl-3 pr-20 py-2 text-sm border rounded-lg focus:ring-2 outline-none ${errors.encryptedAccessToken ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-[#1A2766]/20'} ${formData.encryptedAccessToken === MASKED_TOKEN_PLACEHOLDER ? 'bg-gray-50 text-gray-500' : ''}`}
                placeholder="EAXXXXXXXXXX..."
                value={formData.encryptedAccessToken}
                onChange={(e) => handleChange('encryptedAccessToken', e.target.value)}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button 
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                  title={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button 
                  type="button"
                  onClick={() => copyToClipboard(formData.encryptedAccessToken, 'Access Token')}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
            {errors.encryptedAccessToken && <p className="text-xs text-red-500 mt-1">{errors.encryptedAccessToken}</p>}
            <p className="text-[10px] text-gray-500 mt-1">Permanent access token from Meta App Dashboard.</p>
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Phone Number ID <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 outline-none ${errors.phoneNumberId ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-[#1A2766]/20'}`}
              placeholder="e.g. 10192837465"
              value={formData.phoneNumberId}
              onChange={(e) => handleChange('phoneNumberId', e.target.value)}
            />
            {errors.phoneNumberId && <p className="text-xs text-red-500 mt-1">{errors.phoneNumberId}</p>}
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              WhatsApp Business Account ID <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 outline-none ${errors.businessAccountId ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-[#1A2766]/20'}`}
              placeholder="e.g. 10192837465"
              value={formData.businessAccountId}
              onChange={(e) => handleChange('businessAccountId', e.target.value)}
            />
            {errors.businessAccountId && <p className="text-xs text-red-500 mt-1">{errors.businessAccountId}</p>}
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-bold text-gray-700 mb-1">Business Name</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none bg-gray-50 text-gray-500 cursor-not-allowed" 
              placeholder="Will be populated after successful Test Connection."
              value={formData.businessName}
              readOnly
            />
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
            <input 
              type="text" 
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none bg-gray-50 text-gray-500 cursor-not-allowed" 
              placeholder="Will be populated after successful Test Connection."
              value={formData.displayPhoneNumber}
              readOnly
            />
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-bold text-gray-700 mb-1">Test Recipient Number</label>
            <input 
              type="text" 
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 outline-none border-gray-200 focus:ring-[#1A2766]/20`}
              placeholder="+91 8744832318"
              value={formData.testPhoneNumber}
              onChange={(e) => handleChange('testPhoneNumber', e.target.value)}
            />
            <p className="text-[10px] text-gray-500 mt-1">Used only for template testing. Production messages ignore this field.</p>
          </div>

          <div className="col-span-1">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              API Version <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 outline-none ${errors.apiVersion ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-[#1A2766]/20'}`}
              value={formData.apiVersion}
              onChange={(e) => handleChange('apiVersion', e.target.value)}
            />
            {errors.apiVersion && <p className="text-xs text-red-500 mt-1">{errors.apiVersion}</p>}
          </div>
          
          <div className="col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Webhook Verify Token <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  className={`w-full pl-3 pr-10 py-2 text-sm border rounded-lg focus:ring-2 outline-none ${errors.webhookVerifyToken ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-[#1A2766]/20'}`}
                  placeholder="Custom secure string for webhook validation"
                  value={formData.webhookVerifyToken}
                  onChange={(e) => handleChange('webhookVerifyToken', e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => copyToClipboard(formData.webhookVerifyToken, 'Verify Token')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy size={14} />
                </button>
              </div>
              <button 
                type="button"
                onClick={generateVerifyToken}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-200 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                <RefreshCw size={14} />
                Generate Random
              </button>
            </div>
            {errors.webhookVerifyToken && <p className="text-xs text-red-500 mt-1">{errors.webhookVerifyToken}</p>}
          </div>

        </div>
      </div>
      
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3 flex-wrap">
        <button 
          className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg transition-colors shadow-sm ${(testing || !isSaved) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
          disabled={testing || !isSaved}
          onClick={handleTestConnection}
        >
          {testing ? <RefreshCw className="animate-spin" size={16} /> : <Plug size={16} />}
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-[#1A2766] text-white text-sm font-bold rounded-lg hover:bg-[#1A2766]/90 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
