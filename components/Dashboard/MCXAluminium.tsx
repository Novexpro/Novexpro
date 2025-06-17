import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Maximize2,
  RefreshCw,
  BarChart2,
  LineChart,
} from "lucide-react";
import { format} from "date-fns";
import { useExpandedComponents } from "../../context/ExpandedComponentsContext";
import ExpandedModalWrapper from "./ExpandedModalWrapper";

// Declare global window interface extension
declare global {
  interface Window {
    sharedMCXPrice: {
      currentPrice: number | null;
      lastUpdated: string | null;
      change: number | null;
      changePercent: number | null;
      source: string | null;
    };
  }
}

// Update shared MCX price data in the window object
const updateSharedMCXPrice = (
  price: number, 
  lastUpdated: string, 
  change: number, 
  changePercent: number
) => {
  if (typeof window !== 'undefined' && window.hasOwnProperty('sharedMCXPrice')) {
    window.sharedMCXPrice.currentPrice = price;
    window.sharedMCXPrice.lastUpdated = lastUpdated;
    window.sharedMCXPrice.change = change;
    window.sharedMCXPrice.changePercent = changePercent;
    window.sharedMCXPrice.source = 'dashboard';
    
    console.log('Updated shared MCX price data:', window.sharedMCXPrice);
  }
};

interface AluminiumData {
  id: string;
  timestamp: string;
  month1Label: string;
  month1Price: number;
  month1RateVal: number;
  month1RatePct: number;
  month2Label: string;
  month2Price: number;
  month2RateVal: number;
  month2RatePct: number;
  month3Label: string;
  month3Price: number;
  month3RateVal: number;
  month3RatePct: number;
  createdAt: string;
}

interface MonthData {
  label: string;
  price: number;
  rateVal: number;
  ratePct: number;
  colorClass?: string;
  textClass?: string;
  gradient: string;
  order: number;
}

interface MCXAluminiumProps {
  expanded?: boolean;
}

// Define month order mapping for sorting
const MONTH_ORDER = {
  'January': 1,
  'February': 2,
  'March': 3,
  'April': 4,
  'May': 5,
  'June': 6,
  'July': 7,
  'August': 8,
  'September': 9,
  'October': 10,
  'November': 11,
  'December': 12
};

