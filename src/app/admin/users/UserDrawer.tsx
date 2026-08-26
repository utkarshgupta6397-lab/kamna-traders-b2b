'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ActionForm, { FormSubmit } from '@/components/ActionForm';
import { Select } from '@/components/ui/Select';

interface User {
  id: string;
  name: string;
  mobile: string;
  role: string;
  active: boolean;
  pin: string | null;
}

interface UserDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null; // null/undefined means Add mode
  createUserAction: (data: FormData) => Promise<any>;
  updateUserAction: (data: FormData) => Promise<any>;
}

export default function UserDrawer({ isOpen, onClose, user, createUserAction, updateUserAction }: UserDrawerProps) {
  const isEdit = !!user;
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus or just prevent background scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Wrapper for actions to close drawer on success
  // We check if it returns an error object, if not, it likely succeeded.
  const handleCreate = async (formData: FormData) => {
    const result = await createUserAction(formData);
    if (!result || !('error' in result)) {
      onClose();
    }
    return result;
  };

  const handleUpdate = async (formData: FormData) => {
    const result = await updateUserAction(formData);
    if (!result || !('error' in result)) {
      onClose();
    }
    return result;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        ref={drawerRef}
        className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit User' : 'Add New User'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <ActionForm 
            action={isEdit ? handleUpdate : handleCreate} 
            successMessage={isEdit ? "User updated successfully" : "User created successfully"}
            resetOnSuccess={!isEdit}
            className="space-y-4"
          >
            {isEdit && <input type="hidden" name="id" value={user.id} />}
            
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input 
                type="text" 
                name="name" 
                required 
                defaultValue={user?.name || ''}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#1A2766] focus:border-transparent outline-none transition-shadow" 
                placeholder="Full name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Mobile</label>
              <input 
                type="text" 
                name="mobile" 
                required 
                defaultValue={user?.mobile || ''}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#1A2766] focus:border-transparent outline-none transition-shadow font-mono" 
                maxLength={10} 
                placeholder="10-digit number"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <Select 
                name="role" 
                defaultValue={user?.role || 'STAFF'}
                options={[
                  { label: 'Staff', value: 'STAFF' },
                  { label: 'Admin', value: 'ADMIN' }
                ]} 
                className="w-full h-10 border-gray-300"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">PIN (6-digit)</label>
              <input 
                type="text" 
                name="pin" 
                maxLength={6} 
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#1A2766] focus:border-transparent outline-none transition-shadow font-mono" 
                placeholder={isEdit ? "Leave empty to keep current" : "Auto-generated if empty"} 
              />
            </div>

            {isEdit && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <Select 
                  name="active" 
                  defaultValue={String(user.active)}
                  options={[
                    { label: 'Active', value: 'true' },
                    { label: 'Inactive', value: 'false' }
                  ]}
                  className="w-full h-10 border-gray-300"
                />
              </div>
            )}

            <div className="pt-6 flex items-center justify-end gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A2766]"
              >
                Cancel
              </button>
              <FormSubmit className="bg-[#1A2766] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#003347] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A2766] transition-colors">
                {isEdit ? 'Save Changes' : 'Create User'}
              </FormSubmit>
            </div>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
