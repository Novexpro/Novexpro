'use client';

import React, { useState } from 'react';

export default function TrendsChart() {
  const [activeTab, setActiveTab] = useState<'lme' | 'mcx' | 'lmeVsMcx'>('lme');
  
  // Import the components using React.lazy for better performance
  const LMETrends = React.lazy(() => import('./LMETrends'));
  const MCXPriceButtons = React.lazy(() => import('./MCXPriceButtons'));
  // Import directly from the lmevsmcx directory
  const LMEvsMCX = React.lazy(() => import('./lmevsmcx/lmevsmcx'));

  return (
    <div className="w-full space-y-8">
      {/* Tab selector */}
      <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-lg">
        <button
          onClick={() => setActiveTab('lme')}
          className={`px-4 py-2 text-sm rounded-md transition-all ${
            activeTab === 'lme'
              ? 'bg-white shadow-sm text-emerald-600 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          LME
        </button>
        <button
          onClick={() => setActiveTab('mcx')}
          className={`px-4 py-2 text-sm rounded-md transition-all ${
            activeTab === 'mcx'
              ? 'bg-white shadow-sm text-blue-600 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          MCX
        </button>
        <button
          onClick={() => setActiveTab('lmeVsMcx')}
          className={`px-4 py-2 text-sm rounded-md transition-all ${
            activeTab === 'lmeVsMcx'
              ? 'bg-white shadow-sm text-purple-600 font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          LME vs MCX
        </button>
      </div>

      {/* Chart container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <React.Suspense fallback={<div className="flex items-center justify-center h-80"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div></div>}>
          {activeTab === 'lme' ? (
            <LMETrends />
          ) : activeTab === 'mcx' ? (
            <MCXPriceButtons />
          ) : (
            <LMEvsMCX />
          )}
        </React.Suspense>
      </div>
    </div>
  );
}
