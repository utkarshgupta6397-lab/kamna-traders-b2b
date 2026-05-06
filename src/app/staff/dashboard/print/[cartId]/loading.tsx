import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-[#1A2766] flex items-center justify-center shadow-lg">
            <Loader2 size={28} className="text-white animate-spin" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-[16px] font-[800] text-[#1A2766]">Preparing dispatch slip...</p>
          <p className="text-[13px] font-[600] text-gray-400">Fetching order and zone details</p>
        </div>
      </div>
    </div>
  );
}
