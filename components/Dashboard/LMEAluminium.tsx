'use client';

import React, { useState, useEffect, useRef, useCallback } from "react";
import { TrendingUp, TrendingDown, Maximize2, Wifi, LineChart, RefreshCw, BarChart2 } from "lucide-react";

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

interface SpotPriceData {
  spotPrice: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
}

interface LMEAluminiumProps {
  expanded?: boolean;
}

export default function LMEAluminium({ expanded = false }: LMEAluminiumProps) {
  const [showAddOptions, setShowAddOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [priceData, setPriceData] = useState<PriceData>({
    price: 0,
    change: 0,
    changePercent: 0
  });
  const [spotPriceData, setSpotPriceData] = useState<SpotPriceData>({
    spotPrice: 0,
    change: 0,
    changePercent: 0,
    lastUpdated: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addExpandedComponent } = useExpandedComponents();
  const { registerRefreshListener, updateSharedSpotPrice, forceSync } = useMetalPrice();
  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Flag to track if this is the first load - moved outside useEffect
  const isFirstLoadRef = useRef(true);

  // Create a custom event to directly sync components
  const emitSyncEvent = useCallback((data: SpotPriceData) => {
    try {
      // First update the context
      updateSharedSpotPrice(data);
      
      // Then dispatch a global event for immediate sync
      const syncEvent = new CustomEvent('spot-price-sync', { 
        detail: { spotPriceData: data } 
      });
      window.dispatchEvent(syncEvent);
      console.log('LMEAluminium: Emitted spot-price-sync event with data:', data);
    } catch (error) {
      console.error('Error emitting sync event:', error);
    }
  }, [updateSharedSpotPrice]);

  // Function to update spot price data using the spot-price-update API
  const updateSpotPrice = async () => {
    try {
      console.log('Starting updateSpotPrice using GET method');
      
      // Use cache-busting parameter to prevent stale responses
      const timestamp = new Date().getTime();
      
      // Use GET method to fetch data from the spot-price-update endpoint
      const res = await fetch(`/api/spot-price-update?_t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch spot price data: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      console.log('Step 2: Received spot price data:', data);
      
      if (!data || !data.data) {
        throw new Error('Invalid spot price data format');
      }
      
      // Update spot price data state directly from the API response
      const newSpotPriceData = {
        spotPrice: data.data.spotPrice,
        change: data.data.change,
        changePercent: data.data.changePercent,
        lastUpdated: data.data.lastUpdated
      };
      
      // Set the spot price data
      setSpotPriceData(newSpotPriceData);
      
      // Share this data with other components via context
      updateSharedSpotPrice(newSpotPriceData);
      
      // Force all components to sync with this data immediately
      forceSync('LMEAluminium');
      
      // Emit original event for backward compatibility
      emitSyncEvent(newSpotPriceData);
      
      console.log('Spot price data updated successfully:', newSpotPriceData);
      
      return {
        success: true,
        message: 'Spot price updated successfully',
        data: newSpotPriceData
      };
    } catch (err) {
      console.error('Error updating spot price:', err);
      // Set error state
      setError(err instanceof Error ? err.message : 'Failed to update spot price');
      
      // Return error
      return {
        success: false,
        message: 'Failed to update spot price',
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  };

  const fetchData = useCallback(async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }
      
      // Add cache-busting parameter to prevent stale responses
      const timestamp = new Date().getTime();
      
      // Fetch data from the spot-price-update endpoint
      console.log('Fetching data from spot-price-update API');
      
      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const res = await fetch(`/api/spot-price-update?_t=${timestamp}`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          throw new Error(`Failed to fetch spot price data: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        console.log('Received spot price data:', data);
        
        if (!data || !data.data) {
          throw new Error('Invalid spot price data format');
        }
        
        // Update spot price data state directly from the API response
        const newSpotPriceData = {
          spotPrice: data.data.spotPrice,
          change: data.data.change,
          changePercent: data.data.changePercent,
          lastUpdated: data.data.lastUpdated
        };
        
        // Reset error state on successful fetch
        setError(null);
        
        // Set the spot price data
        setSpotPriceData(newSpotPriceData);
        
        // Share this data with other components via context
        updateSharedSpotPrice(newSpotPriceData);
        
        // Reset retry count on successful fetch
        retryCountRef.current = 0;
        
        // Force all components to sync with this data immediately
        forceSync('LMEAluminium');
        
        // Emit original event for backward compatibility
        emitSyncEvent(newSpotPriceData);
        
        console.log('Spot price data updated successfully:', newSpotPriceData);
      } catch (fetchError) {
        console.error('Error fetching spot price data:', fetchError);
        
        // Increment retry count
        retryCountRef.current += 1;
        
        if (retryCountRef.current < maxRetries) {
          console.log(`Retry attempt ${retryCountRef.current}/${maxRetries}`);
          
          // Set a retry error message
          setError(`Connection issue. Retry ${retryCountRef.current}/${maxRetries}...`);
          
          // Wait before retrying (exponential backoff)
          const retryDelay = Math.min(1000 * Math.pow(1.5, retryCountRef.current), 10000);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          // Retry the fetch
          return fetchData(isManualRefresh);
        } else {
          // Max retries reached
          setError('Connection issue. Retry 2/5...');
          console.error('Max retry attempts reached');
        }
      }
    } catch (error) {
      console.error('Error in fetchData:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      isFirstLoadRef.current = false;
    }
  }, [forceSync, updateSharedSpotPrice, emitSyncEvent, maxRetries]);

  // Add an effect to listen for data requests
  useEffect(() => {
    interface DataRequestEvent extends CustomEvent {
      detail: {
        source: string;
      };
    }
    
    // Debounce the handler to prevent rapid consecutive calls
    const handleDataRequest = debounce((event: DataRequestEvent) => {
      console.log('LMEAluminium: Received data request from:', event.detail.source);
      
      // If request is from TopCards, prioritize it
      if (event.detail.source === 'TopCards') {
        console.log('LMEAluminium: Priority request from TopCards, fetching fresh data');
        // Trigger a refresh but without the animation to avoid UI conflicts
        const wasRefreshing = isRefreshing;
        if (!wasRefreshing) {
          setIsRefreshing(true);
        }
        
        // Always fetch fresh data for TopCards
        fetchData(true).then(() => {
          // Only reset refreshing if we set it
          if (!wasRefreshing) {
            setIsRefreshing(false);
          }
        });
        return;
      }
      
      // Only respond if we have data to share
      if (spotPriceData.spotPrice > 0) {
        // Force sync our current data
        console.log('LMEAluminium: Responding with data:', spotPriceData);
        forceSync('LMEAluminium');
      } else {
        // If we don't have data, fetch it
        console.log('LMEAluminium: No data to share, fetching new data');
        fetchData(false);
      }
    }, 300); // Add 300ms debounce
    
    // Add event listener
    window.addEventListener('spot-price-request-data', handleDataRequest as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('spot-price-request-data', handleDataRequest as EventListener);
    };
  }, [forceSync, spotPriceData, isRefreshing, fetchData]);

  // Add an effect to listen for force sync events
  useEffect(() => {
    interface ForceSyncEvent extends CustomEvent {
      detail: {
        spotPriceData: SpotPriceData;
        source: string;
      };
    }
    
    // Debounce the handler to prevent rapid consecutive calls
    const handleForceSync = debounce((event: ForceSyncEvent) => {
      // Skip if we triggered the event ourselves
      if (event.detail.source === 'LMEAluminium') {
        return;
      }
      
      console.log('LMEAluminium: Received force-sync event:', event.detail);
      
      // Always update with the shared data, regardless of current state
      setSpotPriceData(event.detail.spotPriceData);
      setLoading(false);
      setIsRefreshing(false);
    }, 300); // Add 300ms debounce
    
    // Add event listener
    window.addEventListener('spot-price-force-sync', handleForceSync as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('spot-price-force-sync', handleForceSync as EventListener);
    };
  }, []);

  // Manual refresh handler that resets retry count and triggers shared refresh
  const handleManualRefresh = async () => {
    console.log('LMEAluminium: Manual refresh triggered');
    
    // Emit global refresh event for all price components
    const globalRefreshEvent = new CustomEvent('global-price-refresh', {
      detail: { source: 'LMEAluminium' }
    });
    window.dispatchEvent(globalRefreshEvent);
    
    // Update spot price directly using the updateSpotPrice function
    // No need to pass threeMonthPrice as the API will fetch it from the external source
    await updateSpotPrice();
    setIsRefreshing(false);
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

  // Add an effect to listen for spot price sync events from other components
  useEffect(() => {
    // Create interface for the custom event
    interface SpotPriceSyncEvent extends CustomEvent {
      detail: {
        spotPriceData: SpotPriceData;
      };
    }
    
    interface GlobalRefreshEvent extends CustomEvent {
      detail: {
        source: string;
      };
    }
    
    // Debounce the handler to prevent rapid consecutive calls
    const handleSpotPriceSync = debounce((event: SpotPriceSyncEvent) => {
      console.log('LMEAluminium: Received spot-price-sync event:', event.detail);
      if (event.detail && event.detail.spotPriceData) {
        // Only update if we're not currently refreshing
        if (!isRefreshing) {
          setSpotPriceData(event.detail.spotPriceData);
          setLoading(false);
        }
      }
    }, 300); // Add 300ms debounce
    
    // Listen for pre-refresh events
    const handlePreRefresh = debounce(() => {
      console.log('LMEAluminium: Received pre-spot-refresh event');
      if (!isRefreshing) {
        setIsRefreshing(true);
        // Auto-dismiss after 2 seconds if no update occurs
        setTimeout(() => setIsRefreshing(false), 2000);
      }
    }, 300); // Add 300ms debounce
    
    // Handle global refresh events
    const handleGlobalRefresh = debounce((event: GlobalRefreshEvent) => {
      console.log('LMEAluminium: Received global-price-refresh event from:', event.detail.source);
      // Only refresh if the event came from another component
      if (event.detail.source !== 'LMEAluminium') {
        console.log('LMEAluminium: Refreshing due to external trigger');
        fetchData(true);
      }
    }, 300);
    
    // Add event listeners
    window.addEventListener('spot-price-sync', handleSpotPriceSync as EventListener);
    window.addEventListener('pre-spot-refresh', handlePreRefresh as EventListener);
    window.addEventListener('global-price-refresh', handleGlobalRefresh as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('spot-price-sync', handleSpotPriceSync as EventListener);
      window.removeEventListener('pre-spot-refresh', handlePreRefresh as EventListener);
      window.removeEventListener('global-price-refresh', handleGlobalRefresh as EventListener);
    };
  }, [isRefreshing, fetchData]);

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
      console.log("LMEAluminium received refresh signal");
      fetchData(true);
    });
    
    // Force sync current data to other components if we have it
    // But only do this once, not on every re-render
    if (spotPriceData.spotPrice > 0 && isFirstLoadRef.current) {
      forceSync('LMEAluminium');
    }
    
    // Cleanup function
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      // Unregister from refresh notifications
      unregister();
    };
  }, [registerRefreshListener, forceSync, fetchData, startPolling, spotPriceData.spotPrice]);

  // Add visibility change listener to pause/resume polling when tab is hidden/visible
  useEffect(() => {
    const handleVisibilityChange = () => {
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
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, startPolling]);

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
  const handleAddComponent = (componentType: 'MCXAluminium' | 'MonthPrice' | 'RatesDisplay') => {
    addExpandedComponent(componentType);
    setShowAddOptions(false);
  };

  const { timestamp, isCached } = priceData;
  const { spotPrice, change, changePercent } = spotPriceData;
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
                  onClick={() => handleAddComponent('MCXAluminium')}
                >
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  MCX Aluminium
                </button>
                <button 
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-2"
                  onClick={() => handleAddComponent('MonthPrice')}
                >
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  3-Month LME
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

      <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Current Spot Price</span>
          {!loading && (
            <div className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
              <span>Updated at: {new Date().toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
              }).replace(/ /g, '-')}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-baseline gap-1 mb-3">
          {loading ? (
            <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
          ) : (
            <>
              <span className="font-mono font-bold text-3xl text-blue-600">
                ${spotPrice.toFixed(2)}
              </span>
              <span className="text-gray-500">/MT</span>
            </>
          )}
        </div>

        {loading ? (
          <div className="h-10 bg-gray-200 animate-pulse rounded-lg"></div>
        ) : error ? (
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <p className="text-sm text-red-500">{error}</p>
            <p className="text-xs text-gray-500">Using default values</p>
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
        
        {!loading && isCached && (
          <div className="mt-2 flex items-center gap-1 text-yellow-600 bg-yellow-50 p-1.5 rounded text-xs border border-yellow-100">
            <Wifi className="w-3.5 h-3.5" />
            <span>Showing cached data</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 pt-3">
        <div className="flex items-center gap-1.5 text-blue-700 mb-2">
          <LineChart className="w-3.5 h-3.5" />
          <h3 className="text-sm font-medium">Market Insight</h3>
        </div>
        
        <div className="space-y-3">
          {loading ? (
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
                The current spot price reflects immediate market conditions for aluminium delivery. Today&apos;s {isIncrease ? "increase" : "decrease"} indicates {isIncrease ? "strengthening" : "weakening"} demand in the physical market.
              </p>
              
              <p className="text-xs text-gray-600">
                LME spot prices are a benchmark for the global aluminium market, representing the cost of physically delivered aluminium. Price changes can be influenced by supply and demand dynamics, energy costs, and global economic conditions.
              </p>
              
              <div className="text-xs text-gray-500 mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  <span>Updated at: {new Date().toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                  }).replace(/ /g, '-')}</span>
                </div>
                <span>LME London</span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );

  // Define the renderContent function to handle conditional rendering
  const renderContent = () => {
    // Get today's date for display
    const todayDate = new Date();
    const formattedDate = todayDate.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).replace(/ /g, '-');
    
    // If expanded prop is true, render just the expanded content
    if (expanded) {
      return (
        <ExpandedModalWrapper
          title="LME Aluminium"
          subtitle="Spot Price"
          componentType="LMEAluminium"
        >
          {renderExpandedContent()}
        </ExpandedModalWrapper>
      );
    }

    // Otherwise render the regular card view
    return (
      <>
        {/* Regular Card View */}
        <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-200 min-h-[148px] relative">
          {/* Glow effect on hover - desktop only, without blur */}
          <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none bg-gradient-to-br from-blue-50/30 via-indigo-50/30 to-purple-50/30 hidden sm:block"></div>
          
          <div className="flex items-center justify-between mb-2 relative z-10">
            <div className="flex items-center gap-2">
              <div className="relative">
                <BarChart2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-blue-600">Spot Price</h2>
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-semibold leading-none">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                  <span>LIVE</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => addExpandedComponent('LMEAluminium')}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                aria-label="Expand view"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-red-500 mb-2 relative z-10">{error}</p>}
          {!loading && isCached && <p className="text-xs text-yellow-500 mb-2 relative z-10">Showing cached data</p>}

          <div className="flex items-baseline gap-1 relative z-10">
            {loading ? (
              <div className="h-9 w-32 bg-gray-200 animate-pulse rounded"></div>
            ) : (
              <>
                <span className="font-mono font-bold text-3xl text-blue-600">
                  ${spotPrice.toFixed(2)}
                </span>
                <span className="text-sm text-gray-500">/MT</span>
              </>
            )}
          </div>

          {loading ? (
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

          {loading ? (
            <div className="h-4 w-40 bg-gray-200 animate-pulse rounded mt-2"></div>
          ) : (
            <div className="text-xs text-gray-500 mt-2 relative z-10">
              Updated at: {formattedDate}
            </div>
          )}
        </div>
      </>
    );
  };

  // Return the rendered content
  return renderContent();
}
