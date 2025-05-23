"use client";

import { useState, useRef, useEffect } from 'react';
import { Calculator, ArrowRight, Sparkles, Calendar, AlertTriangle } from 'lucide-react';

interface QuoteData {
  stockName: string;
  priceChange: number;
  timestamp: string;
}

interface QuotesResponse {
  success: boolean;
  data?: {
    [key: string]: QuoteData | null;
  };
  error?: string;
}

export default function SupplierCalculator() {
  const [basePrice, setBasePrice] = useState('');
  const [premium, setPremium] = useState('');
  const [freight1, setFreight1] = useState('');
  const [freight2, setFreight2] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<{[key: string]: QuoteData | null}>({});
  
  const basePriceFieldRef = useRef<HTMLInputElement>(null);
  
  // Function to fetch the latest quotes
  const fetchLatestQuotes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching latest quotes...');
      const response = await fetch('/api/get-latest-quotes');
      const data: QuotesResponse = await response.json();
      
      console.log('API response:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch quotes');
      }
      
      console.log('Setting quotes with data:', data.data);
      setQuotes(data.data || {});
    } catch (err) {
      console.error('Error fetching quotes:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // Load quotes when component mounts
  useEffect(() => {
    fetchLatestQuotes();
  }, []);
  
  // Function to handle company button clicks
  const handleCompanyClick = (company: 'NALCO' | 'Hindalco' | 'Vedanta') => {
    const quoteData = quotes[company];
    
    if (quoteData) {
      setBasePrice(quoteData.priceChange.toString());
      
      // Focus on the next field (premium) after setting the base price
      if (basePriceFieldRef.current) {
        basePriceFieldRef.current.focus();
      }
    } else {
      console.error(`No data available for ${company}. Available quotes:`, quotes);
      setError(`No data available for ${company}`);
    }
  };

  // Calculate the total price
  const calculateTotal = () => {
    const basePriceNum = parseFloat(basePrice) || 0;
    const premiumNum = parseFloat(premium) || 0;
    const freight1Num = parseFloat(freight1) || 0;
    const freight2Num = parseFloat(freight2) || 0;
    
    // Calculate total (without GST)
    const total = basePriceNum + premiumNum + freight1Num + freight2Num;
    
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
          
          <div className="w-full flex space-x-2 mt-2">
            <button
              onClick={() => {
                console.log('Clicking Nalco button');
                console.log('Current quotes state:', quotes);
                handleCompanyClick('NALCO');
              }}
              className="flex-1 py-2 px-4 rounded-full border border-orange-300 text-orange-500 hover:bg-orange-50 transition-colors"
            >
              Nalco
            </button>
            <button
              onClick={() => handleCompanyClick('Hindalco')}
              className="flex-1 py-2 px-4 rounded-full border border-orange-300 text-orange-500 hover:bg-orange-50 transition-colors"
            >
              Hindalco
            </button>
            <button
              onClick={() => handleCompanyClick('Vedanta')}
              className="flex-1 py-2 px-4 rounded-full border border-orange-300 text-orange-500 hover:bg-orange-50 transition-colors"
            >
              Vedanta
            </button>
          </div>
          
          {loading && (
            <div className="mt-2 text-gray-500 text-sm flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500 mr-2"></div>
              Loading latest prices...
            </div>
          )}
          
          {error && (
            <div className="mt-2 text-red-500 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {error}
            </div>
          )}
          
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