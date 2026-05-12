'use client';

import * as qz from 'qz-tray';
import { getQZConfig } from '@/lib/print/qz-storage';
import { KJUR, KEYUTIL, hextob64, X509 } from 'jsrsasign';

/**
 * Initializes QZ Security flow.
 * Registers the certificate and the local/remote signing promise.
 */
export function initializeQZSecurity() {
  if (typeof window === 'undefined') return;

  const mode = process.env.NEXT_PUBLIC_QZ_MODE || 'production';
  console.log(`[QZ_SECURITY] Registering promises in ${mode} mode`);

  // 1. Set Certificate Promise
  qz.security.setCertificatePromise(async () => {
    try {
      if (mode === 'demo') {
        const config = await getQZConfig();
        if (config?.certificate) return config.certificate;
        throw new Error('Local QZ certificate not found. Please configure printer in settings.');
      }

      const response = await fetch('/api/qz/certificate');
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to load QZ certificate: ${response.status} ${errorText}`);
      }
      return await response.text();
    } catch (err: any) {
      console.error('[QZ_SECURITY] Certificate promise failed:', err.message);
      throw err;
    }
  });

  // 2. Set Signature Promise
  qz.security.setSignaturePromise(async (toSign) => {
    try {
      if (mode === 'demo') {
        const config = await getQZConfig();
        if (!config?.privateKey || !config?.certificate) throw new Error('Local QZ configuration incomplete');

        // Load Private Key
        const pk = KEYUTIL.getKey(config.privateKey);
        
        // Detect Algorithm (Default to SHA1 for Demo)
        let sigAlg = "SHA1withRSA";
        try {
          const x509 = new X509();
          x509.readCertPEM(config.certificate);
          const certAlg = x509.getSignatureAlgorithmField();
          if (certAlg.toLowerCase().includes('sha256')) {
            // sigAlg = "SHA256withRSA";
          }
        } catch (e) {}

        const sig = new KJUR.crypto.Signature({ alg: sigAlg });
        sig.init(pk);
        sig.updateString(toSign);
        const sigHex = sig.sign();
        const sigB64 = hextob64(sigHex);
        
        console.log(`[QZ_SECURITY] Local signed with ${sigAlg}`);
        return sigB64;
      }

      // Production (Server-side) Signing
      const response = await fetch('/api/qz/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: toSign })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
        throw new Error(`Signing API failed: ${response.status} ${errorData.error || ''}`);
      }
      
      const data = await response.json();
      return data.signature;
    } catch (err: any) {
      console.error('[QZ_SECURITY] Signature promise failed:', err.message);
      throw err;
    }
  });

  console.log('[QZ_SECURITY] Security promises registered');
}
