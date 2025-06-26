import React, { useState, useEffect, useRef, useCallback } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Maximize2, LineChart, Info, BarChart2 } from "lucide-react";
import { useExpandedComponents } from "../../context/ExpandedComponentsContext";
import { useMetalPrice } from "../../context/MetalPriceContext";
import ExpandedModalWrapper from "./ExpandedModalWrapper";

// Add a debounce utility function
const debounce = (func: (...args: unknown[]) => void, wait: number) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: unknown[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  timestamp?: string;
  timeSpan?: string;
  isCached?: boolean;
  error?: string;
}

interface MonthPriceProps {
  expanded?: boolean;
}

export default function MonthPrice({ expanded = false }: MonthPriceProps) {
  const [showAddOptions, setShowAddOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [priceData, setPriceData] = useState<PriceData>({
    price: 0,
    change: 0,
    changePercent: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { addExpandedComponent } = useExpandedComponents();
  const { triggerRefresh, registerRefreshListener } = useMetalPrice();
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Flag to track if this is the first load - moved outside useEffect
  const isFirstLoadRef = useRef(true);

  const fetchData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }
      
      // Add cache-busting parameter to prevent stale responses
      const timestamp = new Date().getTime();
      
      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const res = await fetch(`/api/price?latest=true&_t=${timestamp}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error('Failed to fetch data');
        
        const data = await res.json();
        
        console.log('Received data from API:', data);
        
        if (data.error) {
          setError(data.error);
          // Still use the data if available
          setPriceData(data);
        } else {
          setPriceData(data);
          setError(null);
          // Reset retry count on successful fetch
          retryCountRef.current = 0;
        }
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        
        // Check if it's an abort error (timeout)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out. The server took too long to respond.');
        }
        
        // Re-throw other fetch errors
        throw fetchError;
      }
    } catch (err) {
      console.error('Error:', err);
      
      // Increment retry count
      retryCountRef.current += 1;
      
      if (retryCountRef.current <= maxRetries) {
        // Show a more informative error message
        setError(`Connection issue. Retry ${retryCountRef.current}/${maxRetries}...`);
      } else {
        // After max retries, show a detailed message but keep the last valid data
        setError('Connection lost. Please refresh manually.');
        
        // Stop automatic polling if we've reached max retries
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } finally {
      if (isManualRefresh) {
        setIsRefreshing(false);
      }
      setIsLoading(false);
    }
  }, []);

  // Manual refresh handler that resets retry count and triggers shared refresh
  const handleManualRefresh = () => {
    console.log('MonthPrice: Manual refresh triggered');
    
    // Reset retry count when manually refreshing
    retryCountRef.current = 0;
    
    // Restart polling if it was stopped
    if (!pollIntervalRef.current) {
      startPolling();
    }
    
    // Emit global refresh event for all price components
    const globalRefreshEvent = new CustomEvent('global-price-refresh', {
      detail: { source: 'MonthPrice' }
    });
    window.dispatchEvent(globalRefreshEvent);
    
    // Trigger global refresh for all price components
    triggerRefresh();
    
    fetchData(true);
  };

  // Function to start polling with longer interval (60 seconds)
  const startPolling = useCallback(() => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    // Start a new polling interval - 60 seconds is more reasonable for database polling
    pollIntervalRef.current = setInterval(() => {
      fetchData(false);
    }, 60000); // 60 seconds
  }, [fetchData]);

  useEffect(() => {
    // Initial fetch - only on first mount
    if (isFirstLoadRef.current) {
      fetchData(false);
      isFirstLoadRef.current = false;
    }
    
    // Start polling
    startPolling();
    
    // Register this component for synchronized refreshes
    const unregister = registerRefreshListener(() => {
      console.log("MonthPrice received refresh signal");
      fetchData(true);
    });
    
    // Cleanup function
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      // Unregister from refresh notifications
      unregister();
    };
  }, [registerRefreshListener, fetchData, startPolling]);

  // Add visibility change listener to pause/resume polling when tab is hidden/visible
  useEffect(() => {
    const handleVisibilityChange = debounce(() => {
      if (document.visibilityState === 'visible') {
        // Tab is active again, refresh data and restart polling
        try {
          fetchData(false).catch(err => {
            console.error('Error fetching data on visibility change:', err);
            // Don't throw, just log the error to prevent unhandled promise rejection
          });
          startPolling();
        } catch (error) {
          console.error('Error in visibility change handler:', error);
          // Continue execution even if there's an error
        }
      } else {
        // Tab is hidden, pause polling to save resources
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    }, 300);
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, startPolling]);

  // Add effect to listen for global refresh events from other components
  useEffect(() => {
    interface GlobalRefreshEvent extends CustomEvent {
      detail: {
        source: string;
      };
    }
    
    // Handle global refresh events
    const handleGlobalRefresh = debounce((event: GlobalRefreshEvent) => {
      console.log('MonthPrice: Received global-price-refresh event from:', event.detail.source);
      // Only refresh if the event came from another component
      if (event.detail.source !== 'MonthPrice') {
        console.log('MonthPrice: Refreshing due to external trigger');
        fetchData(true);
      }
    }, 300);
    
    // Add event listener
    window.addEventListener('global-price-refresh', handleGlobalRefresh as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('global-price-refresh', handleGlobalRefresh as EventListener);
    };
  }, [fetchData]);

  // Add click-away listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAddOptions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle add component selection
  const handleAddComponent = (componentType: 'LMEAluminium' | 'MCXAluminium' | 'RatesDisplay') => {
    addExpandedComponent(componentType);
    setShowAddOptions(false);
  };

  const { price, change, changePercent, timestamp, isCached } = priceData;
  const isIncrease = change >= 0;
  
  // Render expanded content
  const renderExpandedContent = () => (
    <>
      <div className="flex items-end justify-between w-full mb-4">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowAddOptions(prev => !prev)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Add
          </button>
          {showAddOptions && (
            <div className="absolute left-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20 py-1 border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-100 bg-gray-50">
                Add to Dashboard
              </div>
              <div className="py-1">
                <button 
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-2"
                  onClick={() => handleAddComponent('LMEAluminium')}
                >
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  LME Spot Price
                </button>
                <button 
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-2"
                  onClick={() => handleAddComponent('MCXAluminium')}
                >
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  MCX Aluminium
                </button>
                <button 
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-2"
                  onClick={() => handleAddComponent('RatesDisplay')}
                >
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  Exchange Rates
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="p-1 bg-gray-100 hover:bg-gray-200 rounded-full"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="bg-purple-50 rounded-lg p-4 mb-4 border border-purple-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Forward Price</span>
          {!isLoading && timestamp && (
            <div className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
              <span>Updated at: {new Date(timestamp).toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
              }).replace(/ /g, '-')}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-baseline gap-1 mb-3">
          {isLoading ? (
            <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
          ) : (
            <>
              <span className="font-mono font-bold text-3xl text-purple-600">
                ${price.toFixed(2)}
              </span>
              <span className="text-gray-500">/MT</span>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="h-10 bg-gray-200 animate-pulse rounded-lg"></div>
        ) : error ? (
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <p className="text-sm text-red-500">{error}</p>
            <p className="text-xs text-gray-500">Using last known values</p>
          </div>
        ) : (
          <div className={`flex items-center gap-2 ${isIncrease ? "text-green-600" : "text-red-600"} bg-white p-2 rounded-lg border ${isIncrease ? "border-green-100" : "border-red-100"}`}>
            <div className={`p-1 rounded-full ${isIncrease ? "bg-green-100" : "bg-red-100"}`}>
              {isIncrease ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-sm font-medium">
                {isIncrease ? "+" : ""}{change.toFixed(2)} ({changePercent.toFixed(2)}%)
              </span>
              <p className="text-xs text-gray-500">From previous close</p>
            </div>
          </div>
        )}
        
        {!isLoading && isCached && (
          <div className="mt-2 flex items-center gap-1 text-yellow-600 bg-yellow-50 p-1.5 rounded text-xs border border-yellow-100">
            <Info className="w-3.5 h-3.5" />
            <span>Showing cached data</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-3">
        <div className="flex items-center gap-1.5 text-purple-700 mb-2">
          <LineChart className="w-3.5 h-3.5" />
          <h3 className="text-sm font-medium">Market Insight</h3>
        </div>
        
        <div className="space-y-3">
          {isLoading ? (
            <>
              <div className="h-3 bg-gray-200 animate-pulse rounded w-full"></div>
              <div className="h-3 bg-gray-200 animate-pulse rounded w-11/12"></div>
              <div className="h-3 bg-gray-200 animate-pulse rounded w-10/12"></div>
              <div className="h-3 bg-gray-200 animate-pulse rounded w-full"></div>
              <div className="h-3 bg-gray-200 animate-pulse rounded w-9/12"></div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-600">
                The 3-month futures price indicates market expectations for future aluminium delivery. The current {isIncrease ? "increase" : "decrease"} suggests {isIncrease ? "positive" : "negative"} market sentiment.
              </p>
              
              <p className="text-xs text-gray-600">
                Forward prices show where the market expects aluminium to trade in three months&apos; time, reflecting anticipated changes in supply and demand over that period.
              </p>
              
              <div className="text-xs text-gray-500 mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  <span>Updated at: {timestamp ? new Date(timestamp).toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                  }).replace(/ /g, '-') : 'N/A'}</span>
                </div>
                <span>LME London</span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
  
  // If expanded prop is true, render just the expanded content
  if (expanded) {
    return (
      <ExpandedModalWrapper
        title="3-Month Futures"
        subtitle="LME Aluminium Forward Price"
        componentType="MonthPrice"
      >
        {renderExpandedContent()}
      </ExpandedModalWrapper>
    );
  }

  return (
    <>
      {/* Regular Card View */}
      <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200 min-h-[148px] relative">
        {/* Glow effect on hover - desktop only, without blur */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none bg-gradient-to-br from-purple-50/30 via-indigo-50/30 to-violet-50/30 hidden sm:block"></div>
        
        <div className="flex items-center justify-between mb-2 relative z-10">
          <div className="flex items-center gap-2">
            <div className="relative">
              <BarChart2 className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-purple-600">3-Month </h2>
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-semibold leading-none">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                <span>LIVE</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-1 hover:bg-gray-100 rounded-full text-gray-600"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => addExpandedComponent('MonthPrice')}
              className="p-1 hover:bg-gray-100 rounded-full text-gray-600"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mb-2 relative z-10">{error}</p>}
        {!isLoading && isCached && <p className="text-xs text-yellow-500 mb-2 relative z-10">Showing cached data</p>}

        <div className="flex items-baseline gap-1 relative z-10">
          {isLoading ? (
            <div className="h-9 w-32 bg-gray-200 animate-pulse rounded"></div>
          ) : (
            <>
              <span className="font-mono font-bold text-3xl text-purple-600">
                ${price.toFixed(2)}
              </span>
              <span className="text-sm text-gray-500">/MT</span>
            </>
          )}
        </div>

        {isLoading ? (
          <div className="h-6 w-36 bg-gray-200 animate-pulse rounded mt-1.5"></div>
        ) : (
          <div className={`flex items-center gap-1.5 mt-1.5 ${isIncrease ? "text-green-600" : "text-red-600"} relative z-10`}>
            <div className={`p-0.5 rounded-full ${isIncrease ? "bg-green-100" : "bg-red-100"}`}>
              {isIncrease ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            </div>
            <span className="text-sm font-medium">
              {isIncrease ? "+" : ""}{change.toFixed(2)} ({changePercent.toFixed(2)}%)
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="h-4 w-40 bg-gray-200 animate-pulse rounded mt-2"></div>
        ) : timestamp && (
          <div className="text-xs text-gray-500 mt-2 relative z-10">
            Updated at: {new Date(timestamp).toLocaleDateString('en-GB', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric' 
            }).replace(/ /g, '-')}
          </div>
        )}
      </div>
    </>
  );
} 

