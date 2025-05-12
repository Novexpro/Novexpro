"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Calculator, Wifi, WifiOff, Loader2, ArrowRight, Sparkles, Calendar } from 'lucide-react';
import { useMCXPrice } from '../../hook/useMCXPrice';
import { useLMEPrice } from '../../hook/useLMEPrice';
import { useExchangeRates } from '../../hook/useExchangeRates';
import { useMetalPrice } from '../../context/MetalPriceContext';

interface PriceCalculatorProps {
  className?: string;
}

// Interface for the monthly cash settlement response
interface MonthlyCashSettlementResponse {
  type: 'averagePrice' | 'noData' | 'error';
  averagePrice?: number;
  monthName?: string;
  dataPointsCount?: number;
  month?: number;
  year?: number;
  message?: string;
}

type ExchangeRateType = 'RBI' | 'SBI';

export default function PriceCalculator({ className }: PriceCalculatorProps) {
  const [mcxPrice, setMcxPrice] = useState('');
  const [mcxPremium, setMcxPremium] = useState('');
  const [mcxFreight, setMcxFreight] = useState('');
  
  const [lmePrice, setLmePrice] = useState('');
  const [lmePremium, setLmePremium] = useState('');
  const [lmeFreight, setLmeFreight] = useState('');
  
  const [isMcxLiveMode, setIsMcxLiveMode] = useState(false);
  const [isLmeLiveMode, setIsLmeLiveMode] = useState(false);
  // Track last update times for status indicators
  const [mcxLastUpdate, setMcxLastUpdate] = useState<Date | null>(null);
  const [lmeLastUpdate, setLmeLastUpdate] = useState<Date | null>(null);
  const [mcxConnectionError, setMcxConnectionError] = useState<string | null>(null);
  const [lmeConnectionError, setLmeConnectionError] = useState<string | null>(null);
  const [isMcxPriceUpdating, setIsMcxPriceUpdating] = useState(false);
  const [isLmePriceUpdating, setIsLmePriceUpdating] = useState(false);
  const [exchangeRateType, setExchangeRateType] = useState<ExchangeRateType>('RBI');
  const [isLoadingMonthlyCashSettlement, setIsLoadingMonthlyCashSettlement] = useState(false);
  const [monthlyCashSettlementData, setMonthlyCashSettlementData] = useState<MonthlyCashSettlementResponse | null>(null);
  const [liveDataIntervalId, setLiveDataIntervalId] = useState<NodeJS.Timeout | null>(null);
  
  const freightInputRef = useRef<HTMLInputElement>(null);
  const mcxPriceFieldRef = useRef<HTMLInputElement>(null);
  const lmePriceFieldRef = useRef<HTMLInputElement>(null);
  
  const { priceData: mcxPriceData, loading: mcxLoading, error: mcxError } = useMCXPrice();
  const { priceData: lmePriceData, loading: lmeLoading, error: lmeError } = useLMEPrice();
  const { ratesData, loading: ratesLoading, error: ratesError } = useExchangeRates();
  const { sharedSpotPrice, registerRefreshListener, triggerRefresh } = useMetalPrice();

  const DUTY_FACTOR = 1.0825;
  const RBI_RATE = ratesData?.RBI || 0;
  const SBI_TT_RATE = ratesData?.SBI || 0;

  // Add state for MCX month data
  const [mcxMonthsData, setMcxMonthsData] = useState<{
    month1Label: string;
    month1Price: number;
    month2Label: string;
    month2Price: number;
    month3Label: string;
    month3Price: number;
  } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [loadingMonths, setLoadingMonths] = useState(false);

  // Add useEffect to listen for spot price changes from context
  useEffect(() => {
    if (sharedSpotPrice && sharedSpotPrice.spotPrice > 0 && isLmeLiveMode) {
      // Update the LME price with the shared spot price
      setLmePrice(sharedSpotPrice.spotPrice.toFixed(2));
      setLmeLastUpdate(new Date(sharedSpotPrice.lastUpdated || new Date()));
      
      // Clear any monthly data display indicators
      setMonthlyCashSettlementData(null);
      
      // Provide visual feedback
      if (lmePriceFieldRef.current) {
        lmePriceFieldRef.current.classList.add('bg-green-50');
        setTimeout(() => {
          lmePriceFieldRef.current?.classList.remove('bg-green-50');
        }, 1000);
      }
      
      setIsLmePriceUpdating(false);
    }
  }, [sharedSpotPrice, isLmeLiveMode]);

  // Add event listeners for global spot price events
  useEffect(() => {
    // Create interface for the custom event
    interface SpotPriceData {
      spotPrice: number;
      change: number;
      changePercent: number;
      lastUpdated: string;
    }
    
    interface SpotPriceSyncEvent extends CustomEvent {
      detail: {
        spotPriceData: SpotPriceData;
      };
    }
    
    const handleSpotPriceSync = (event: SpotPriceSyncEvent) => {
      if (isLmeLiveMode && event.detail && event.detail.spotPriceData) {
        const { spotPrice, lastUpdated } = event.detail.spotPriceData;
        
        // Update LME price with the new spot price
        setLmePrice(spotPrice.toFixed(2));
        setLmeLastUpdate(new Date(lastUpdated || new Date()));
        
        // Provide visual feedback for auto-update
        setIsLmePriceUpdating(true);
        setTimeout(() => {
          setIsLmePriceUpdating(false);
        }, 1000);
        
        if (lmePriceFieldRef.current) {
          lmePriceFieldRef.current.classList.add('bg-green-50');
          setTimeout(() => {
            lmePriceFieldRef.current?.classList.remove('bg-green-50');
          }, 1000);
        }
      }
    };
    
    // Listen for pre-refresh events
    const handlePreRefresh = () => {
      if (isLmeLiveMode) {
        setIsLmePriceUpdating(true);
        // Auto-dismiss after 2 seconds if no update occurs
        setTimeout(() => setIsLmePriceUpdating(false), 2000);
      }
    };
    
    // Add event listeners
    window.addEventListener('spot-price-sync', handleSpotPriceSync as EventListener);
    window.addEventListener('pre-spot-refresh', handlePreRefresh);
    
    // Clean up
    return () => {
      window.removeEventListener('spot-price-sync', handleSpotPriceSync as EventListener);
      window.removeEventListener('pre-spot-refresh', handlePreRefresh);
    };
  }, [isLmeLiveMode]);

  // Register for refresh notifications
  useEffect(() => {
    const unregister = registerRefreshListener(() => {
      if (isLmeLiveMode) {
        console.log("PriceCalculator received refresh signal");
        setIsLmePriceUpdating(true);
        
        // Auto-reset refreshing state after 2 seconds if no data arrives
        const timer = setTimeout(() => {
          setIsLmePriceUpdating(false);
        }, 2000);
        
        return () => clearTimeout(timer);
      }
    });
    
    // Cleanup function
    return () => {
      unregister();
    };
  }, [registerRefreshListener, isLmeLiveMode]);

  // Add a new function to fetch live spot price data
  const fetchLiveSpotPrice = async () => {
    try {
      setIsLmePriceUpdating(true);
      
      // Request data from LMEAluminium component
      window.dispatchEvent(new CustomEvent('spot-price-request-data', {
        detail: { source: 'PriceCalculator' }
      }));
      
      // As a fallback, fetch directly from API if no response in 1 second
      const fallbackTimer = setTimeout(async () => {
        try {
          // Use the same API endpoint as LiveSpotCard component
          const response = await fetch('/api/metal-price?forceMetalPrice=true', {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
            }
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch live spot price: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.type === 'noData') {
            throw new Error(data.message || 'No price data available');
          }
          
          // Use spotPrice from the response
          if (data.spotPrice !== undefined) {
            setLmePrice(data.spotPrice.toFixed(2));
            setLmeLastUpdate(new Date(data.lastUpdated || new Date()));
            
            // Clear any monthly data display indicators
            setMonthlyCashSettlementData(null);
            
            // Provide visual feedback
            if (lmePriceFieldRef.current) {
              lmePriceFieldRef.current.classList.add('bg-green-50');
              setTimeout(() => {
                lmePriceFieldRef.current?.classList.remove('bg-green-50');
              }, 1000);
            }
          } else {
            throw new Error('Live spot price data is missing');
          }
        } catch (error) {
          console.error('Error in fallback fetch live spot price:', error);
          setLmeConnectionError(error instanceof Error ? error.message : 'Failed to fetch live spot price data');
          // If error occurs, switch back to manual mode
          setIsLmeLiveMode(false);
        } finally {
          setIsLmePriceUpdating(false);
        }
      }, 1000);
      
      // Check if shared context already has data
      if (sharedSpotPrice && sharedSpotPrice.spotPrice > 0) {
        clearTimeout(fallbackTimer);
        setLmePrice(sharedSpotPrice.spotPrice.toFixed(2));
        setLmeLastUpdate(new Date(sharedSpotPrice.lastUpdated || new Date()));
        setIsLmePriceUpdating(false);
      }
      
      return () => clearTimeout(fallbackTimer);
    } catch (error) {
      console.error('Error fetching live spot price:', error);
      setLmeConnectionError(error instanceof Error ? error.message : 'Failed to fetch live spot price data');
      // If error occurs, switch back to manual mode
      setIsLmeLiveMode(false);
      setIsLmePriceUpdating(false);
    }
  };

  // Update toggleLmeLiveMode to use fetchLiveSpotPrice
  const toggleLmeLiveMode = () => {
    if (!isLmeLiveMode && lmeLoading) return;
    
    const newLiveMode = !isLmeLiveMode;
    setIsLmeLiveMode(newLiveMode);
    
    if (newLiveMode) {
      // When live mode is activated, fetch the latest spot price data
      fetchLiveSpotPrice();
      
      // Set up regular polling for live data
      const intervalId = setInterval(() => {
        // Use triggerRefresh to synchronize with other components
        triggerRefresh();
        
        // Also fetch directly in case context is not updated
        fetchLiveSpotPrice();
      }, 60000); // Refresh every minute
      
      setLiveDataIntervalId(intervalId);
    } else {
      // Switching to manual mode
      setLmePrice(''); // Clear price when switching to manual
      setMonthlyCashSettlementData(null); // Also clear monthly data indicators
      
      // Clear the polling interval
      if (liveDataIntervalId) {
        clearInterval(liveDataIntervalId);
        setLiveDataIntervalId(null);
      }
    }
  };

  // Clean up polling interval when component unmounts
  useEffect(() => {
    return () => {
      if (liveDataIntervalId) {
        clearInterval(liveDataIntervalId);
      }
    };
  }, [liveDataIntervalId]);

  useEffect(() => {
    let updateTimeout: NodeJS.Timeout;

    if (isMcxLiveMode && mcxPriceData && mcxPriceData.currentPrice) {
      // If a specific month is selected, don't override with the live data
      if (!selectedMonth && mcxMonthsData) {
        // Auto-select the first month when activating live mode on fresh page
        setSelectedMonth(mcxMonthsData.month1Label);
        setMcxPrice(mcxMonthsData.month1Price.toFixed(2));
      } else if (!selectedMonth) {
        setMcxPrice(mcxPriceData.currentPrice.toFixed(2));
      }
      setMcxLastUpdate(new Date());
      setIsMcxPriceUpdating(true);

      if (mcxPriceFieldRef.current) {
        mcxPriceFieldRef.current.classList.add('bg-green-50');
        updateTimeout = setTimeout(() => {
          mcxPriceFieldRef.current?.classList.remove('bg-green-50');
          setIsMcxPriceUpdating(false);
        }, 1000);
      }
    }

    return () => clearTimeout(updateTimeout);
  }, [isMcxLiveMode, mcxPriceData, selectedMonth, mcxMonthsData]);

  useEffect(() => {
    if (mcxError) {
      setMcxConnectionError('Failed to fetch live MCX price data');
      setIsMcxLiveMode(false);
    } else {
      setMcxConnectionError(null);
    }
  }, [mcxError]);

  useEffect(() => {
    if (lmeError) {
      setLmeConnectionError('Failed to fetch live LME price data');
      setIsLmeLiveMode(false);
    } else {
      setLmeConnectionError(null);
    }
  }, [lmeError]);
  
  useEffect(() => {
    if (ratesError) {
      console.error('Failed to fetch exchange rates:', ratesError);
    }
  }, [ratesError]);

  // New function to fetch estimated average CSP from LiveSpotCard's API
  const fetchEstimatedCsp = async () => {
    try {
      setIsLoadingMonthlyCashSettlement(true);
      
      // Create cacheBuster to prevent caching
      const cacheBuster = new Date().getTime();
      
      // Use the same API endpoint as LiveSpotCard - with returnAverage parameter
      const response = await fetch(
        `/api/metal-price?returnAverage=true&_t=${cacheBuster}`,
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch estimated CSP data: ${response.status}`);
      } else {
        const data = await response.json();
        
        // Update LME price if data is available
        if (data.type === 'averagePrice' && data.spotPrice !== undefined) {
          setLmePrice(data.spotPrice.toFixed(2));
          setIsLmeLiveMode(false);
          
          // Set a custom response for display in the UI
          setMonthlyCashSettlementData({
            type: 'averagePrice',
            averagePrice: data.spotPrice,
            dataPointsCount: data.dataPointsCount,
            monthName: 'Estimated Average CSP',
            message: data.message || 'Using estimated average price'
          });
          
          // Provide visual feedback
          if (lmePriceFieldRef.current) {
            lmePriceFieldRef.current.classList.add('bg-green-50');
            setTimeout(() => {
              lmePriceFieldRef.current?.classList.remove('bg-green-50');
            }, 1000);
          }
        } else {
          throw new Error('No average price data available');
        }
      }
    } catch (error) {
      console.error('Error fetching estimated CSP data:', error);
      setLmeConnectionError(error instanceof Error ? error.message : 'Failed to fetch estimated CSP data');
    } finally {
      setIsLoadingMonthlyCashSettlement(false);
    }
  };

  // Update EST CSP button click handler to use the new function
  const handleEstCspClick = () => {
    fetchEstimatedCsp();
  };

  // New function to fetch current month's cash settlement data (MTD)
  const fetchCurrentMonthCashSettlement = async () => {
    try {
      setIsLoadingMonthlyCashSettlement(true);
      
      // Create cacheBuster to prevent caching
      const cacheBuster = new Date().getTime();
      
      // Use the current month and year
      const currentDate = new Date();
      const month = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
      const year = currentDate.getFullYear();
      
      // Fetch data from the API
      const response = await fetch(
        `/api/monthly-cash-settlement?month=${month}&year=${year}&_t=${cacheBuster}`,
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch current month's cash settlement: ${response.status}`);
      } else {
        const data = await response.json();
        setMonthlyCashSettlementData(data);
        
        // Update LME price if data is available
        if (data.type === 'averagePrice' && data.averagePrice !== undefined) {
          setLmePrice(data.averagePrice.toFixed(2));
          setIsLmeLiveMode(false);
          
          // Provide visual feedback
          if (lmePriceFieldRef.current) {
            lmePriceFieldRef.current.classList.add('bg-green-50');
            setTimeout(() => {
              lmePriceFieldRef.current?.classList.remove('bg-green-50');
            }, 1000);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching current month cash settlement:', error);
      setLmeConnectionError(error instanceof Error ? error.message : 'Failed to fetch current month cash settlement data');
    } finally {
      setIsLoadingMonthlyCashSettlement(false);
    }
  };

  // Handle Avg CSP MTD button click
  const handleAvgCspMtdClick = () => {
    fetchCurrentMonthCashSettlement();
  };

  // New function to fetch previous month's cash settlement data
  const fetchPreviousMonthCashSettlement = async () => {
    try {
      setIsLoadingMonthlyCashSettlement(true);
      
      // Create cacheBuster to prevent caching
      const cacheBuster = new Date().getTime();
      
      // Use the previous month and year
      const currentDate = new Date();
      currentDate.setMonth(currentDate.getMonth() - 1);
      const month = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
      const year = currentDate.getFullYear();
      
      // Fetch data from the API
      const response = await fetch(
        `/api/monthly-cash-settlement?month=${month}&year=${year}&_t=${cacheBuster}`,
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch previous month's cash settlement: ${response.status}`);
      } else {
        const data = await response.json();
        setMonthlyCashSettlementData(data);
        
        // Update LME price if data is available
        if (data.type === 'averagePrice' && data.averagePrice !== undefined) {
          setLmePrice(data.averagePrice.toFixed(2));
          setIsLmeLiveMode(false);
          
          // Provide visual feedback
          if (lmePriceFieldRef.current) {
            lmePriceFieldRef.current.classList.add('bg-green-50');
            setTimeout(() => {
              lmePriceFieldRef.current?.classList.remove('bg-green-50');
            }, 1000);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching previous month cash settlement:', error);
      setLmeConnectionError(error instanceof Error ? error.message : 'Failed to fetch previous month cash settlement data');
    } finally {
      setIsLoadingMonthlyCashSettlement(false);
    }
  };

  // Handle M-1 button click
  const handleM1Click = () => {
    fetchPreviousMonthCashSettlement();
  };

  const handlePremiumKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && freightInputRef.current) {
      freightInputRef.current.focus();
    }
  };

  const toggleMcxLiveMode = () => {
    if (!isMcxLiveMode && mcxLoading) return;
    
    const newLiveMode = !isMcxLiveMode;
    setIsMcxLiveMode(newLiveMode);
    
    if (newLiveMode) {
      // Switching to live mode
      setMcxLastUpdate(new Date());
      
      // Auto-select first month if no month selected and months data is available
      if (!selectedMonth && mcxMonthsData) {
        setSelectedMonth(mcxMonthsData.month1Label);
        setMcxPrice(mcxMonthsData.month1Price.toFixed(2));
      } else {
        // Clear selected month when going to live mode without month data
        setSelectedMonth(null);
      }
    } else {
      // Switching to manual mode
      setMcxPrice(''); // Clear price when switching to manual
    }
  };

  const handleMcxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsMcxLiveMode(false);
    setSelectedMonth(null); // Clear selected month when manually changing price
    setMcxPrice(e.target.value);
  };

  const handleLmePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsLmeLiveMode(false);
    setLmePrice(e.target.value);
  };

  const calculateMCXTotal = () => {
    const price = parseFloat(mcxPrice) || 0;
    const premium = parseFloat(mcxPremium) || 0;
    const freight = parseFloat(mcxFreight) || 0;
    return price + premium + freight;
  };

  const calculateLMETotal = () => {
    const price = parseFloat(lmePrice) || 0;
    const premium = parseFloat(lmePremium) || 0;
    const freight = parseFloat(lmeFreight) || 0;
    const exchangeRate = exchangeRateType === 'RBI' ? RBI_RATE : SBI_TT_RATE;
    
    // Convert from USD/MT to INR/kg:
    // 1. Add price and premium (in USD/MT)
    // 2. Apply duty factor
    // 3. Convert to INR using exchange rate
    // 4. Convert from per MT to per kg (divide by 1000)
    // 5. Add freight (already in INR/kg)
    return (((price + premium) * DUTY_FACTOR * exchangeRate) / 1000) + freight;
  };

  // Fetch MCX months data
  const fetchMCXMonthsData = useCallback(async () => {
    try {
      setLoadingMonths(true);
      const res = await fetch('/api/3_month_mcx?action=view&limit=1');
      
      if (!res.ok) {
        throw new Error('Failed to fetch MCX months data');
      }
      
      const result = await res.json();
      
      if (result.success && result.data?.length > 0) {
        const rawData = result.data[0];
        const monthsData = {
          month1Label: rawData.month1Label,
          month1Price: parseFloat(rawData.month1Price),
          month2Label: rawData.month2Label,
          month2Price: parseFloat(rawData.month2Price),
          month3Label: rawData.month3Label,
          month3Price: parseFloat(rawData.month3Price)
        };
        
        console.log('MCX months data received in UI:', 
          `Month1: ${monthsData.month1Label} (${monthsData.month1Price})`, 
          `Month2: ${monthsData.month2Label} (${monthsData.month2Price})`, 
          `Month3: ${monthsData.month3Label} (${monthsData.month3Price})`
        );
        
        setMcxMonthsData(monthsData);
        
        // If in live mode but no month is selected, select the first month
        if (isMcxLiveMode && !selectedMonth) {
          setSelectedMonth(monthsData.month1Label);
          
          // Make sure the price is updated too
          if (mcxPriceData) {
            setMcxPrice(mcxPriceData.currentPrice.toFixed(2));
            setMcxLastUpdate(new Date());
            
            // Provide visual feedback for auto-selection
            setIsMcxPriceUpdating(true);
            setTimeout(() => {
              setIsMcxPriceUpdating(false);
            }, 1000);
            
            if (mcxPriceFieldRef.current) {
              mcxPriceFieldRef.current.classList.add('bg-green-50');
              setTimeout(() => {
                mcxPriceFieldRef.current?.classList.remove('bg-green-50');
              }, 1000);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching MCX months data:', err);
    } finally {
      setLoadingMonths(false);
    }
  }, [isMcxLiveMode, mcxPriceData, selectedMonth]);
  
  // Set price for specific month
  const setMonthPrice = (monthNum: 1 | 2 | 3) => {
    if (!mcxMonthsData) return;
    
    const price = mcxMonthsData[`month${monthNum}Price`];
    const label = mcxMonthsData[`month${monthNum}Label`];
    
    // Update price regardless of mode
    setMcxPrice(price.toFixed(2));
    setSelectedMonth(label);
    
    // If in live mode, keep it in live mode but with the selected month's price
    if (isMcxLiveMode) {
      // Don't need to change the mode, just update the last update time
      setMcxLastUpdate(new Date());
    }
    
    // Visual feedback
    if (mcxPriceFieldRef.current) {
      // Use different color based on mode
      mcxPriceFieldRef.current.classList.add(isMcxLiveMode ? 'bg-green-50' : 'bg-blue-50');
      setTimeout(() => {
        mcxPriceFieldRef.current?.classList.remove('bg-green-50', 'bg-blue-50');
      }, 1000);
    }
    
    // Show updating effect
    setIsMcxPriceUpdating(true);
    setTimeout(() => {
      setIsMcxPriceUpdating(false);
    }, 1000);
  };
  
  // Fetch months data on component mount
  useEffect(() => {
    fetchMCXMonthsData();
    const interval = setInterval(fetchMCXMonthsData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchMCXMonthsData]);

  // Render skeleton loaders for the inputs
  const renderPriceInputSkeleton = () => (
    <div className="relative flex-grow flex items-center">
      <div className="w-full h-14 bg-white rounded-full border border-gray-200 shadow-sm overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-full bg-gradient-to-r from-gray-100 to-gray-200 animate-shimmer"></div>
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
          background-size: 200% 100%;
        }
      `}</style>
    </div>
  );

  // Render skeleton for buttons
  const renderButtonsSkeleton = () => (
    <div className="flex items-center justify-between gap-2 mt-0 h-full">
      {[1, 2, 3].map((_, i) => (
        <div key={i} className="flex-1 h-10 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-full bg-gradient-to-r from-gray-100 to-gray-200 animate-shimmer"></div>
        </div>
      ))}
    </div>
  );

  // Render loading state for the total price
  const renderTotalPriceSkeleton = () => (
    <div className="relative w-full h-14 rounded-lg overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/30 to-indigo-400/30 animate-pulse-subtle"></div>
    </div>
  );

  // Whether we're ready to display data
  const isDataReady = !mcxLoading && !lmeLoading && !ratesLoading;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${className}`}>
      {/* MCX Based Price */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 border border-blue-100 h-full relative overflow-hidden group flex flex-col">
        {/* Background graphics */}
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-600/5 rounded-full -mr-20 -mb-20 z-0"></div>
        <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-600/5 rounded-full -ml-10 -mt-10 z-0"></div>
        
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
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-md">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              MCX Based Price
            </h2>
            <p className="text-xs text-blue-700/70">Multi Commodity Exchange</p>
          </div>
        </div>

        <div className="space-y-6 relative z-10 flex-grow flex flex-col">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-blue-100 shadow-sm min-h-[200px] flex flex-col">
            <div className="flex items-center justify-between mb-2 h-6">
              <label className="text-sm font-medium text-gray-700">
                MCX Aluminum Price (₹/kg)
              </label>
              {selectedMonth && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  {selectedMonth}
                </span>
              )}
            </div>
            
            <div className="h-14 mb-3">
              {mcxLoading && !mcxPriceData ? (
                <div className="flex flex-col flex-1">
                  {renderPriceInputSkeleton()}
                </div>
              ) : (
                <div className="relative flex-grow flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center h-full">
                    <span className="text-gray-500 text-base font-medium flex items-center h-full">₹</span>
                  </div>
                  <input
                    ref={mcxPriceFieldRef}
                    type="number"
                    value={mcxPrice}
                    onChange={handleMcxPriceChange}
                    placeholder="Enter MCX price"
                    disabled={isMcxLiveMode}
                    className="w-full pl-10 py-3 h-12 border-2 border-gray-200 active:border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 text-base bg-white placeholder:text-gray-400 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <button
                      onClick={toggleMcxLiveMode}
                      disabled={mcxLoading}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all duration-300 border-2 border-gray-200 active:border-gray-300 shadow-md
                        ${isMcxLiveMode ? 'bg-gradient-to-r from-green-400 to-green-600 text-white hover:from-green-500 hover:to-green-700' : 'bg-gradient-to-r from-gray-300 to-gray-500 text-white hover:from-gray-400 hover:to-gray-600'}
                        ${mcxLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {mcxLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isMcxLiveMode ? (
                        <>
                          <Wifi className="w-4 h-4" />
                          <span className="hidden sm:inline">Live</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-4 h-4" />
                          <span className="hidden sm:inline">Manual</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="h-10 mb-2">
              {loadingMonths ? (
                renderButtonsSkeleton()
              ) : (
                <div className="flex items-center justify-between gap-2 h-full">
                  {mcxMonthsData ? (
                    <>
                      <button
                        onClick={() => setMonthPrice(1)}
                        className={`flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all shadow-sm ${
                          selectedMonth === mcxMonthsData.month1Label 
                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white border border-green-300' 
                            : 'bg-white border border-green-200 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>{mcxMonthsData.month1Label.split(' ')[0]}</span>
                      </button>
                      <button
                        onClick={() => setMonthPrice(2)}
                        className={`flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all shadow-sm ${
                          selectedMonth === mcxMonthsData.month2Label 
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-300' 
                            : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50'
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>{mcxMonthsData.month2Label.split(' ')[0]}</span>
                      </button>
                      <button
                        onClick={() => setMonthPrice(3)}
                        className={`flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium transition-all shadow-sm ${
                          selectedMonth === mcxMonthsData.month3Label 
                            ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white border border-purple-300' 
                            : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50'
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>{mcxMonthsData.month3Label.split(' ')[0]}</span>
                      </button>
                    </>
                  ) : (
                    <div className="w-full text-center py-2 text-xs text-gray-500">
                      No month data available
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="h-4 flex items-center text-xs">
              {mcxConnectionError ? (
                <p className="text-red-500 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-500"></span>
                  {mcxConnectionError}
                </p>
              ) : mcxLastUpdate && isMcxLiveMode ? (
                <p className="text-blue-500 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-blue-500"></span>
                  Last updated: {mcxLastUpdate.toLocaleTimeString()}
                </p>
              ) : null}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-blue-100 shadow-sm h-[132px] flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Premium (₹/kg)
            </label>
            <div className="relative flex-grow flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center h-full">
                <span className="text-gray-500 text-base font-medium flex items-center h-full">₹</span>
              </div>
              <input
                type="number"
                value={mcxPremium}
                onChange={(e) => setMcxPremium(e.target.value)}
                onKeyDown={handlePremiumKeyPress}
                className="w-full pl-10 py-3 h-12 border-2 border-gray-200 active:border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 text-base bg-white placeholder:text-gray-400 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="Enter premium"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-blue-100 shadow-sm min-h-[100px] flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Freight (₹/kg)
            </label>
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-lg font-medium">₹</span>
              </div>
              <input
                ref={freightInputRef}
                type="number"
                value={mcxFreight}
                onChange={(e) => setMcxFreight(e.target.value)}
                className="w-full pl-10 py-3 h-12 border-2 border-gray-200 active:border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 text-base bg-white placeholder:text-gray-400 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="Enter freight"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-blue-200/50 min-h-[120px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Total Price (per kg)
              </label>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-blue-500" />
                <Sparkles className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            
            {!isDataReady && mcxLoading ? (
              renderTotalPriceSkeleton()
            ) : (
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-white font-medium">₹</span>
                </div>
                <input
                  type="text"
                  value={calculateMCXTotal().toFixed(2)}
                  disabled
                  className={`w-full pl-9 pr-4 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 border-0 rounded-lg font-bold text-white text-xl shadow-md transition-all duration-300 ${isMcxPriceUpdating ? 'animate-pulse' : ''}`}
                />
                {isMcxPriceUpdating && (
                  <div className="absolute inset-0 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <div className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full animate-pulse">
                      Updating...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LME Based Price */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-lg p-6 border border-purple-100 h-full relative overflow-hidden group flex flex-col">
        {/* Background graphics */}
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-purple-600/5 rounded-full -mr-20 -mb-20 z-0"></div>
        <div className="absolute top-0 left-0 w-32 h-32 bg-pink-600/5 rounded-full -ml-10 -mt-10 z-0"></div>
        
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="p-2.5 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl shadow-md">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              LME Based Price
            </h2>
            <p className="text-xs text-purple-700/70">London Metal Exchange</p>
          </div>
        </div>

        <div className="space-y-6 relative z-10 flex-grow flex flex-col">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-purple-100 shadow-sm min-h-[200px] flex flex-col">
            <div className="flex items-center justify-between mb-2 h-6">
              <label className="text-sm font-medium text-gray-700">
                LME Aluminum Price (USD/MT)
              </label>
            </div>
            
            <div className="h-14 mb-3">
              {lmeLoading && !lmePriceData ? (
                <div className="flex flex-col flex-1">
                  {renderPriceInputSkeleton()}
                </div>
              ) : (
                <div className="relative flex-grow flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center h-full">
                    <span className="text-gray-500 text-base font-medium flex items-center h-full">$</span>
                  </div>
                  <input
                    ref={lmePriceFieldRef}
                    type="number"
                    value={lmePrice}
                    onChange={handleLmePriceChange}
                    placeholder="Enter LME price"
                    disabled={isLmeLiveMode}
                    className="w-full pl-10 py-3 h-12 border-2 border-gray-200 active:border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-700 text-base bg-white placeholder:text-gray-400 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <button
                      onClick={toggleLmeLiveMode}
                      disabled={lmeLoading}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all duration-300 border-2 border-gray-200 active:border-gray-300 shadow-md
                        ${isLmeLiveMode ? 'bg-gradient-to-r from-green-400 to-green-600 text-white hover:from-green-500 hover:to-green-700' : 'bg-gradient-to-r from-gray-300 to-gray-500 text-white hover:from-gray-400 hover:to-gray-600'}
                        ${lmeLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {lmeLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isLmeLiveMode ? (
                        <>
                          <Wifi className="w-4 h-4" />
                          <span className="hidden sm:inline">Live</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-4 h-4" />
                          <span className="hidden sm:inline">Manual</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="h-10 mb-2">
              <div className="flex items-center justify-between gap-2 h-full">
                <button 
                  onClick={handleAvgCspMtdClick}
                  disabled={isLoadingMonthlyCashSettlement}
                  className="flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 transition-all shadow-sm"
                >
                  {isLoadingMonthlyCashSettlement && !monthlyCashSettlementData ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <span>Avg CSP MTD</span>
                  )}
                </button>
                
                <button 
                  onClick={handleM1Click}
                  disabled={isLoadingMonthlyCashSettlement}
                  className="flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium bg-white border border-pink-200 text-pink-700 hover:bg-pink-50 transition-all shadow-sm"
                >
                  {isLoadingMonthlyCashSettlement && monthlyCashSettlementData?.month !== new Date().getMonth() ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <span>M-1</span>
                  )}
                </button>
                
                <button 
                  onClick={handleEstCspClick}
                  disabled={isLoadingMonthlyCashSettlement}
                  className="flex-1 py-2 px-2 flex items-center justify-center gap-1 rounded-lg text-xs font-medium bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-all shadow-sm"
                >
                  {isLoadingMonthlyCashSettlement ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <span>EST CSP</span>
                  )}
                </button>
              </div>
            </div>
            
            <div className="h-4 flex items-center text-xs">
              {lmeConnectionError ? (
                <p className="text-red-500 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-red-500"></span>
                  {lmeConnectionError}
                </p>
              ) : lmeLastUpdate && isLmeLiveMode ? (
                <p className="text-purple-500 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-purple-500"></span>
                  Last updated: {lmeLastUpdate.toLocaleTimeString()}
                </p>
              ) : monthlyCashSettlementData?.type === 'averagePrice' && monthlyCashSettlementData?.monthName ? (
                <p className="text-indigo-500 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-indigo-500"></span>
                  {monthlyCashSettlementData.monthName} avg ({monthlyCashSettlementData.dataPointsCount} data points)
                </p>
              ) : null}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-purple-100 shadow-sm h-[132px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Premium (USD/MT)
              </label>
              {!ratesLoading ? (
                <div className="text-xs font-medium bg-white border border-purple-200 text-purple-700 px-2.5 py-1 rounded-full shadow-sm">
                  Exchange Rate: <span className="font-semibold">₹{exchangeRateType === 'RBI' ? RBI_RATE.toFixed(4) : SBI_TT_RATE.toFixed(4)}</span>
                </div>
              ) : (
                <div className="text-xs font-medium bg-white border border-purple-200 text-purple-600 px-2.5 py-1 rounded-full shadow-sm flex items-center">
                  <div className="h-4 w-20 bg-gray-200 animate-pulse-subtle rounded"></div>
                </div>
              )}
            </div>
            <div className="flex gap-2 h-14">
              <div className="relative flex-grow flex items-center">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center h-full">
                  <span className="text-gray-500 text-base font-medium flex items-center h-full">$</span>
                </div>
                <input
                  type="number"
                  value={lmePremium}
                  onChange={(e) => setLmePremium(e.target.value)}
                  onKeyDown={handlePremiumKeyPress}
                  className="w-full pl-10 py-3 h-12 border-2 border-gray-200 active:border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-700 text-base bg-white placeholder:text-gray-400 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="Enter premium"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="flex rounded-full overflow-hidden border-2 border-gray-200 active:border-gray-300 shadow-sm min-w-[90px]">
                <button
                  type="button"
                  onClick={() => setExchangeRateType('RBI')}
                  className={`flex-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${exchangeRateType === 'RBI' ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  RBI
                </button>
                <button
                  type="button"
                  onClick={() => setExchangeRateType('SBI')}
                  className={`flex-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${exchangeRateType === 'SBI' ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  SBI
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-purple-100 shadow-sm min-h-[100px] flex flex-col">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Freight (₹/kg)
            </label>
            <div className="relative flex-grow flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none h-full">
                <span className="text-gray-500 text-base font-medium">₹</span>
              </div>
              <input
                type="number"
                value={lmeFreight}
                onChange={(e) => setLmeFreight(e.target.value)}
                className="w-full pl-10 py-3 h-12 border-2 border-gray-200 active:border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-700 text-base bg-white placeholder:text-gray-400 appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="Enter freight"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-purple-200/50 min-h-[120px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Total Price (per kg)
              </label>
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-purple-500" />
                <Sparkles className="w-4 h-4 text-purple-500" />
              </div>
            </div>
            
            {!isDataReady && lmeLoading ? (
              renderTotalPriceSkeleton()
            ) : (
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-white font-medium">₹</span>
                </div>
                <input
                  type="text"
                  value={calculateLMETotal().toFixed(2)}
                  disabled
                  className={`w-full pl-9 pr-4 py-4 bg-gradient-to-r from-purple-600 to-pink-600 border-0 rounded-lg font-bold text-white text-xl shadow-md transition-all duration-300 ${isLmePriceUpdating ? 'animate-pulse' : ''}`}
                />
                {isLmePriceUpdating && (
                  <div className="absolute inset-0 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <div className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full animate-pulse">
                      Updating...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
