'use client';
import { useEffect } from 'react';

export default function HideDevUI() {
  useEffect(() => {
    document.body.classList.add('mobile-active');
    return () => {
      document.body.classList.remove('mobile-active');
    };
  }, []);

  return null;
}
