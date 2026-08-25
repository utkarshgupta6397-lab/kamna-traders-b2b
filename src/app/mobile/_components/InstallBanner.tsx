'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if dismissed
    if (localStorage.getItem('pwa-banner-dismissed')) return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    if (isIOS) {
      setPlatform('ios');
      setShow(true);
    } else if (isAndroid) {
      setPlatform('android');
      // For Android, wait for beforeinstallprompt
      const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShow(true);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('pwa-banner-dismissed', 'true');
    setShow(false);
  };

  const handleInstallClick = async () => {
    if (platform === 'android' && deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-[#1A2766] text-white p-4 rounded-2xl shadow-xl z-50 flex items-start gap-3 max-w-[400px] mx-auto animate-in slide-in-from-bottom-5">
      <div className="bg-white/10 p-2 rounded-xl shrink-0 mt-1">
        <Download size={24} className="text-white" />
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-sm mb-1">Install Kamna ERP</h3>
        {platform === 'ios' ? (
          <p className="text-xs text-white/80 leading-relaxed">
            Tap <Share size={12} className="inline mx-1" /> and select <strong>Add to Home Screen</strong> for the best experience.
          </p>
        ) : (
          <p className="text-xs text-white/80 leading-relaxed mb-2">
            Add Kamna ERP to your home screen for the best experience.
          </p>
        )}
        {platform === 'android' && (
          <button 
            onClick={handleInstallClick}
            className="mt-1 bg-white text-[#1A2766] text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
          >
            Install App
          </button>
        )}
      </div>
      <button onClick={handleDismiss} className="shrink-0 p-1 text-white/60 hover:text-white">
        <X size={20} />
      </button>
    </div>
  );
}
