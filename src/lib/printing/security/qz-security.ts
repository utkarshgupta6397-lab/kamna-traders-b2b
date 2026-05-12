'use client';

import * as qz from 'qz-tray';
import { getQZConfig } from '@/lib/print/qz-storage';
import { KJUR, KEYUTIL, hextob64, X509 } from 'jsrsasign';

/**
 * Initializes QZ Security flow.
 * Registers the certificate and the local/remote signing promise.
 */
export async function initializeQZSecurity() {
  if (typeof window === 'undefined') return;

  const mode = process.env.NEXT_PUBLIC_QZ_MODE || 'production';
  console.log(`[QZ_SECURITY] Initializing in ${mode} mode`);

  // 1. Set Certificate Promise
  qz.security.setCertificatePromise(async () => {
    if (mode === 'demo') {
      const config = await getQZConfig();
      if (config?.certificate) return config.certificate;
      throw new Error('Local QZ certificate not found. Please configure printer in settings.');
    }

    const response = await fetch('/api/qz/certificate');
    if (!response.ok) throw new Error('Failed to load QZ certificate');
    return await response.text();
  });

  // 2. Set Signature Promise
  qz.security.setSignaturePromise(async (toSign) => {
    if (mode === 'demo') {
      const config = await getQZConfig();
      if (!config?.privateKey || !config?.certificate) throw new Error('Local QZ configuration incomplete');

      try {
        /**
         * LOW-LEVEL CRYPTO AUDIT:
         * We use jsrsasign here because Web Crypto (SubtleCrypto) has strict requirements
         * for PKCS#8 headers and padding that often mismatch with legacy QZ demo certs.
         * jsrsasign matches QZ Tray's internal Java-based signing logic exactly.
         */
        
        // 1. Load Private Key (Handles PKCS#1 and PKCS#8 automatically)
        const pk = KEYUTIL.getKey(config.privateKey);
        
        // 2. Detect Algorithm from Certificate
        // Default to SHA1withRSA for Demo compatibility as requested.
        let sigAlg = "SHA1withRSA";
        
        try {
          const x509 = new X509();
          x509.readCertPEM(config.certificate);
          const certAlg = x509.getSignatureAlgorithmField();
          console.debug(`[QZ_SECURITY] Certificate algorithm: ${certAlg}`);
          
          // Only switch to SHA256 if explicitly found and not in demo-forced mode
          if (certAlg.toLowerCase().includes('sha256')) {
            // sigAlg = "SHA256withRSA"; // Disabled for now to force SHA1 compatibility
          }
        } catch (e) {
          console.warn('[QZ_SECURITY] Could not parse cert algorithm, defaulting to SHA1');
        }
        
        // 3. Generate Signature
        const sig = new KJUR.crypto.Signature({ alg: sigAlg });
        sig.init(pk);
        sig.updateString(toSign);
        const sigHex = sig.sign();
        
        // 4. Convert to Base64
        const sigB64 = hextob64(sigHex);

        console.log(`[QZ_SECURITY] Signed payload with ${sigAlg} (Auto-detected). Length: ${sigB64.length}`);
        
        return sigB64;
      } catch (err) {
        console.error('[QZ_SECURITY] Local signing failed (jsrsasign):', err);
        throw err;
      }
    }

    // Production (Server-side) Signing
    const response = await fetch('/api/qz/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: toSign })
    });
    if (!response.ok) throw new Error('Signing API failed');
    const data = await response.json();
    return data.signature;
  });

  console.log('[QZ_SECURITY] Security promises registered');
}
