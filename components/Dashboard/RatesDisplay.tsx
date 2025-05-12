import React, { useState, useEffect, useRef } from "react";
import { Maximize2, RefreshCw, ArrowUpRight, Banknote } from "lucide-react";
import { format } from "date-fns";
import { useExpandedComponents } from "../../context/ExpandedComponentsContext";
import ExpandedModalWrapper from "./ExpandedModalWrapper";

// Add global declaration for window.sharedRates
declare global {
  interface Window {
    sharedRates: {
      RBI: number | null;
      SBI: number | null;
      lastUpdated: string | null;
    };
  }
}

// Update shared rates in the window object
const updateSharedRates = (rbi: number | null, sbi: number | null) => {
  if (typeof window !== 'undefined' && window.hasOwnProperty('sharedRates')) {
    const sharedRates = window.sharedRates as { 
      RBI: number | null, 
      SBI: number | null, 
      lastUpdated: string | null 
    };
    
    if (rbi !== null) sharedRates.RBI = rbi;
    if (sbi !== null) sharedRates.SBI = sbi;
    sharedRates.lastUpdated = new Date().toISOString();
    
    console.log('Updated shared rates:', sharedRates);
  }
};

interface RatesDisplayProps {
  className?: string;
  expanded?: boolean;
}

// Add a safe date formatting utility
const safeFormatDate = (date: Date | string | null | undefined, formatStr: string, fallback = 'N/A'): string => {
  try {
    if (!date) return fallback;
    
    // If it's a string, attempt to parse it correctly
    if (typeof date === 'string') {
      // Try to detect dd-MMM-yyyy format (like "02-May-2025")
      const ddMmmYyyyMatch = date.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
      if (ddMmmYyyyMatch) {
        const day = parseInt(ddMmmYyyyMatch[1]);
        const monthStr = ddMmmYyyyMatch[2];
        const year = parseInt(ddMmmYyyyMatch[3]);
        
        // Convert month name to month number
        const monthMap: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        
        const month = monthMap[monthStr];
        if (month !== undefined && !isNaN(day) && !isNaN(year)) {
          date = new Date(year, month, day);
        } else {
          date = new Date(date);
        }
      } else {
        date = new Date(date);
      }
    }
    
    // Check if date is valid before formatting
    if (isNaN((date as Date).getTime())) {
      return fallback;
    }
    return format(date, formatStr);
  } catch (err) {
    console.error('Error formatting date:', err);
    return fallback;
  }
};

// Add helper to validate dates
const isValidDate = (date: any): boolean => {
  if (!date) return false;
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
};

