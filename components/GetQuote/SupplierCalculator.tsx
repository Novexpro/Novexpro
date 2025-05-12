"use client";

import { Construction, Calculator } from 'lucide-react';

export default function SupplierCalculator() {
  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl shadow-sm p-6 border border-orange-100 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-orange-100 rounded-lg">
          <Calculator className="w-6 h-6 text-orange-600" />
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
          Supplier Calculator
        </h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center bg-white/50 rounded-xl p-8 border border-orange-100 shadow-inner">
        <div className="p-3 rounded-full bg-orange-100 mb-5 animate-pulse">
          <Construction className="w-10 h-10 text-orange-600" />
        </div>
        <h3 className="text-2xl font-bold text-orange-800 mb-3">Coming Soon</h3>
        <p className="text-gray-600 max-w-xs">
          We&apos;re currently developing this feature to help you calculate supplier prices more efficiently.
        </p>
        <div className="mt-5 w-full max-w-[200px] h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full w-2/3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"></div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Development in progress</p>
      </div>
    </div>
  );
} 