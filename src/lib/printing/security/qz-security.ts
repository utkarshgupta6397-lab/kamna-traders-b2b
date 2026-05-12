'use client';

import * as qz from 'qz-tray';
import { getQZConfig } from '@/lib/print/qz-storage';
import { KJUR, KEYUTIL, hextob64, X509 } from 'jsrsasign';

/**
 * Initializes QZ Security flow.
 * Registers the certificate and the local signing promise.
 */
export function initializeQZSecurity() {
  if (typeof window === 'undefined') return;

  console.log('[QZ_SECURITY] Initializing 100% Browser-Local Security Handshake');

  // 1. Set Certificate Promise (Always load from Local Config first, fallback to public cert)
  qz.security.setCertificatePromise(async () => {
    try {
      const config = await getQZConfig();
      
      // If user has a specific machine cert, use it
      if (config?.certificate) {
        console.debug('[QZ_SECURITY] Using machine-local certificate from storage');
        return config.certificate;
      }

      // Fallback to the default system certificate (for common public root trust)
      console.debug('[QZ_SECURITY] Falling back to default system certificate API');
      const response = await fetch('/api/qz/certificate');
      if (!response.ok) throw new Error(`Cert API failed: ${response.status}`);
      return await response.text();
    } catch (err: any) {
      console.error('[QZ_SECURITY] Certificate promise failed:', err.message);
      throw err;
    }
  });

  // 2. Set Signature Promise (100% BROWSER-LOCAL)
  qz.security.setSignaturePromise(async (toSign) => {
    try {
      // FORCE LOCAL ONLY - No network requests allowed here
      const config = await getQZConfig();
      if (!config?.privateKey || !config?.certificate) {
        throw new Error('Local QZ credentials missing. Please upload your Certificate and Private Key in Settings.');
      }

      /**
       * BROWSER-LOCAL CRYPTOGRAPHY
       * We use jsrsasign to match QZ Tray's internal Java-based RSA verification.
       * This preserves the private key entirely within the browser's memory/storage.
       */
      
      // 1. Load Private Key from IndexedDB
      const pk = KEYUTIL.getKey(config.privateKey);
      
      // 2. Detect Algorithm from Certificate (Default to SHA1 for Demo/Compatibility)
      let sigAlg = "SHA1withRSA";
      try {
        const x509 = new X509();
        x509.readCertPEM(config.certificate);
        const certAlg = x509.getSignatureAlgorithmField();
        if (certAlg.toLowerCase().includes('sha256')) {
          // sigAlg = "SHA256withRSA";
        }
      } catch (e) {}

      // 3. Generate Signature locally
      const sig = new KJUR.crypto.Signature({ alg: sigAlg });
      sig.init(pk);
      sig.updateString(toSign);
      const sigHex = sig.sign();
      
      // 4. Base64 Encode
      const sigB64 = hextob64(sigHex);

      console.log(`[QZ_SECURITY] Message signed locally (${sigAlg}) - No server interaction`);
      return sigB64;
    } catch (err: any) {
      console.error('[QZ_SECURITY] Browser-local signing failed:', err.message);
      throw err;
    }
  });

  console.log('[QZ_SECURITY] 100% Local Security promises registered');
}
