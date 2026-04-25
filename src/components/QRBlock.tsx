'use client';
import { QRCodeSVG } from 'qrcode.react';

export default function QRBlock({ value }: { value: string }) {
  return (
    <div className="flex flex-col items-center pt-2">
      <QRCodeSVG value={value} size={120} level="L" />
      <p className="text-[10px] mt-2 text-center text-gray-500">Scan to verify contents</p>
    </div>
  );
}