const MCXAluminium = ({ expanded = false }: MCXAluminiumProps) => {
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [data, setData] = useState<AluminiumData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addExpandedComponent } = useExpandedComponents();

  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/3_month_mcx?action=view&limit=1');
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to fetch data');
      }
      
      const result = await res.json();
      
      if (result.success && result.data?.length > 0) {
        const rawData = result.data[0];
        const processedData: AluminiumData = {
          ...rawData,
          month1Price: parseFloat(rawData.month1Price),
          month2Price: parseFloat(rawData.month2Price),
          month3Price: parseFloat(rawData.month3Price),
          month1RateVal: parseFloat(rawData.month1RateVal),
          month2RateVal: parseFloat(rawData.month2RateVal),
          month3RateVal: parseFloat(rawData.month3RateVal),
          month1RatePct: parseFloat(rawData.month1RatePct),
          month2RatePct: parseFloat(rawData.month2RatePct),
          month3RatePct: parseFloat(rawData.month3RatePct),
        };
        setData(processedData);
        setError(null);
        
        // Update shared MCX price data for other components to use
        updateSharedMCXPrice(
          processedData.month1Price,
          processedData.timestamp, 
          processedData.month1RateVal, 
          processedData.month1RatePct
        );
      } else {
        throw new Error('No data available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    // Helper function to check operating hours
    const isWithinOperatingHours = () => {
      const now = new Date();
      const istTime = new Date(now.toLocaleString("en-US", { timeZone: 'Asia/Kolkata' }));
      const currentHour = istTime.getHours();
      const currentDay = istTime.getDay();
      
      if (currentDay === 0 || currentDay === 6) return false; // Weekend
      if (currentHour < 6 || currentHour >= 24) return false; // Off-hours
      return true;
    };
    
    // Enhanced fetchData with time restrictions
    const fetchDataIfAllowed = async () => {
      if (isWithinOperatingHours()) {
        await fetchData();
      } else {
        console.log('⏰ MCXAluminium: Skipping fetch during off-hours');
      }
    };
    
    // Initial fetch
    fetchDataIfAllowed();
    
    // Dynamic interval based on operating hours
    const scheduleNext = () => {
      const interval = isWithinOperatingHours() ? 60000 : 300000; // 1 min vs 5 min
      const timeoutId = setTimeout(() => {
        fetchDataIfAllowed();
        scheduleNext();
      }, interval);
      return timeoutId;
    };
    
    const timeoutId = scheduleNext();
    return () => clearTimeout(timeoutId);
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

  // Sort month data in chronological order
  const getSortedMonthData = (): MonthData[] => {
    if (!data) return [];

    const monthsData: MonthData[] = [
      {
        label: data.month1Label,
        price: data.month1Price,
        rateVal: data.month1RateVal,
        ratePct: data.month1RatePct,
        colorClass: "bg-blue-50 border-blue-100",
        textClass: "text-blue-800",
        gradient: "from-blue-600 to-purple-600",
        order: 0
      },
      {
        label: data.month2Label,
        price: data.month2Price,
        rateVal: data.month2RateVal,
        ratePct: data.month2RatePct,
        colorClass: "bg-purple-50 border-purple-100",
        textClass: "text-purple-800",
        gradient: "from-purple-600 to-pink-600",
        order: 0
      },
      {
        label: data.month3Label,
        price: data.month3Price,
        rateVal: data.month3RateVal,
        ratePct: data.month3RatePct,
        colorClass: "bg-pink-50 border-pink-100",
        textClass: "text-pink-800",
        gradient: "from-pink-600 to-rose-600",
        order: 0
      }
    ];

    // Get the month order for each month
    monthsData.forEach(month => {
      const monthName = month.label.split(" ")[0];
      month.order = MONTH_ORDER[monthName as keyof typeof MONTH_ORDER] || 0;
    });

    // Sort by month chronologically
    return monthsData.sort((a, b) => a.order - b.order);
  };

  // Calculate spread between current month and next month
  const getSpreadData = () => {
    if (!data) {
      return { 
        spread: 0, 
        isContango: false
      };
    }
    
    // Calculate the spread between next month (month2) and current month (month1)
    const spread = data.month2Price - data.month1Price;
    
    // If spread is positive, it's contango (month2 price > month1 price)
    // If spread is negative, it's backwardation (month2 price < month1 price)
    return { 
      spread: spread,
      isContango: spread > 0
    };
  };

  const { spread, isContango } = getSpreadData();

  // Helper function to format price change
  const formatChange = (rateVal: number, ratePct: number): string => {
    return `${rateVal.toFixed(2)} (${ratePct.toFixed(2)}%)`;
  };

  // Handle add component selection
  const handleAddComponent = (componentType: 'LMEAluminium' | 'MonthPrice' | 'RatesDisplay') => {
    addExpandedComponent(componentType);
    setShowAddOptions(false);
  };

  interface ContractPriceProps {
    label: string;
    price: number;
    rateVal: number;
    ratePct: number;
    gradient: string;
    showDivider?: boolean;
  }

  const ContractPrice = ({
    label,
    price,
    rateVal,
    ratePct,
    gradient,
    showDivider = true,
  }: ContractPriceProps) => {
    const displayMonth = label.split(" ")[0];
    const isPositive = ratePct >= 0;

    return (
      <div className="flex-1 flex items-center">
        <div className="w-full">
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-600 flex items-center gap-1 mb-1 h-4">
              <Calendar
                className={`w-3 h-3 ${
                  gradient.includes("blue")
                    ? "text-blue-600"
                    : gradient.includes("purple")
                    ? "text-purple-600"
                    : "text-pink-600"
                }`}
              />
              <span className="font-bold text-sm leading-none tracking-tight">{displayMonth}</span>
            </div>
            <div className="flex flex-col items-center">
              <div className={`font-mono font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent text-3xl mb-1`}>
                ₹{price.toFixed(2)}
              </div>
              <div className={`flex items-center gap-1 h-4 ${isPositive ? "text-green-600" : "text-red-600"}`}>
                {isPositive ? 
                  <TrendingUp className="w-3 h-3" /> : 
                  <TrendingDown className="w-3 h-3" />
                }
                <span className="text-xs">
                  {rateVal.toFixed(2)} ({ratePct.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
        {showDivider && (
          <div className="h-12 w-0.5 bg-gradient-to-b from-transparent via-gray-400 to-transparent mx-1 font-bold" />
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="bg-white rounded-lg p-3 border border-red-200 shadow-sm min-h-[160px]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-red-600">MCX Aluminium</h2>
          <button
            onClick={fetchData}
            className="p-1 hover:bg-gray-100 rounded-full text-gray-600"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm min-h-[190px] flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-blue-600 flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5 text-purple-600" />
            MCX Aluminium
          </h2>
          <div className="animate-spin">
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>
        
        {/* Loading skeleton */}
        <div className="flex flex-col flex-1 py-1.5">
          <div className="sm:hidden flex flex-col space-y-4 mb-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="h-4 w-16 bg-gray-200 animate-pulse rounded mb-1.5"></div>
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded mb-1.5"></div>
                <div className="h-4 w-20 bg-gray-200 animate-pulse rounded"></div>
              </div>
            ))}
          </div>
          
          <div className="hidden sm:flex items-center my-2 space-x-2 flex-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="h-4 w-16 bg-gray-200 animate-pulse rounded mb-1.5"></div>
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded mb-1.5"></div>
                <div className="h-4 w-20 bg-gray-200 animate-pulse rounded"></div>
              </div>
            ))}
          </div>
          
          <div className="text-center py-1 px-2 mt-auto rounded bg-gray-100 border border-gray-200">
            <div className="flex items-center justify-center gap-1.5">
              <div className="h-4 w-20 bg-gray-200 animate-pulse rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Get the sorted month data
  const sortedMonthData = getSortedMonthData();

  // Expanded modal content
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
            onClick={fetchData}
            className="p-1 bg-gray-100 hover:bg-gray-200 rounded-full"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {sortedMonthData.map((item, index) => (
          <div key={index} className={`${item.colorClass} rounded-lg p-3 border`}>
            <div className="flex items-center gap-1 mb-1.5">
              <Calendar className="w-3 h-3" />
              <h3 className={`text-xs font-medium ${item.textClass}`}>{item.label}</h3>
            </div>
            <div className={`font-mono font-bold text-3xl bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>₹{item.price.toFixed(2)}</div>
            <div className={`flex items-center gap-1 mt-1 ${item.ratePct >= 0 ? "text-green-600" : "text-red-600"}`}>
              {item.ratePct >= 0 ? 
                <TrendingUp className="w-3 h-3" /> : 
                <TrendingDown className="w-3 h-3" />
              }
              <span className="text-xs">{formatChange(item.rateVal, item.ratePct)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={`text-center py-1 px-2 mt-auto rounded ${
        isContango
          ? "bg-green-100 border border-green-200 text-green-800"
          : "bg-red-100 border border-red-200 text-red-800"
      }`}>
        <div className="flex items-center justify-center gap-1.5 text-xs">
          <span>{isContango ? "CONTANGO" : "BACKWARDATION"}</span>
          <span>₹{Math.abs(spread).toFixed(2)}</span>
          {isContango ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <div className="flex items-center gap-1.5 text-blue-700 mb-2">
          <LineChart className="w-3.5 h-3.5" />
          <h3 className="text-sm font-medium">Market Insight</h3>
        </div>
        
        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            The futures market is currently in <span className={isContango ? "text-green-700" : "text-red-700"}>
              {isContango ? "contango" : "backwardation"}
            </span>, 
            with {isContango ? "later contracts trading at higher prices" : "current month trading at higher prices than future months"}.
          </p>
          
          <p className="text-xs text-gray-600">
            {isContango 
              ? "In a contango market, investors are willing to pay a premium for future delivery, indicating expectations of higher prices down the line."
              : "In a backwardation market, the current demand exceeds future demand, suggesting potential supply constraints or high immediate demand."}
          </p>
          
          <div className="text-xs text-gray-500 mt-2 flex items-center justify-between">
            <span>Last updated: {format(lastUpdated, "HH:mm:ss")}</span>
            <span>MCX India</span>
          </div>
        </div>
      </div>
    </>
  );

  // If expanded prop is true, render just the expanded content
  if (expanded) {
    return (
      <ExpandedModalWrapper
        title="MCX Aluminium"
        subtitle="Near Month Futures"
        componentType="MCXAluminium"
      >
        {renderExpandedContent()}
      </ExpandedModalWrapper>
    );
  }

  return (
    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-200 min-h-[190px] relative">
      <div className="flex items-center justify-between mb-1 relative z-10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <BarChart2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-blue-600">MCX Aluminium</h2>
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-semibold leading-none">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
              <span>LIVE</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchData}
            className="p-1 hover:bg-gray-100 rounded-full text-gray-600"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => addExpandedComponent('MCXAluminium')}
            className="p-1 hover:bg-gray-100 rounded-full text-gray-600"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 py-1.5">
        {/* Mobile: Vertical layout */}
        <div className="sm:hidden flex flex-col space-y-2.5 mb-2">
          {sortedMonthData.map((month, index) => (
            <ContractPrice
              key={index}
              label={month.label}
              price={month.price}
              rateVal={month.rateVal}
              ratePct={month.ratePct}
              gradient={month.gradient}
              showDivider={false}
            />
          ))}
        </div>

        {/* Desktop: Horizontal layout */}
        <div className="hidden sm:flex items-center my-2">
          {sortedMonthData.map((month, index) => (
            <ContractPrice
              key={index}
              label={month.label}
              price={month.price}
              rateVal={month.rateVal}
              ratePct={month.ratePct}
              gradient={month.gradient}
              showDivider={index < sortedMonthData.length - 1}
            />
          ))}
        </div>

        {/* Add extra space before contango section */}
        <div className="py-1.5"></div>

        {/* Contango section */}
        <div className={`text-center py-1 px-2 mt-auto rounded ${
          isContango 
            ? "bg-green-100 border border-green-200 text-green-800" 
            : "bg-red-100 border border-red-200 text-red-800"
        }`}>
          <div className="flex items-center justify-center gap-1.5 text-xs">
            <span>{isContango ? "CONTANGO" : "BACKWARDATION"}</span>
            <span>₹{Math.abs(spread).toFixed(2)}</span>
            {isContango ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCXAluminium;
