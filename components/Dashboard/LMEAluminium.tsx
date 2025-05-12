'use client';

import React, { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Maximize2, Wifi, LineChart, RefreshCw, BarChart2 } from "lucide-react";

import { useExpandedComponents } from "../../context/ExpandedComponentsContext";
import { useMetalPrice } from "../../context/MetalPriceContext";
import ExpandedModalWrapper from "./ExpandedModalWrapper";

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
  const { triggerRefresh, registerRefreshListener, updateSharedSpotPrice, forceSync } = useMetalPrice();
  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Create a custom event to directly sync components
  const emitSyncEvent = (data: SpotPriceData) => {
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
  };

  // Function to save the calculated spot price to database
  const saveSpotPrice = async (threeMonthPrice: number, timestamp: string) => {
    try {
      console.log('Starting saveSpotPrice with 3-month price:', threeMonthPrice);
      
      // Default change value if nothing else works
      // This ensures we always have a change value even if all APIs fail
      const DEFAULT_CHANGE = -9.0;
      const DEFAULT_CHANGE_PERCENT = -0.3676;
      
      // First, check if we need to fetch the latest change value from the database
      // This ensures we're using the most up-to-date value that might have been set by metal-price.ts
      let latestChange = spotPriceData.change || DEFAULT_CHANGE;
      let latestChangePercent = spotPriceData.changePercent || DEFAULT_CHANGE_PERCENT;
      
      console.log(`Initial values from state: change=${latestChange}, changePercent=${latestChangePercent}`);

      try {
        // Try to get the latest change value
        console.log('Attempting to fetch latest change value from metal-price API');
        const res = await fetch('/api/metal-price?forceMetalPrice=true', {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (res.ok) {
          const latestData = await res.json();
          console.log('metal-price API response:', latestData);
          
          if (latestData && latestData.change !== undefined) {
            // If we got a valid change value, use it
            latestChange = latestData.change;
            latestChangePercent = latestData.changePercent || DEFAULT_CHANGE_PERCENT;
            console.log(`Got latest change from API: ${latestChange}, changePercent: ${latestChangePercent}`);
          } else {
            console.warn('metal-price API returned invalid data:', latestData);
          }
        } else {
          console.warn(`metal-price API returned status ${res.status}`);
        }
      } catch (err) {
        console.warn('Could not fetch latest change value from API, using current state value:', err);
      }
      
      // Ensure values are always valid numbers
      if (isNaN(latestChange) || latestChange === 0) {
        console.log(`Change is invalid (${latestChange}), using default: ${DEFAULT_CHANGE}`);
        latestChange = DEFAULT_CHANGE;
      }
      
      if (isNaN(latestChangePercent) || latestChangePercent === 0) {
        console.log(`ChangePercent is invalid (${latestChangePercent}), using default: ${DEFAULT_CHANGE_PERCENT}`);
        latestChangePercent = DEFAULT_CHANGE_PERCENT;
      }
      
      console.log(`Sending to API - 3-month price: ${threeMonthPrice}, using latest change: ${latestChange}, changePercent: ${latestChangePercent}`);
      
      const response = await fetch('/api/spot-price-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          threeMonthPrice,
          timestamp,
          change: latestChange,
          changePercent: latestChangePercent
        })
      });

      const result = await response.json();
      console.log('Saved spot price to database:', result);
      
      // If we get a successful response, update the UI with the calculated spot price
      if (result.success && result.data) {
        const newSpotPriceData = {
          spotPrice: result.data.spotPrice,
          change: result.data.change,
          changePercent: result.data.changePercent,
          lastUpdated: result.data.lastUpdated
        };
        
        // Update local state
        setSpotPriceData(newSpotPriceData);
        
        // Share this data with other components via context
        updateSharedSpotPrice(newSpotPriceData);
        
        // Force all components to sync with this data immediately
        forceSync('LMEAluminium');
        
        // Emit original event for backward compatibility
        emitSyncEvent(newSpotPriceData);
        
        return result;
      } else {
        console.error('Error response from spot-price-update API:', result);
        throw new Error(`API error: ${result.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error saving spot price to database:', err);
      // Since we couldn't save to the database, try to calculate locally as a fallback
      try {
        const DEFAULT_CHANGE = -9.0;
        const calculatedSpotPrice = threeMonthPrice + DEFAULT_CHANGE;
        
        console.log(`Fallback: locally calculated spot price = ${threeMonthPrice} + ${DEFAULT_CHANGE} = ${calculatedSpotPrice}`);
        
        const fallbackData = {
          spotPrice: calculatedSpotPrice,
          change: DEFAULT_CHANGE,
          changePercent: -0.3676,
          lastUpdated: new Date().toISOString()
        };
        
        // Update UI with fallback data
        setSpotPriceData(fallbackData);
        updateSharedSpotPrice(fallbackData);
        forceSync('LMEAluminium');
        emitSyncEvent(fallbackData);
        
        return {
          success: true,
          message: 'Used fallback calculation (database save failed)',
          data: fallbackData
        };
      } catch (fallbackErr) {
        console.error('Even fallback calculation failed:', fallbackErr);
        throw err; // Re-throw the original error
      }
    }
  };

  const fetchData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      }
      
      // Add cache-busting parameter to prevent stale responses
      const timestamp = new Date().getTime();
      console.log('Step 1: Fetching 3-month price data from /api/price');
      const res = await fetch(`/api/price?_t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!res.ok) throw new Error('Failed to fetch data');
      
      const data = await res.json();
      
      console.log('Step 2: Received 3-month price data from API:', data);
      
      if (data.error) {
        setError(data.error);
      } else {
        setPriceData(data);
        
        // Step 3: Explicitly fetch cash settlement data to ensure it's up to date
        console.log('Step 3: Fetching cash settlement data');
        try {
          // Use the more reliable direct endpoint for cash settlement data
          const cashSettlementRes = await fetch(`/api/metal-price?fetchCashSettlement=true&_t=${timestamp}`, {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
          if (cashSettlementRes.ok) {
            const cashData = await cashSettlementRes.json();
            console.log('Cash settlement data response:', cashData);
            // No need to do anything with this data here, just ensuring it's updated in the database
          }
        } catch (cashErr) {
          console.warn('Error fetching cash settlement data:', cashErr);
          // Continue processing even if cash settlement fetch fails
        }
        
        // Step 4: Ensure the change value is in the database by calling metal-price API
        console.log('Step 4: Ensuring change value is in database by calling metal-price API');
        try {
          const metalPriceRes = await fetch(`/api/metal-price?forceMetalPrice=true&_t=${timestamp}`, {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          });
          
          if (metalPriceRes.ok) {
            const changeData = await metalPriceRes.json();
            console.log('Metal price API response:', changeData);
            
            // Only proceed if we got valid data
            if (changeData && changeData.change !== undefined) {
              // Step 5: Now send the 3-month price to calculate spot price
              console.log('Step 5: Sending 3-month price to calculate spot price');
              await saveSpotPrice(
                data.price, 
                data.timestamp || new Date().toISOString()
              );
            } else {
              console.error('Metal price API did not return valid change data');
              throw new Error('Failed to get change value from API');
            }
          } else {
            console.error('Metal price API returned status:', metalPriceRes.status);
            throw new Error('Metal price API returned non-OK status');
          }
        } catch (metalPriceErr) {
          console.error('Error in metal-price API call:', metalPriceErr);
          
          // Fallback: Try to use the 3-month price directly without metal-price API
          console.log('Fallback: Using data directly to calculate spot price');
          await saveSpotPrice(
            data.price, 
            data.timestamp || new Date().toISOString()
          );
        }
        
        setError(null);
        // Reset retry count on successful fetch
        retryCountRef.current = 0;
      }
      
      return true; // Return success
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
      
      return false; // Return failure
    } finally {
      if (isManualRefresh) {
        setIsRefreshing(false);
      }
      setLoading(false);
    }
  };

  // Add an effect to listen for data requests
  useEffect(() => {
    interface DataRequestEvent extends CustomEvent {
      detail: {
        source: string;
      };
    }
    
    const handleDataRequest = (event: DataRequestEvent) => {
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
    };
    
    // Add event listener
    window.addEventListener('spot-price-request-data', handleDataRequest as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('spot-price-request-data', handleDataRequest as EventListener);
    };
  }, [forceSync, spotPriceData, isRefreshing]);

  // Add an effect to listen for force sync events
  useEffect(() => {
    interface ForceSyncEvent extends CustomEvent {
      detail: {
        spotPriceData: SpotPriceData;
        source: string;
      };
    }
    
    const handleForceSync = (event: ForceSyncEvent) => {
      // Skip if we triggered the event ourselves
      if (event.detail.source === 'LMEAluminium') {
        return;
      }
      
      console.log('LMEAluminium: Received force-sync event:', event.detail);
      
      // Always update with the shared data, regardless of current state
      setSpotPriceData(event.detail.spotPriceData);
      setLoading(false);
      setIsRefreshing(false);
    };
    
    // Add event listener
    window.addEventListener('spot-price-force-sync', handleForceSync as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('spot-price-force-sync', handleForceSync as EventListener);
    };
  }, []);

  // Manual refresh handler that resets retry count and triggers shared refresh
  const handleManualRefresh = () => {
    // Reset retry count when manually refreshing
    retryCountRef.current = 0;
    
    // Restart polling if it was stopped
    if (!pollIntervalRef.current) {
      startPolling();
    }
    
    // Trigger global refresh for all price components
    triggerRefresh();
    
    // Emit a pre-refresh event so other components can prepare
    window.dispatchEvent(new Event('pre-spot-refresh'));
    
    fetchData(true).then(success => {
      if (success) {
        // Explicitly force sync to ensure all components have the latest data
        forceSync('LMEAluminium');
        
        // Also notify via original sync method for backward compatibility
        if (spotPriceData.spotPrice > 0) {
          emitSyncEvent(spotPriceData);
        }
      }
    });
  };

  // Function to start polling with longer interval (30 seconds instead of 5)
  const startPolling = () => {
    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    // Start a new polling interval - 30 seconds is more reasonable than 5 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchData(false);
    }, 30000); // 30 seconds
  };

  // Add an effect to listen for spot price sync events from other components
  useEffect(() => {
    // Create interface for the custom event
    interface SpotPriceSyncEvent extends CustomEvent {
      detail: {
        spotPriceData: SpotPriceData;
      };
    }
    
    const handleSpotPriceSync = (event: SpotPriceSyncEvent) => {
      console.log('LMEAluminium: Received spot-price-sync event:', event.detail);
      if (event.detail && event.detail.spotPriceData) {
        // Only update if we're not currently refreshing
        if (!isRefreshing) {
          setSpotPriceData(event.detail.spotPriceData);
          setLoading(false);
        }
      }
    };
    
    // Listen for pre-refresh events
    const handlePreRefresh = () => {
      console.log('LMEAluminium: Received pre-spot-refresh event');
      if (!isRefreshing) {
        setIsRefreshing(true);
        // Auto-dismiss after 2 seconds if no update occurs
        setTimeout(() => setIsRefreshing(false), 2000);
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
  }, [isRefreshing]);

  useEffect(() => {
    // Initial fetch
    fetchData(false);
    
    // Start polling
    startPolling();
    
    // Register this component for synchronized refreshes
    const unregister = registerRefreshListener(() => {
      console.log("LMEAluminium received refresh signal");
      fetchData(true);
    });
    
    // Force sync current data to other components if we have it
    if (spotPriceData.spotPrice > 0) {
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
  }, [registerRefreshListener, forceSync, spotPriceData.spotPrice]);

  // Add visibility change listener to pause/resume polling when tab is hidden/visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab is active again, refresh data and restart polling
        fetchData(false);
        startPolling();
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
  }, []);

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
          {!loading && timestamp && (
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
        title="LME Aluminium"
        subtitle="Spot Price"
        componentType="LMEAluminium"
      >
        {renderExpandedContent()}
      </ExpandedModalWrapper>
    );
  }

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

