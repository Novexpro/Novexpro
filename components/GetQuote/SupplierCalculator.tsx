"use client";

import { useState, useRef } from 'react';
import { Calculator, ArrowRight, Sparkles, Calendar } from 'lucide-react';

export default function SupplierCalculator() {
  const [basePrice, setBasePrice] = useState('');
  const [premium, setPremium] = useState('');
  const [freight1, setFreight1] = useState('');
  const [freight2, setFreight2] = useState('');
  const [gst, setGst] = useState('18'); // Default GST rate in India
  
  const basePriceFieldRef = useRef<HTMLInputElement>(null);

  // Calculate the total price
  const calculateTotal = () => {
    const basePriceNum = parseFloat(basePrice) || 0;
    const premiumNum = parseFloat(premium) || 0;
    const freight1Num = parseFloat(freight1) || 0;
    const freight2Num = parseFloat(freight2) || 0;
    const gstNum = parseFloat(gst) || 0;
    
    // Calculate subtotal
    const subtotal = basePriceNum + premiumNum + freight1Num + freight2Num;
    
    // Apply GST
    const total = subtotal * (1 + (gstNum / 100));
    
    return total;
  };

  // Handle premium key press
  const handlePremiumKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (basePriceFieldRef.current) {
        basePriceFieldRef.current.focus();
      }
    }
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl shadow-lg p-6 border border-orange-100 h-full relative overflow-hidden group flex flex-col">
      {/* Background graphics */}
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-orange-600/5 rounded-full -mr-20 -mb-20 z-0"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-amber-600/5 rounded-full -ml-10 -mt-10 z-0"></div>
      
      {/* Add animation styles */}
      <style jsx global>{`
        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
        
        .animate-pulse-subtle {
          animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2.5 bg-gradient-to-br from-orange-600 to-amber-600 rounded-xl shadow-md">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            Supplier Calculator
          </h2>
          <p className="text-xs text-orange-700/70">Supplier Price Estimation</p>
        </div>
      </div>

      <div className="space-y-6 relative z-10 flex-grow flex flex-col">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-orange-100 shadow-sm min-h-[200px] flex flex-col">
          <div className="flex items-center justify-between mb-2 h-6">
            <label className="text-sm font-medium text-gray-700">
              Base Price (₹/kg)
            </label>
          </div>
          
          <div className="h-14 mb-3">
            <div className="relative flex-grow flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center h-full">
                <span className="text-gray-500 text-base font-medium flex items-center h-full">₹</span>
              </div>
              <input
                ref={basePriceFieldRef}
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="Enter base price"
                className="w-full pl-10 py-3 h-12 border-2 border-gray-200 active:border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700 text-base bg-white placeholder:text-gray-400 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
          
          <div className="h-10 mb-2">
            <div className="flex items-center justify-between gap-2 h-full">
              <button
                className="flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all shadow-sm bg-white border border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                <span>Nalco</span>
              </button>
              <button
                className="flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all shadow-sm bg-white border border-amber-200 text-amber-700 hover:bg-amber-50"
              >
                <span>Hindalco</span>
              </button>
              <button
                className="flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all shadow-sm bg-white border border-yellow-200 text-yellow-700 hover:bg-yellow-50"
              >
                <span>Vedanta</span>
              </button>
            </div>
          </div>
          
          <div className="h-4 flex items-center text-xs">
            <p className="text-orange-500 flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-orange-500"></span>
              Base price for calculation
            </p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-orange-100 shadow-sm h-[132px] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Premium (₹/kg)
            </label>
            <div className="text-xs font-medium bg-white border border-orange-200 text-orange-700 px-2.5 py-1 rounded-full shadow-sm">
              GST Rate: <span className="font-semibold">{gst}%</span>
            </div>
          </div>
          <div className="flex gap-2 h-14">
            <div className="relative flex-grow flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center h-full">
                <span className="text-gray-500 text-base font-medium flex items-center h-full">₹</span>
              </div>
              <input
                type="number"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                onKeyDown={handlePremiumKeyPress}
                className="w-full pl-10 py-3 h-12 border-2 border-gray-200 active:border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700 text-base bg-white placeholder:text-gray-400 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="Enter premium"
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex rounded-full overflow-hidden border-2 border-gray-200 active:border-gray-300 shadow-sm min-w-[90px]">
              <button
                type="button"
                onClick={() => setGst('18')}
                className={`flex-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${gst === '18' ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                18%
              </button>
              <button
                type="button"
                onClick={() => setGst('12')}
                className={`flex-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${gst === '12' ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                12%
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-orange-100 shadow-sm min-h-[100px] flex flex-col">
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Upcharge (₹/kg)</label>
            <label className="text-sm font-medium text-gray-700">Freight (₹/kg)</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative flex-grow flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none h-full">
                <span className="text-gray-500 text-base font-medium">₹</span>
              </div>
              <input
                type="number"
                value={freight2}
                onChange={(e) => setFreight2(e.target.value)}
                className="w-full pl-10 py-3 h-12 border-2 border-gray-200 active:border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700 text-base bg-white placeholder:text-gray-400 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="Enter INR"
              />
            </div>
            <div className="relative flex-grow flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none h-full">
                <span className="text-gray-500 text-base font-medium">₹</span>
              </div>
              <input
                type="number"
                value={freight1}
                onChange={(e) => setFreight1(e.target.value)}
                className="w-full pl-10 py-3 h-12 border-2 border-gray-200 active:border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700 text-base bg-white placeholder:text-gray-400 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="Enter INR"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-orange-200/50 min-h-[120px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              Total Price (per kg)
            </label>
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-orange-500" />
              <Sparkles className="w-4 h-4 text-orange-500" />
            </div>
          </div>
          
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-white font-medium">₹</span>
            </div>
            <input
              type="text"
              value={calculateTotal().toFixed(2)}
              disabled
              className="w-full pl-9 pr-4 py-4 bg-gradient-to-r from-orange-600 to-amber-600 border-0 rounded-lg font-bold text-white text-xl shadow-md transition-all duration-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}