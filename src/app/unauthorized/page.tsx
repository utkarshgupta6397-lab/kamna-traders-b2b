import Link from 'next/link';
import Image from 'next/image';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1a40] via-[#1A2766] to-[#003347] flex items-center justify-center p-4">
      {/* Decorative circles */}
      <div className="fixed top-0 left-0 w-80 h-80 bg-[#AE1B1E]/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-[#003347]/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-red-50 p-4 rounded-full">
            <ShieldAlert className="text-[#AE1B1E]" size={48} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[#1A2766] mb-2">Access Denied</h1>
        <p className="text-gray-500 text-sm mb-8">
          You don't have the necessary permissions to view this page. If you believe this is an error, please contact your administrator.
        </p>

        <div className="space-y-3">
          <Link
            href="/staff"
            className="block w-full bg-[#1A2766] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#003347] transition-colors"
          >
            Go to Login
          </Link>
          <Link
            href="/"
            className="block w-full bg-gray-50 text-gray-700 py-2.5 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors border border-gray-200"
          >
            Back to Store
          </Link>
        </div>
      </div>
    </div>
  );
}
