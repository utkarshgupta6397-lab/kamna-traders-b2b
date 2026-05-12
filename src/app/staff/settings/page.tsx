'use client';

import SettingsShell from '@/components/SettingsShell';
import PrinterSettingsTab from '@/components/PrinterSettingsTab';
import { Printer } from 'lucide-react';

export default function SettingsPage() {
  const tabs = [
    {
      id: 'printer',
      label: 'Printer',
      icon: Printer,
      description: 'Configure machine-local thermal printing and QZ Tray handshake.',
      component: <PrinterSettingsTab />
    }
  ];

  return <SettingsShell tabs={tabs} />;
}
