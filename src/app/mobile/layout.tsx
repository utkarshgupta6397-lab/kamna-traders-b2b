import { Metadata, Viewport } from 'next';
import InstallBanner from './_components/InstallBanner';
import HideDevUI from './_components/HideDevUI';

export const metadata: Metadata = {
  title: 'Kamna ERP',
  description: 'Mobile companion for Kamna Traders',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kamna ERP',
  },
  icons: {
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#1A2766',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function MobileRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-[#F8F9FB] text-slate-900 font-sans selection:bg-blue-100">
      <HideDevUI />
      {children}
      <InstallBanner />
    </div>
  );
}
