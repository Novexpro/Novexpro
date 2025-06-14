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
  message?: string;
  updated?: boolean;
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
  const [calculationBasePrice, setCalculationBasePrice] = useState<number>(0);
  const [selectedCompany, setSelectedCompany] = useState<'NALCO' | 'Hindalco' | 'Vedanta' | null>(null);
  
  const basePriceFieldRef = useRef<HTMLInputElement>(null);
  
  // Function to fetch the latest quotes
  const fetchLatestQuotes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching latest quotes...');
      const response = await fetch('/api/supplier-quotes?action=quotes');
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
  const handleCompanyClick = async (company: 'NALCO' | 'Hindalco' | 'Vedanta') => {
    try {
      // Set the selected company immediately
      setSelectedCompany(company);
      setLoading(true);
      setError(null);
      
      console.log(`Fetching latest data for ${company}...`);
      
      // Check if we already have data for this company in our quotes state
      if (quotes[company] && quotes[company]?.priceChange) {
        const quoteData = quotes[company]!;
        
        // Set the display price (original value)
        setBasePrice(quoteData.priceChange.toString());
        
        // Set the calculation price (divided by 1000)
        setCalculationBasePrice(quoteData.priceChange / 1000);
        
        console.log(`Using cached data for ${company}: ${quoteData.priceChange}`);
        setLoading(false);
        return;
      }
      
      // If no cached data, fetch from API
      const response = await fetch(`/api/supplier-quotes?action=company&company=${company}&update=false`);
      const data: QuotesResponse = await response.json();
      
      console.log(`API response for ${company}:`, data);
      
      if (!data.success || !data.data || !data.data[company]) {
        throw new Error(data.error || `Failed to fetch data for ${company}`);
      }
      
      // Get the company data
      const quoteData = data.data[company];
      
      // Update the quotes state with this new data
      setQuotes(prevQuotes => ({
        ...prevQuotes,
        [company]: quoteData
      }));
      
      // Set the display price (original value)
      setBasePrice(quoteData.priceChange.toString());
      
      // Set the calculation price (divided by 1000)
      setCalculationBasePrice(quoteData.priceChange / 1000);
      
      console.log(`Retrieved data for ${company}: ${quoteData.priceChange}`);
    } catch (err) {
      console.error(`Error fetching data for ${company}:`, err);
      setError(err instanceof Error ? err.message : `Failed to fetch data for ${company}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Function to update data from external API if needed
  const updateFromExternalAPI = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Updating all companies from external API...');
      
      // Trigger an update from the external API
      const response = await fetch('/api/supplier-quotes?action=update');
      const data: QuotesResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update from external API');
      }
      
      // After updating, refresh the quotes
      await fetchLatestQuotes();
      
      console.log('Successfully updated from external API');
    } catch (err) {
      console.error('Error updating from external API:', err);
      setError(err instanceof Error ? err.message : 'Failed to update from external API');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to get the product description based on selected company
  const getProductDescription = () => {
    if (!selectedCompany) return "Base price for calculation";
    
    switch (selectedCompany) {
      case 'NALCO':
        return "ALUMINIUM INGOT IE07";
      case 'Hindalco':
        return "P0610 (99.85% min) /P1020/ EC Grade Ingot & Sow 99.7% (min) / Cast Bar";
      case 'Vedanta':
        return "P1020 / EC High purity above 99.7%";
      default:
        return "Base price for calculation";
    }
  };

  // Calculate the total price
  const calculateTotal = () => {
    // Use the calculation base price (divided by 1000) instead of the display value
    const basePriceNum = calculationBasePrice || 0;
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

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
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
      </div>

      <div className="space-y-6 relative z-10 flex-grow flex flex-col">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-orange-100 shadow-sm min-h-[200px] flex flex-col">
          <div className="flex items-center justify-between mb-2 h-6">
            <label className="text-sm font-medium text-gray-700">
              Base Price (₹/ton)
            </label>
            <button
              onClick={updateFromExternalAPI}
              disabled={loading}
              className="px-2 py-1 text-xs font-medium bg-white border border-orange-200 text-orange-700 hover:bg-orange-50 rounded-lg shadow-sm transition-all flex items-center gap-1"
            >
              {loading ? 'Updating...' : 'Refresh'}
            </button>
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
                onChange={(e) => {
                  const value = e.target.value;
                  setBasePrice(value);
                  // When manually entering a value, also update the calculation value (divided by 1000)
                  setCalculationBasePrice(parseFloat(value) / 1000 || 0);
                }}
                placeholder="Enter base price"
                className="w-full pl-10 py-3 h-12 border-2 border-gray-200 active:border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-700 text-base bg-white placeholder:text-gray-400 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-2 h-10 mt-2">
            <button
              onClick={() => {
                console.log('Clicking NALCO button');
                console.log('Current quotes state:', quotes);
                handleCompanyClick('NALCO');
              }}
              className={`flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all shadow-sm ${
                selectedCompany === 'NALCO'
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white border border-orange-300' 
                  : 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-50'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>NALCO</span>
            </button>
            <button
              onClick={() => handleCompanyClick('Hindalco')}
              className={`flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all shadow-sm ${
                selectedCompany === 'Hindalco'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white border border-amber-300' 
                  : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Hindalco</span>
            </button>
            <button
              onClick={() => handleCompanyClick('Vedanta')}
              className={`flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all shadow-sm ${
                selectedCompany === 'Vedanta'
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border border-yellow-300' 
                  : 'bg-white border border-yellow-200 text-yellow-700 hover:bg-yellow-50'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>Vedanta</span>
            </button>
          </div>
          

          
          {error && (
            <div className="mt-2 text-red-500 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {error}
            </div>
          )}
          
          <div className="h-4 overflow-hidden text-xs">
            <p className="text-orange-500 flex items-start gap-1 truncate">
              <span className="inline-block w-1 h-1 rounded-full bg-orange-500 flex-shrink-0 mt-1"></span>
              <span className="truncate" title={getProductDescription()}>{getProductDescription()}</span>
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