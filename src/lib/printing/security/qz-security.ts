'use client';

import * as qz from 'qz-tray';

/**
 * Initializes QZ Security flow.
 * Registers the certificate and the remote signing promise.
 */
export async function initializeQZSecurity() {
  if (typeof window === 'undefined') return;

  // 1. Set Certificate Promise
  qz.security.setCertificatePromise(async () => {
    const response = await fetch('/api/qz/certificate');
    if (!response.ok) throw new Error('Failed to load QZ certificate');
    return await response.text();
  });

  // 2. Set Signature Promise (Calls our API)
  qz.security.setSignaturePromise(async (toSign) => {
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
