import { prisma } from '@/lib/db';
import { createPrinter, updatePrinter, deletePrinter, assignPrinterToUser } from '../actions';
import { Printer, Save, Trash2, Link as LinkIcon, UserPlus } from 'lucide-react';
import ActionForm, { FormSubmit } from '@/components/ActionForm';
import SafeDeleteButton from '@/components/SafeDeleteButton';

export default async function PrintersPage() {
  const [printers, users] = await Promise.all([
    prisma.printer.findMany({ orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Printer size={20} className="text-[#1A2766]" />
          Printer Management
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Create, edit, and assign network POS POS terminals centrally.
        </p>
      </div>

      {/* Add New Printer Form */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold mb-3 text-gray-600 uppercase tracking-wider">Add New Printer Terminal</h2>
        <ActionForm action={createPrinter} successMessage="Printer added successfully!" resetOnSuccess className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Printer Name *</label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. ABC_POS120"
              className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">IP Address *</label>
            <input
              type="text"
              name="ipAddress"
              required
              placeholder="e.g. 192.168.1.100"
              pattern="^(\d{1,3}\.){3}\d{1,3}$"
              title="Enter a valid IPv4 address"
              className="w-full border rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-[#1A2766] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Port *</label>
            <input
              type="number"
              name="port"
              defaultValue={9100}
              min={1}
              max={65535}
              required
              className="w-full border rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-[#1A2766] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Printer Type</label>
            <select name="printerType" defaultValue="ESC_POS" className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#1A2766] outline-none">
              <option value="ESC_POS">ESC/POS Thermal</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select name="isActive" defaultValue="true" className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#1A2766] outline-none">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <FormSubmit className="bg-[#AE1B1E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-800 transition-colors">
            Add Printer
          </FormSubmit>
        </ActionForm>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Printers Table Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">POS Terminals Registry ({printers.length})</h2>
            
            <div className="overflow-x-auto">
              <div className="min-w-[650px] divide-y divide-gray-100">
                {/* Header */}
                <div className="flex text-gray-400 font-bold uppercase text-[10px] tracking-wider pb-2">
                  <div className="w-1/3">Printer Name</div>
                  <div className="w-1/4">IP Address</div>
                  <div className="w-1/6">Port</div>
                  <div className="w-1/6">Status</div>
                  <div className="w-1/6 text-right">Actions</div>
                </div>

                {/* Body */}
                <div className="divide-y divide-gray-50 text-gray-700 pt-2">
                  {printers.map((p) => (
                    <ActionForm
                      key={p.id}
                      action={updatePrinter}
                      successMessage="Printer updated successfully!"
                      className="flex items-center py-2 hover:bg-gray-50/40 transition-colors"
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <div className="w-1/3 pr-2">
                        <input
                          type="text"
                          name="name"
                          defaultValue={p.name}
                          required
                          className="w-full border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#1A2766] outline-none"
                        />
                      </div>
                      <div className="w-1/4 pr-2">
                        <input
                          type="text"
                          name="ipAddress"
                          defaultValue={p.ipAddress}
                          required
                          pattern="^(\d{1,3}\.){3}\d{1,3}$"
                          className="w-full border rounded px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-[#1A2766] outline-none"
                        />
                      </div>
                      <div className="w-1/6 pr-2">
                        <input
                          type="number"
                          name="port"
                          defaultValue={p.port}
                          min={1}
                          max={65535}
                          required
                          className="w-full border rounded px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-[#1A2766] outline-none"
                        />
                      </div>
                      <div className="w-1/6 pr-2">
                        <select name="isActive" defaultValue={String(p.isActive)} className="w-full border rounded px-1.5 py-1 text-xs bg-white focus:ring-1 focus:ring-[#1A2766] outline-none">
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </div>
                      <div className="w-1/6 flex justify-end items-center gap-1.5">
                        <FormSubmit
                          className="text-[#1A2766] hover:bg-blue-50 p-1.5 rounded transition-colors"
                          icon={<Save size={13} />}
                        />
                        <SafeDeleteButton
                          action={deletePrinter}
                          id={p.id}
                          label="printer"
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </SafeDeleteButton>
                      </div>
                    </ActionForm>
                  ))}

                  {printers.length === 0 && (
                    <div className="py-8 text-center text-xs text-gray-400 italic">
                      No POS printers configured yet. Add one above.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Printer Assignments Panel */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus size={16} className="text-[#1A2766]" /> User Assignments
            </h2>
            <p className="text-[11px] text-gray-400 leading-normal">
              Map a central printer terminal directly to active warehouse staff users.
            </p>

            <div className="space-y-3 pt-2">
              {users.map((u) => (
                <ActionForm
                  key={u.id}
                  action={assignPrinterToUser}
                  successMessage={`Printer assigned to ${u.name}!`}
                  className="flex items-center justify-between border-b pb-3 last:border-b-0 last:pb-0 gap-2"
                >
                  <input type="hidden" name="userId" value={u.id} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-800">{u.name}</span>
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-gray-400">{u.role}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <select
                      name="printerId"
                      defaultValue={u.printerId || ''}
                      className="border rounded px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-[#1A2766] outline-none"
                    >
                      <option value="">-- Unassigned --</option>
                      {printers.filter(p => p.isActive).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <FormSubmit
                      className="text-[#1A2766] hover:bg-blue-50 p-1 rounded transition-colors"
                      icon={<LinkIcon size={12} />}
                    />
                  </div>
                </ActionForm>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
