import { prisma } from '@/lib/db';
import { createPrinter, updatePrinter, setPrinterEnabled } from '../actions';
import { Printer, Save, Power, PowerOff, Wifi, PrinterCheck } from 'lucide-react';
import ActionForm, { FormSubmit } from '@/components/ActionForm';
import PrinterToggleButton from './PrinterToggleButton';

export default async function PrintersPage() {
  const printers = await prisma.printer.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Printer size={20} className="text-[#1A2766]" />
          Printer Management
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Manage network POS printers. Phase 1 — registry only. Live status and printing in Phase 2.
        </p>
      </div>

      {/* ── Add Printer Form ─────────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold mb-3 text-gray-600 uppercase tracking-wider">Add New Printer</h2>
        <ActionForm action={createPrinter} successMessage="Printer added!" resetOnSuccess className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Printer Name *</label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Warehouse A – Main"
              className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">IP Address *</label>
            <input
              type="text"
              name="ipAddress"
              required
              placeholder="192.168.1.100"
              pattern="^(\d{1,3}\.){3}\d{1,3}$"
              title="Enter a valid IPv4 address"
              className="w-full border rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-[#1A2766] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
            <input
              type="number"
              name="port"
              defaultValue={9100}
              min={1}
              max={65535}
              className="w-full border rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-[#1A2766] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <input
              type="text"
              name="description"
              placeholder="Optional note"
              className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#1A2766] outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select name="enabled" defaultValue="true" className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#1A2766] outline-none">
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <FormSubmit className="bg-[#AE1B1E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-800 transition-colors">
            Add Printer
          </FormSubmit>
        </ActionForm>
      </div>

      {/* ── Printer Table ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header */}
          <div className="flex bg-gray-50 border-b text-gray-500 uppercase tracking-wider text-xs font-medium">
            <div className="w-48 p-3">Printer Name</div>
            <div className="w-36 p-3">IP Address</div>
            <div className="w-20 p-3">Port</div>
            <div className="w-24 p-3">Status</div>
            <div className="flex-1 p-3">Description</div>
            <div className="w-56 p-3 text-right">Actions</div>
          </div>

          {/* Body */}
          <div className="divide-y divide-gray-50 text-gray-700">
            {printers.map((p) => (
              <ActionForm
                key={p.id}
                action={updatePrinter}
                successMessage="Printer updated"
                className="flex items-center hover:bg-gray-50/50 transition-colors"
              >
                <input type="hidden" name="id" value={p.id} />
                {/* Name */}
                <div className="w-48 p-2">
                  <input
                    type="text"
                    name="name"
                    defaultValue={p.name}
                    required
                    className="w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#1A2766] outline-none"
                  />
                </div>
                {/* IP */}
                <div className="w-36 p-2">
                  <input
                    type="text"
                    name="ipAddress"
                    defaultValue={p.ipAddress}
                    required
                    pattern="^(\d{1,3}\.){3}\d{1,3}$"
                    className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-[#1A2766] outline-none"
                  />
                </div>
                {/* Port */}
                <div className="w-20 p-2">
                  <input
                    type="number"
                    name="port"
                    defaultValue={p.port}
                    min={1}
                    max={65535}
                    className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-[#1A2766] outline-none"
                  />
                </div>
                {/* Status badge (read-only, controlled via enable/disable buttons) */}
                <div className="w-24 p-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                    p.enabled
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-100 text-gray-400 border border-gray-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    {p.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {/* Description */}
                <div className="flex-1 p-2">
                  <input
                    type="text"
                    name="description"
                    defaultValue={p.description ?? ''}
                    placeholder="—"
                    className="w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-[#1A2766] outline-none"
                  />
                </div>
                {/* Actions */}
                <div className="w-56 p-2 flex justify-end items-center gap-1">
                  {/* Save edits */}
                  <FormSubmit
                    className="text-[#1A2766] hover:bg-blue-50 p-1.5 rounded transition-colors"
                    icon={<Save size={14} />}
                  />
                  {/* Enable / Disable toggle */}
                  <PrinterToggleButton
                    printerId={p.id}
                    enabled={p.enabled}
                    action={setPrinterEnabled}
                  />
                  {/* Phase 2 placeholder: Test Connection */}
                  <button
                    type="button"
                    disabled
                    title="Test Connection — available in Phase 2"
                    className="p-1.5 rounded text-gray-300 cursor-not-allowed"
                  >
                    <Wifi size={14} />
                  </button>
                  {/* Phase 2 placeholder: Test Print */}
                  <button
                    type="button"
                    disabled
                    title="Test Print — available in Phase 2"
                    className="p-1.5 rounded text-gray-300 cursor-not-allowed"
                  >
                    <PrinterCheck size={14} />
                  </button>
                </div>
              </ActionForm>
            ))}

            {printers.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                No printers configured yet. Add one above.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Phase 2 Notice ──────────────────────────────────────────────── */}
      <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
        <Printer size={12} className="text-gray-400 shrink-0" />
        <span>
          <strong>Phase 2 (planned):</strong> Live online/offline status, test connection, test print, warehouse mapping, and localhost print agent integration.
        </span>
      </div>
    </div>
  );
}
