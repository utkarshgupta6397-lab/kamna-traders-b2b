'use client';
import { useEffect } from 'react';

export default function HideDevUI() {
  useEffect(() => {
    document.body.classList.add('mobile-active');
    return () => {
      document.body.classList.remove('mobile-active');
    };
  }, []);

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      html, body {
        height: 100%;
        height: 100dvh;
        overflow: hidden;
        position: relative;
      }
    ` }} />
  );
}