export default function RatesDisplay({ className = "", expanded = false }: RatesDisplayProps) {
  const [showAddOptions, setShowAddOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => {
    try {
      return new Date(); // Use current date as default
    } catch (e) {
      console.error("Error creating default date:", e);
      // Unix epoch as absolute fallback
      return new Date(0);
    }
  });
  const [rbiRate, setRbiRate] = useState<number | null>(null);
  const [sbiRate, setSbiRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rbiUpdated, setRbiUpdated] = useState<Date>(() => {
    try {
      return new Date(); // Use current date as default
    } catch (e) {
      console.error("Error creating default date:", e);
      // Unix epoch as absolute fallback
      return new Date(0);
    }
  });
  const { addExpandedComponent } = useExpandedComponents();

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

  // Fetch RBI rate from Next.js API (now always from database)
  const fetchRbiRate = async () => {
    try {
      // First, attempt to trigger a background refresh
      const backgroundRefreshPromise = fetch("/api/rbi?backgroundUpdate=true").catch(err => {
        console.warn("Background refresh request failed:", err);
      });
      
      // Then fetch the latest data from database
      const response = await fetch("/api/rbi");
      const result = await response.json();

      console.log("🔍 Response from RBI API:", result);

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch data");
      }

      if (result.data && result.data.length > 0) {
        // Always use the first record which should be the latest one
        const latestRecord = result.data[0];
        console.log("Latest RBI record:", latestRecord);
        
        const rate = parseFloat(latestRecord.rate);
        setRbiRate(rate); // Convert string to number
        
        // Set RBI update date if available in the response
        if (latestRecord.date && isValidDate(latestRecord.date)) {
          console.log("Using date from RBI API response:", latestRecord.date);
          
          // Parse the date string properly (dd-MMM-yyyy format)
          const dateParts = latestRecord.date.split('-');
          if (dateParts.length === 3) {
            try {
              // Convert month name to month number
              const monthMap: { [key: string]: number } = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
              };
              
              const day = parseInt(dateParts[0]);
              const month = monthMap[dateParts[1]] !== undefined ? monthMap[dateParts[1]] : parseInt(dateParts[1]) - 1;
              const year = parseInt(dateParts[2]);
              
              const parsedDate = new Date(year, month, day);
              console.log("Parsed RBI date:", parsedDate);
              
              if (isValidDate(parsedDate)) {
                setRbiUpdated(parsedDate);
              } else {
                console.error("Invalid date after parsing:", parsedDate);
                setRbiUpdated(new Date());
              }
            } catch (err) {
              console.error("Error parsing RBI date:", err);
              setRbiUpdated(new Date());
            }
          } else {
            console.log("Setting RBI date directly from string:", latestRecord.date);
            setRbiUpdated(new Date(latestRecord.date));
          }
        } else {
          console.log("No valid date in RBI API response, using current date");
          setRbiUpdated(new Date());
        }
        
        // Update shared rates
        updateSharedRates(rate, null);
        
        // Clear any previous errors
        setError(null);
      } else {
        throw new Error("No RBI rate data available");
      }
      
      // Wait for background refresh to complete
      await backgroundRefreshPromise;
    } catch (error) {
      console.error("Error fetching RBI rate:", error);
      setError("Failed to fetch RBI rate");
    }
  };

  // Fetch SBI TT rate from Next.js API (now always from database)
  const fetchSbiRate = async () => {
    try {
      // First, attempt to trigger a background refresh
      const backgroundRefreshPromise = fetch("/api/sbitt?backgroundUpdate=true").catch(err => {
        console.warn("Background refresh request failed:", err);
      });
      
      // Then fetch the latest data from database
      const response = await fetch("/api/sbitt");
      
      if (!response.ok) {
        throw new Error("Failed to fetch SBI data");
      }
      
      const result = await response.json();
      
      console.log("🔍 Response from Next.js API:", result);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch SBI data");
      }
      
      if (result.data && result.data.length > 0) {
        const rate = parseFloat(result.data[0].sbi_tt_sell);
        setSbiRate(rate); // Convert string to number
        
        // Set SBI update date if available in the response
        if (result.data[0].timestamp && isValidDate(result.data[0].timestamp)) {
          console.log("Using timestamp from API response:", result.data[0].timestamp);
          setLastUpdated(new Date(result.data[0].timestamp));
        } else {
          console.log("No valid timestamp in API response, using current date");
          setLastUpdated(new Date());
        }
        
        // Update shared rates
        updateSharedRates(null, rate);
        
        // Clear any previous errors
        setError(null);
      } else {
        throw new Error("No SBI rate data available");
      }
      
      // Wait for background refresh to complete
      await backgroundRefreshPromise;
    } catch (error) {
      console.error("🚨 Error fetching SBI rate:", error);
      setError("Failed to fetch SBI rate");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([fetchRbiRate(), fetchSbiRate()]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData(); // Fetch data on mount
    
    // Refresh data every 5 minutes
    const interval = setInterval(() => {
      console.log("Refreshing rates data...");
      fetchData();
    }, 300000); // 5 minutes
    
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setError(null);
    Promise.all([fetchRbiRate(), fetchSbiRate()]).finally(() =>
      setIsRefreshing(false)
    );
  };

  // Handle add component selection
  const handleAddComponent = (componentType: 'LMEAluminium' | 'MonthPrice' | 'MCXAluminium') => {
    addExpandedComponent(componentType);
    setShowAddOptions(false);
  };

  const RateSection = ({ isRBI = true, expanded = false }) => {
    const rate = isRBI ? rbiRate : sbiRate;
    const label = isRBI ? "RBI Rate" : "SBI Rate";
    const updateDate = isRBI ? rbiUpdated : lastUpdated;

    return (
      <div className={expanded ? "space-y-4" : "space-y-2"}>
        <div className="flex items-center justify-between">
          <span
            className={`font-medium text-gray-700 ${
              expanded ? "text-lg" : "text-sm"
            }`}
          >
            {label}
          </span>
          {expanded && (
            <a
              href={isRBI ? "https://www.rbi.org.in" : "https://www.sbi.co.in"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              Source <ArrowUpRight className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="flex items-baseline gap-3">
          <span
            className={`font-mono font-bold bg-gradient-to-r ${
              isRBI
                ? "from-blue-600 to-purple-600"
                : "from-purple-600 to-pink-600"
            } bg-clip-text text-transparent ${
              expanded ? "text-5xl" : "text-3xl"
            }`}
          >
            ₹{rate !== null ? rate.toFixed(4) : "Loading..."}
          </span>
          <span className={`text-gray-500 ${expanded ? "text-sm" : "text-xs"}`}>
            /USD
          </span>
        </div>
        
        {updateDate && (
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <span>Updated: {safeFormatDate(updateDate, "MMM d", "Unknown")}</span>
            </div>
            {error && error.includes("cached") && (
              <div className="text-xs text-yellow-600 flex items-center gap-1">
                <span>⚠️ Using cached data</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Expanded content
  const renderExpandedContent = () => (
    <>
      {isRefreshing ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Refreshing rates...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <Banknote className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">RBI Reference Rate</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-mono font-bold text-3xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ₹{rbiRate !== null ? rbiRate.toFixed(4) : "Loading..."}
                </span>
                <span className="text-gray-500 text-sm">/USD</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {rbiUpdated ? `Updated at: ${safeFormatDate(rbiUpdated, "dd-MMMM-yyyy", "Unknown date")}` : "Updated daily by Reserve Bank of India"}
              </div>
            </div>

            <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100">
              <div className="flex items-center gap-2 mb-3">
                <Banknote className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">SBI TT Selling Rate</span>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-mono font-bold text-3xl bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  ₹{sbiRate !== null ? sbiRate.toFixed(4) : "Loading..."}
                </span>
                <span className="text-gray-500 text-sm">/USD</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                <span>Updated at: {safeFormatDate(lastUpdated, "dd-MMMM-yyyy", "Unknown date")}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3 mb-4">
            <div className="flex items-center gap-1.5 text-blue-700 mb-2">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <h3 className="text-sm font-medium">Market Insight</h3>
            </div>
            
            <div className="space-y-3">
              <p className="text-xs text-gray-600">
                RBI Reference Rate: Official rate published daily at 12:30 PM IST, used as a benchmark for financial transactions and foreign trade.
              </p>
              
              <p className="text-xs text-gray-600">
                SBI TT Rate: The commercial rate that includes bank margins and processing costs. Used for telegraphic transfers and remittances.
              </p>
              
              <p className="text-xs text-gray-600">
                Margin: ₹{(sbiRate && rbiRate) ? (sbiRate - rbiRate).toFixed(4) : "..."} | This spread typically widens during market volatility and narrows in stable periods.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );

  // Display loading state when no data is available
  if (isLoading && !expanded) {
    return (
      <div className={`relative bg-white rounded-xl p-4 border border-gray-100 shadow-[0_4px_12px_rgba(0,0,0,0.05)] min-h-[300px] ${className}`}>
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Banknote className="w-4 h-4 text-purple-600" />
              Exchange Rates
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={true}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Refresh rates"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 animate-spin" />
            </button>
          </div>
        </div>

        <div className="flex flex-col h-[calc(100%-4rem)] relative z-10">
          <div className="flex-1 flex flex-col justify-evenly">
            {/* RBI Rate skeleton */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-20 bg-gray-200 animate-pulse rounded"></div>
              </div>
              <div className="h-9 w-32 bg-gray-200 animate-pulse rounded"></div>
            </div>
            
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-2" />
            
            {/* SBI Rate skeleton */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-20 bg-gray-200 animate-pulse rounded"></div>
              </div>
              <div className="h-9 w-32 bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If expanded prop is true, render just the expanded content
  if (expanded) {
    return (
      <ExpandedModalWrapper
        title="Exchange Rates"
        subtitle="Live Currency Rates"
        componentType="RatesDisplay"
      >
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
                    onClick={() => handleAddComponent('MonthPrice')}
                  >
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    3-Month LME
                  </button>
                  <button 
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-2"
                    onClick={() => handleAddComponent('MCXAluminium')}
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    MCX Aluminium
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500">
              {safeFormatDate(lastUpdated, "HH:mm:ss", "Unknown time")}
            </div>
            <button
              onClick={handleRefresh}
              className="p-1 bg-gray-100 hover:bg-gray-200 rounded-full"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        {isLoading ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
              {/* RBI Rate skeleton */}
              <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  <Banknote className="w-4 h-4 text-blue-600" />
                  <div className="h-5 w-32 bg-gray-200 animate-pulse rounded"></div>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <div className="h-9 w-32 bg-gray-200 animate-pulse rounded"></div>
                  <div className="h-5 w-12 bg-gray-200 animate-pulse rounded"></div>
                </div>
                <div className="h-4 w-44 bg-gray-200 animate-pulse rounded mt-2"></div>
              </div>

              {/* SBI Rate skeleton */}
              <div className="bg-purple-50/50 p-4 rounded-lg border border-purple-100">
                <div className="flex items-center gap-2 mb-3">
                  <Banknote className="w-4 h-4 text-purple-600" />
                  <div className="h-5 w-32 bg-gray-200 animate-pulse rounded"></div>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <div className="h-9 w-32 bg-gray-200 animate-pulse rounded"></div>
                  <div className="h-5 w-12 bg-gray-200 animate-pulse rounded"></div>
                </div>
                <div className="h-4 w-44 bg-gray-200 animate-pulse rounded mt-2"></div>
              </div>
            </div>

            {/* Market Insight skeleton */}
            <div className="border-t border-gray-200 pt-3 mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                <div className="h-5 w-28 bg-gray-200 animate-pulse rounded"></div>
              </div>
              
              <div className="space-y-3">
                <div className="h-3 w-full bg-gray-200 animate-pulse rounded"></div>
                <div className="h-3 w-full bg-gray-200 animate-pulse rounded"></div>
                <div className="h-3 w-3/4 bg-gray-200 animate-pulse rounded"></div>
              </div>
            </div>

            {/* Footer skeleton */}
            <div className="border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-40 bg-gray-200 animate-pulse rounded"></div>
              </div>
            </div>
          </>
        ) : (
          renderExpandedContent()
        )}
      </ExpandedModalWrapper>
    );
  }

  return (
    <>
      <div
        className={`relative bg-white rounded-xl p-4 border border-gray-100 shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-200 min-h-[300px] group ${className}`}
      >
        {/* Removed glow effect */}
        
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
                <Banknote className="w-4 h-4 text-purple-600" />
                Exchange Rates
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Refresh rates"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 ${
                    isRefreshing ? "animate-spin" : ""
                  }`}
                />
              </button>
              <button
                onClick={() => addExpandedComponent('RatesDisplay')}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                aria-label="Expand view"
              >
                <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col justify-between">
            {/* Rates */}
            <div className="flex-1 flex flex-col">
              <div className="mb-8">
                {/* RBI Rate */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700 text-sm">RBI Rate</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent text-3xl">
                      ₹{rbiRate !== null ? rbiRate.toFixed(4) : "Loading..."}
                    </span>
                    <span className="text-gray-500 text-xs">/USD</span>
                  </div>
                  {rbiUpdated && (
                    <div className="flex items-center justify-between w-full">
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <span>Updated at: {safeFormatDate(rbiUpdated, "dd-MMMM-yyyy", "Unknown date")}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                {/* SBI Rate */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700 text-sm">SBI Rate</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent text-3xl">
                      ₹{sbiRate !== null ? sbiRate.toFixed(4) : "Loading..."}
                    </span>
                    <span className="text-gray-500 text-xs">/USD</span>
                  </div>
                  {lastUpdated && (
                    <div className="flex items-center justify-between w-full">
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <span>Updated at: {safeFormatDate(lastUpdated, "dd-MMMM-yyyy", "Unknown date")}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

