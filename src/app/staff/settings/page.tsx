'use client';

import SettingsShell from '@/components/SettingsShell';
import PrinterSettingsTab from '@/components/PrinterSettingsTab';
import ZoneMappingClient from '@/components/ZoneMappingClient';
import { Printer, MapPin } from 'lucide-react';

export default function SettingsPage() {
  const tabs = [
    {
      id: 'printer',
      label: 'Printer',
      icon: Printer,
      description: 'Configure machine-local thermal printing and QZ Tray handshake.',
      component: <PrinterSettingsTab />
    },
    {
      id: 'zone-mapping',
      label: 'Zone Mapping',
      icon: MapPin,
      description: 'Map products (SKUs) to warehouse-specific picking zones.',
      component: <ZoneMappingClient />
    }
  ];

  return <SettingsShell tabs={tabs} />;
}
