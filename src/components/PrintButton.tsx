'use client';

export default function PrintButton() {
  return (
    <button 
      className="bg-[#AE1B1E] text-white px-4 py-2 rounded font-medium text-sm"
      onClick={() => window.print()}
    >
      Print Slips
    </button>
  );
}
