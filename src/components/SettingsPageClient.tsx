'use client';

import SettingsShell from '@/components/SettingsShell';
import PrinterSetupClient from '@/components/PrinterSetupClient';
import ZoneMappingClient from '@/components/ZoneMappingClient';
import UnlimitedSkusClient from '@/components/UnlimitedSkusClient';
import StockAlertsClient from '@/components/StockAlertsClient';
import { Printer, MapPin, Infinity, BellDot } from 'lucide-react';

interface SettingsPageClientProps {
  permissions: {
    canManageZoneMappings: boolean;
    canManageUnlimitedSkus: boolean;
    stock_alerts_manage: boolean;
  };
}

export default function SettingsPageClient({ permissions }: SettingsPageClientProps) {
  const tabs = [
    {
      id: 'printer',
      label: 'Printer',
      icon: Printer,
      description: 'Configure network thermal printing via QZ Tray.',
      component: <PrinterSetupClient />
    }
  ];

  if (permissions.canManageZoneMappings) {
    tabs.push({
      id: 'zone-mapping',
      label: 'Zone Mapping',
      icon: MapPin,
      description: 'Map products (SKUs) to warehouse-specific picking zones.',
      component: <ZoneMappingClient />
    });
  }

  if (permissions.canManageUnlimitedSkus) {
    tabs.push({
      id: 'unlimited-skus',
      label: 'Unlimited SKUs',
      icon: Infinity,
      description: 'Manage items that bypass inventory checking and always remain in stock.',
      component: <UnlimitedSkusClient />
    });
  }

  if (permissions.stock_alerts_manage) {
    tabs.push({
      id: 'stock-alerts',
      label: 'Stock Alerts',
      icon: BellDot,
      description: 'Configure and manage minimum stock thresholds for warehouses.',
      component: <StockAlertsClient />
    });
  }

  return <SettingsShell tabs={tabs} />;
}
