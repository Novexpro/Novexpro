'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine
} from 'recharts';

// Interface for month names response
interface MonthNamesResponse {
  success: boolean;
  data?: {
    currentMonth: string;
    nextMonth: string;
    thirdMonth: string;
  };
  message?: string;
}

// Interface for LME API response
interface LMEResponse {
  success: boolean;
  data: Array<{
    time: string;
    value: number;
  }>;
  lastUpdated: string;
  message?: string;
}

// Interface for MCX API responses
interface MCXResponse {
  success: boolean;
  currentMonth?: string;
  nextMonth?: string;
  thirdMonth?: string;
  data: Array<{
    date: string;
    value: number;
    timestamp: string;
  }>;
  stats: {
    count: number;
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    startPrice: number;
    endPrice: number;
    totalChange: number;
    totalChangePercent: number;
  };
  lastUpdated: string;
  message?: string;
}

// Interface for our combined chart data
interface ChartDataPoint {
  date: string;
  displayDate: string;
  displayTime?: string;
  lme?: number;
  mcxCurrent?: number;
  mcxNext?: number;
  mcxThird?: number;
  // Scaled values for visualization
  mcxCurrentScaled?: number;
  mcxNextScaled?: number;
  mcxThirdScaled?: number;
}

// Arrow icons for change indicators
const ArrowUpIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042-.815a.75.75 0 01-.53-.919z" clipRule="evenodd" />
  </svg>
);

const ArrowDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M1.22 5.222a.75.75 0 011.06 0L7 9.94l3.172-3.172a.75.75 0 011.06 0l2.124 2.123a.75.75 0 010 1.06L8.53 14.78a.75.75 0 01-1.06 0L1.22 8.53a.75.75 0 010-1.06l.952-.952a.75.75 0 010-1.06L1.22 5.222z" clipRule="evenodd" />
  </svg>
);

// Define proper tooltip props type
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    color?: string;
    dataKey?: string;
    name?: string;
    payload?: {
      [key: string]: any;
      date: string;
      displayDate: string;
      displayTime?: string;
    };
  }>;
  label?: string;
}

export default function LMEVsMCX() {
  // Track which lines are visible with a state object
  const [visibleLines, setVisibleLines] = useState({
    lme: true,
    mcxCurrent: true,
    mcxNext: false,
    mcxThird: false
  });
  
  // State for month names
  const [monthNames, setMonthNames] = useState({
    currentMonth: 'MCX Current',
    nextMonth: 'MCX Next',
    thirdMonth: 'MCX Third'
  });
  
  // State for API data
  const [lmeData, setLmeData] = useState<LMEResponse['data']>([]);
  const [mcxCurrentData, setMcxCurrentData] = useState<MCXResponse['data']>([]);
  const [mcxNextData, setMcxNextData] = useState<MCXResponse['data']>([]);
  const [mcxThirdData, setMcxThirdData] = useState<MCXResponse['data']>([]);
  
  // Stats and price info
  const [stats, setStats] = useState({
    lme: {
      price: 0,
      change: 0,
      percentChange: 0,
    },
    mcxCurrent: {
      price: 0,
      change: 0,
      percentChange: 0,
    },
    mcxNext: {
      price: 0,
      change: 0,
      percentChange: 0,
    },
    mcxThird: {
      price: 0,
      change: 0,
      percentChange: 0,
    }
  });
  
  // Hover state for tooltips
  const [hoveredValue, setHoveredValue] = useState<Record<string, number>>({});
  
  // Combined chart data
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  
  // Loading and error states
  const [loading, setLoading] = useState({
    names: true,
    lme: true,
    mcxCurrent: true,
    mcxNext: true,
    mcxThird: true
  });
  const [error, setError] = useState<string | null>(null);
  
  // MCX price scale factor to align with LME for visualization
  const mcxScaleFactor = 0.012;
  
  // Fetch month names on component mount
  useEffect(() => {
    const fetchMonthNames = async () => {
      try {
        setLoading(prev => ({ ...prev, names: true }));
        const response = await fetch('/api/mcx_month_names');
        
        if (!response.ok) {
          throw new Error('Failed to fetch month names');
        }
        
        const data: MonthNamesResponse = await response.json();
        
        if (data.success && data.data) {
          setMonthNames({
            currentMonth: data.data.currentMonth,
            nextMonth: data.data.nextMonth,
            thirdMonth: data.data.thirdMonth
          });
        } else {
          throw new Error(data.message || 'Invalid data format');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch month names';
        setError(errorMessage);
        console.error('Error fetching month names:', err);
      } finally {
        setLoading(prev => ({ ...prev, names: false }));
      }
    };
    
    fetchMonthNames();
  }, []);
  
  // Fetch LME data - update to only fetch today's data
  useEffect(() => {
    const fetchLmeData = async () => {
      try {
        setLoading(prev => ({ ...prev, lme: true }));
        
        // Get today's date in Indian timezone
        const today = new Date();
        const indianDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const startOfDay = new Date(indianDate.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(indianDate.setHours(23, 59, 59, 999)).toISOString();
        
        // Add date range parameters to the API call
        const cacheBuster = new Date().getTime();
        const response = await fetch(`/api/trends_lme?startDate=${startOfDay}&endDate=${endOfDay}&cacheBust=${cacheBuster}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch LME data');
        }
        
        const data: LMEResponse = await response.json();
        
        if (data.success) {
          console.log('Raw LME data:', data.data);
          console.log('Number of LME data points:', data.data.length);
          
          setLmeData(data.data);
          
          // Calculate stats if data exists
          if (data.data.length > 0) {
            const firstPrice = data.data[0].value;
            const lastPrice = data.data[data.data.length - 1].value;
            const change = lastPrice - firstPrice;
            const percentChange = (change / firstPrice) * 100;
            
            setStats(prev => ({
              ...prev,
              lme: {
                price: lastPrice,
                change: change,
                percentChange: percentChange
              }
            }));
          }
        } else {
          throw new Error(data.message || 'Invalid LME data format');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch LME data';
        setError(prev => prev ? `${prev}. ${errorMessage}` : errorMessage);
        console.error('Error fetching LME data:', err);
      } finally {
        setLoading(prev => ({ ...prev, lme: false }));
      }
    };
    
    fetchLmeData();
    
    // Set up refresh interval (every 2 minutes)
    const intervalId = setInterval(fetchLmeData, 2 * 60 * 1000);
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);
  
  // Fetch MCX Current Month data
  useEffect(() => {
    const fetchMcxCurrentData = async () => {
      try {
        setLoading(prev => ({ ...prev, mcxCurrent: true }));
        
        // Get today's date in Indian timezone (same as MCXMonthlyTrends)
        const today = new Date();
        const indianDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const startOfDay = new Date(indianDate.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(indianDate.setHours(23, 59, 59, 999)).toISOString();
        
        const response = await fetch(`/api/mcx_current_month?startDate=${startOfDay}&endDate=${endOfDay}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch MCX current month data');
        }
        
        const data: MCXResponse = await response.json();
        
        if (data.success) {
          console.log('Raw MCX Current Month data:', data.data);
          console.log('Number of MCX Current Month data points:', data.data.length);
          
          setMcxCurrentData(data.data);
          
          // Update stats with API-provided stats
          if (data.stats) {
            setStats(prev => ({
              ...prev,
              mcxCurrent: {
                price: data.stats.endPrice,
                change: data.stats.totalChange,
                percentChange: data.stats.totalChangePercent
              }
            }));
          }
        } else {
          throw new Error(data.message || 'Invalid MCX current month data format');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch MCX current month data';
        setError(prev => prev ? `${prev}. ${errorMessage}` : errorMessage);
        console.error('Error fetching MCX current month data:', err);
      } finally {
        setLoading(prev => ({ ...prev, mcxCurrent: false }));
      }
    };
    
    fetchMcxCurrentData();
  }, []);
  
  // Fetch MCX Next Month data
  useEffect(() => {
    const fetchMcxNextData = async () => {
      try {
        setLoading(prev => ({ ...prev, mcxNext: true }));
        
        // Get today's date in Indian timezone (same as MCXMonthlyTrends)
        const today = new Date();
        const indianDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const startOfDay = new Date(indianDate.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(indianDate.setHours(23, 59, 59, 999)).toISOString();
        
        const response = await fetch(`/api/mcx_next_month?startDate=${startOfDay}&endDate=${endOfDay}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch MCX next month data');
        }
        
        const data: MCXResponse = await response.json();
        
        if (data.success) {
          console.log('Raw MCX Next Month data:', data.data);
          console.log('Number of MCX Next Month data points:', data.data.length);
          
          setMcxNextData(data.data);
          
          // Update stats with API-provided stats
          if (data.stats) {
            setStats(prev => ({
              ...prev,
              mcxNext: {
                price: data.stats.endPrice,
                change: data.stats.totalChange,
                percentChange: data.stats.totalChangePercent
              }
            }));
          }
        } else {
          throw new Error(data.message || 'Invalid MCX next month data format');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch MCX next month data';
        setError(prev => prev ? `${prev}. ${errorMessage}` : errorMessage);
        console.error('Error fetching MCX next month data:', err);
      } finally {
        setLoading(prev => ({ ...prev, mcxNext: false }));
      }
    };
    
    fetchMcxNextData();
  }, []);
  
  // Fetch MCX Third Month data
  useEffect(() => {
    const fetchMcxThirdData = async () => {
      try {
        setLoading(prev => ({ ...prev, mcxThird: true }));
        
        // Get today's date in Indian timezone (same as MCXMonthlyTrends)
        const today = new Date();
        const indianDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const startOfDay = new Date(indianDate.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(indianDate.setHours(23, 59, 59, 999)).toISOString();
        
        const response = await fetch(`/api/mcx_third_month?startDate=${startOfDay}&endDate=${endOfDay}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch MCX third month data');
        }
        
        const data: MCXResponse = await response.json();
        
        if (data.success) {
          console.log('Raw MCX Third Month data:', data.data);
          console.log('Number of MCX Third Month data points:', data.data.length);
          
          setMcxThirdData(data.data);
          
          // Update stats with API-provided stats
          if (data.stats) {
            setStats(prev => ({
              ...prev,
              mcxThird: {
                price: data.stats.endPrice,
                change: data.stats.totalChange,
                percentChange: data.stats.totalChangePercent
              }
            }));
          }
        } else {
          throw new Error(data.message || 'Invalid MCX third month data format');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch MCX third month data';
        setError(prev => prev ? `${prev}. ${errorMessage}` : errorMessage);
        console.error('Error fetching MCX third month data:', err);
      } finally {
        setLoading(prev => ({ ...prev, mcxThird: false }));
      }
    };
    
    fetchMcxThirdData();
  }, []);
  
  // Combine all data into a unified dataset for the chart
  useEffect(() => {
    if (loading.lme || loading.mcxCurrent || loading.mcxNext || loading.mcxThird) {
      return; // Wait until all data is loaded
    }
    
    // Get today's date for filtering
    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`Only showing data for today: ${todayDateString}`);
    
    // Create a map of dates to data points
    const dataMap = new Map<string, ChartDataPoint>();
    
    // Helper function to check if a date is from today
    const isToday = (dateString: string) => {
      try {
        const date = new Date(dateString);
        const dateOnly = date.toISOString().split('T')[0];
        return dateOnly === todayDateString;
      } catch (e) {
        console.error(`Error checking date ${dateString}:`, e);
        return false;
      }
    };
    
    // Helper function to extract time from timestamp (HH:MM:SS) - same as MCXMonthlyTrends
    const extractTimeFromTimestamp = (timestamp: string): string => {
      try {
        // Extract time from timestamp (HH:MM:SS) - exactly like in MCXMonthlyTrends
        return timestamp.split('T')[1].split('.')[0];
      } catch (e) {
        console.error(`Error extracting time from timestamp ${timestamp}:`, e);
        return '';
      }
    };
    
    // Helper function to standardize dates - improved to handle various formats
    const formatDate = (dateString: string) => {
      try {
        // First try to parse as ISO string - extract timestamp for comparison
        const date = new Date(dateString);
        return date.toISOString();
      } catch (e) {
        console.error(`Error formatting date ${dateString}:`, e);
        return dateString; // Return as-is if parsing fails
      }
    };
    
    console.log(`Processing ${lmeData.length} LME data points`);
    console.log(`Processing ${mcxCurrentData.length} MCX Current data points`);
    console.log(`Processing ${mcxNextData.length} MCX Next data points`);
    console.log(`Processing ${mcxThirdData.length} MCX Third data points`);
    
    // Process LME data - only today's data
    lmeData.forEach(item => {
      // Skip if not today's data
      if (!isToday(item.time)) {
        return;
      }
      
      const date = formatDate(item.time);
      const displayTime = extractTimeFromTimestamp(item.time);
      
      if (!dataMap.has(date)) {
        dataMap.set(date, { 
          date: date,
          displayDate: displayTime,
          displayTime: displayTime
        });
      }
      
      const dataPoint = dataMap.get(date)!;
      dataPoint.lme = item.value;
    });
    
    // Process MCX Current Month data - only today's data
    mcxCurrentData.forEach(item => {
      try {
        // Use timestamp if available, fallback to date
        const dateField = item.timestamp || item.date;
        if (!dateField) {
          console.error('MCX Current data point missing date/timestamp:', item);
          return;
        }
        
        // Skip if not today's data
        if (!isToday(dateField)) {
          return;
        }
        
        const date = formatDate(dateField);
        const displayTime = extractTimeFromTimestamp(dateField);
        
        if (!dataMap.has(date)) {
          dataMap.set(date, { 
            date: date,
            displayDate: displayTime,
            displayTime: displayTime
          });
        }
        
        const dataPoint = dataMap.get(date)!;
        const value = typeof item.value === 'number' ? item.value : parseFloat(String(item.value));
        if (!isNaN(value)) {
          dataPoint.mcxCurrent = value;
          dataPoint.mcxCurrentScaled = value * mcxScaleFactor;
        } else {
          console.error('Invalid MCX Current value:', item.value);
        }
      } catch (err) {
        console.error("Error processing MCX Current data point:", err, item);
      }
    });
    
    // Process MCX Next Month data - only today's data
    mcxNextData.forEach(item => {
      try {
        // Use timestamp if available, fallback to date
        const dateField = item.timestamp || item.date;
        if (!dateField) {
          console.error('MCX Next data point missing date/timestamp:', item);
          return;
        }
        
        // Skip if not today's data
        if (!isToday(dateField)) {
          return;
        }
        
        const date = formatDate(dateField);
        const displayTime = extractTimeFromTimestamp(dateField);
        
        if (!dataMap.has(date)) {
          dataMap.set(date, { 
            date: date,
            displayDate: displayTime,
            displayTime: displayTime
          });
        }
        
        const dataPoint = dataMap.get(date)!;
        const value = typeof item.value === 'number' ? item.value : parseFloat(String(item.value));
        if (!isNaN(value)) {
          dataPoint.mcxNext = value;
          dataPoint.mcxNextScaled = value * mcxScaleFactor;
        } else {
          console.error('Invalid MCX Next value:', item.value);
        }
      } catch (err) {
        console.error("Error processing MCX Next data point:", err, item);
      }
    });
    
    // Process MCX Third Month data - only today's data
    mcxThirdData.forEach(item => {
      try {
        // Use timestamp if available, fallback to date
        const dateField = item.timestamp || item.date;
        if (!dateField) {
          console.error('MCX Third data point missing date/timestamp:', item);
          return;
        }
        
        // Skip if not today's data
        if (!isToday(dateField)) {
          return;
        }
        
        const date = formatDate(dateField);
        const displayTime = extractTimeFromTimestamp(dateField);
        
        if (!dataMap.has(date)) {
          dataMap.set(date, { 
            date: date,
            displayDate: displayTime,
            displayTime: displayTime
          });
        }
        
        const dataPoint = dataMap.get(date)!;
        const value = typeof item.value === 'number' ? item.value : parseFloat(String(item.value));
        if (!isNaN(value)) {
          dataPoint.mcxThird = value;
          dataPoint.mcxThirdScaled = value * mcxScaleFactor;
        } else {
          console.error('Invalid MCX Third value:', item.value);
        }
      } catch (err) {
        console.error("Error processing MCX Third data point:", err, item);
      }
    });

    // Convert map to array and sort by date
    const combinedData = Array.from(dataMap.values()).sort((a, b) => {
      try {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } catch (e) {
        console.error(`Error sorting dates ${a.date} and ${b.date}:`, e);
        return 0;
      }
    });
    
    console.log(`Combined data has ${combinedData.length} data points for today`);
    console.log("Data summary:", {
      withLME: combinedData.filter(d => d.lme !== undefined).length,
      withMCXCurrent: combinedData.filter(d => d.mcxCurrent !== undefined).length,
      withMCXNext: combinedData.filter(d => d.mcxNext !== undefined).length,
      withMCXThird: combinedData.filter(d => d.mcxThird !== undefined).length
    });
    
    // Add warning if no data is found for today
    if (combinedData.length === 0) {
      console.warn("No data points found for today. Check if the APIs are returning today's data.");
    }
    
    setChartData(combinedData);
  }, [lmeData, mcxCurrentData, mcxNextData, mcxThirdData, loading, mcxScaleFactor]);
  
  // Toggle visibility of a line
  const toggleLine = (line: 'lme' | 'mcxCurrent' | 'mcxNext' | 'mcxThird') => {
    if (line === 'lme') {
      // LME toggle works independently
      setVisibleLines(prev => ({
        ...prev,
        lme: !prev.lme
      }));
    } else {
      // For MCX lines, only allow one to be active at a time
      setVisibleLines(prev => ({
        ...prev,
        mcxCurrent: line === 'mcxCurrent',
        mcxNext: line === 'mcxNext',
        mcxThird: line === 'mcxThird'
      }));
    }
  };

  // Custom tooltip to match MCXMonthlyTrends
  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      // Get the formatted date directly from the payload's displayTime if available
      const displayTime = payload[0]?.payload?.displayTime;
      
      // As fallback, format the date from label
      let formattedTime = '';
      
      if (displayTime) {
          // Use the pre-calculated display time if available
          formattedTime = displayTime;
      } else {
          // Fallback to formatting from timestamp or label - same as in MCXMonthlyTrends
          const date = payload[0]?.payload?.timestamp 
              ? new Date(payload[0].payload.timestamp)
              : label ? new Date(label) : new Date();
              
          formattedTime = date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
          });
      }
      
      // Get value from the first active datapoint
      let value = 0;
      let symbol = '';
      
      // Determine which series is active
      if (payload[0]?.dataKey?.includes('Scaled')) {
        const baseName = payload[0].dataKey.replace('Scaled', '');
        const originalValue = payload.find((p) => p?.dataKey === baseName)?.value;
        value = originalValue || (payload[0]?.value || 0) / mcxScaleFactor;
        symbol = '₹';
      } else if (payload[0]?.dataKey === 'lme') {
        value = payload[0]?.value || 0;
        symbol = '$';
      }
      
      return (
        <div className="bg-white p-4 border border-gray-100 rounded-lg shadow-lg">
          <p className="text-xs font-medium text-gray-500">{formattedTime}</p>
          <div className="flex items-center mt-1">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 mr-2"></div>
            <p className="text-lg font-bold text-gray-800">{symbol}{value.toFixed(2)}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Check if all data is still loading
  const isLoading = loading.names || loading.lme || loading.mcxCurrent || loading.mcxNext || loading.mcxThird;

  return (
    <div className="w-full p-6 bg-gray-50 rounded-2xl mt-8">
      <div className="flex flex-col space-y-6">
        {/* Title and buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
            <h2 className="text-xl font-bold text-gray-800">LME vs MCX Price Comparison</h2>
          </div>
        </div>
        
        {/* Buttons - Modified to create visual separation between LME and MCX options */}
        <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-lg">
          <button 
            className={`px-4 py-2 text-sm rounded-md transition-all ${
              visibleLines.lme
                ? 'bg-white shadow-sm text-blue-600 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => toggleLine('lme')}
          >
            LME
          </button>
          
          <div className="h-6 w-px bg-gray-300 mx-2"></div>
          
          <div className="flex items-center space-x-2">
            <button 
              className={`px-4 py-2 text-sm rounded-md transition-all ${
                visibleLines.mcxCurrent
                  ? 'bg-white shadow-sm text-green-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => toggleLine('mcxCurrent')}
            >
              {loading.names ? 'Loading...' : monthNames.currentMonth}
            </button>
            <button 
              className={`px-4 py-2 text-sm rounded-md transition-all ${
                visibleLines.mcxNext
                  ? 'bg-white shadow-sm text-orange-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => toggleLine('mcxNext')}
            >
              {loading.names ? 'Loading...' : monthNames.nextMonth}
            </button>
            <button 
              className={`px-4 py-2 text-sm rounded-md transition-all ${
                visibleLines.mcxThird
                  ? 'bg-white shadow-sm text-purple-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => toggleLine('mcxThird')}
            >
              {loading.names ? 'Loading...' : monthNames.thirdMonth}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            Error: {error}
          </div>
        )}

        {/* Chart container - Updated to match MCXMonthlyTrends styling */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
          <div className="h-[400px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                  <p className="text-gray-500">Loading data...</p>
                </div>
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-500">No data available for the selected time period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    {/* LME gradients */}
                    <linearGradient id="lmeLineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={1} />
                      <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="lmeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#60A5FA" stopOpacity={0} />
                    </linearGradient>
                    
                    {/* MCX Current gradients */}
                    <linearGradient id="mcxCurrentLineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={1} />
                      <stop offset="95%" stopColor="#34D399" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="mcxCurrentAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D1FAE5" stopOpacity={0} />
                    </linearGradient>
                    
                    {/* MCX Next gradients */}
                    <linearGradient id="mcxNextLineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={1} />
                      <stop offset="95%" stopColor="#FB923C" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="mcxNextAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FFEDD5" stopOpacity={0} />
                    </linearGradient>
                    
                    {/* MCX Third gradients */}
                    <linearGradient id="mcxThirdLineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={1} />
                      <stop offset="95%" stopColor="#C084FC" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="mcxThirdAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A855F7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F3E8FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  
                  {/* Y-axis for LME (left side) - matches MCXMonthlyTrends style */}
                  {visibleLines.lme && (
                    <YAxis 
                      yAxisId="left"
                      domain={[
                        stats.lme.price * 0.995, // 0.5% below min
                        stats.lme.price * 1.005  // 0.5% above max
                      ]}
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      tickFormatter={(value) => `$${value.toFixed(0)}`}
                    />
                  )}
                  
                  {/* Y-axis for MCX (right side) - matches MCXMonthlyTrends style */}
                  {visibleLines.mcxCurrent && (
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      domain={[
                        stats.mcxCurrent.price * 0.995, // 0.5% below min
                        stats.mcxCurrent.price * 1.005  // 0.5% above max
                      ]}
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                      tickFormatter={(value) => `₹${(value/mcxScaleFactor).toFixed(0)}`}
                    />
                  )}
                  
                  {visibleLines.mcxNext && (
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      domain={[
                        stats.mcxNext.price * 0.995, // 0.5% below min
                        stats.mcxNext.price * 1.005  // 0.5% above max
                      ]}
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                      tickFormatter={(value) => `₹${(value/mcxScaleFactor).toFixed(0)}`}
                    />
                  )}
                  
                  {visibleLines.mcxThird && (
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      domain={[
                        stats.mcxThird.price * 0.995, // 0.5% below min
                        stats.mcxThird.price * 1.005  // 0.5% above max
                      ]}
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                      axisLine={false}
                      tickLine={false}
                      width={60}
                      tickFormatter={(value) => `₹${(value/mcxScaleFactor).toFixed(0)}`}
                    />
                  )}
                  
                  <Tooltip content={<CustomTooltip />} />
                  
                  {/* Reference Lines for Averages */}
                  {visibleLines.lme && (
                    <ReferenceLine
                      yAxisId="left"
                      y={stats.lme.price}
                      stroke="#9CA3AF"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{
                        value: 'Avg',
                        position: 'right',
                        fill: '#6B7280',
                        fontSize: 10
                      }}
                    />
                  )}
                  
                  {visibleLines.mcxCurrent && (
                    <ReferenceLine
                      yAxisId="right"
                      y={stats.mcxCurrent.price * mcxScaleFactor}
                      stroke="#9CA3AF"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{
                        value: 'Avg',
                        position: 'right',
                        fill: '#6B7280',
                        fontSize: 10
                      }}
                    />
                  )}
                  
                  {visibleLines.mcxNext && (
                    <ReferenceLine
                      yAxisId="right"
                      y={stats.mcxNext.price * mcxScaleFactor}
                      stroke="#9CA3AF"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{
                        value: 'Avg',
                        position: 'right',
                        fill: '#6B7280',
                        fontSize: 10
                      }}
                    />
                  )}
                  
                  {visibleLines.mcxThird && (
                    <ReferenceLine
                      yAxisId="right"
                      y={stats.mcxThird.price * mcxScaleFactor}
                      stroke="#9CA3AF"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      label={{
                        value: 'Avg',
                        position: 'right',
                        fill: '#6B7280',
                        fontSize: 10
                      }}
                    />
                  )}
                  
                  {/* LME Area - matches MCXMonthlyTrends style */}
                  {visibleLines.lme && (
                    <Area
                      yAxisId="left"
                      type="linear"
                      dataKey="lme"
                      name="LME"
                      stroke="url(#lmeLineGradient)"
                      fill="url(#lmeAreaGradient)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      dot={{ 
                        r: 1.5, 
                        fill: '#3B82F6',
                        strokeWidth: 0
                      }}
                      activeDot={{ 
                        r: 6, 
                        strokeWidth: 2,
                        fill: '#fff',
                        stroke: '#3B82F6' 
                      }}
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-in-out"
                      connectNulls={false}
                    />
                  )}
                  
                  {/* MCX Current Month Area - matches MCXMonthlyTrends style */}
                  {visibleLines.mcxCurrent && (
                    <Area
                      yAxisId="right"
                      type="linear"
                      dataKey="mcxCurrentScaled"
                      name={loading.names ? 'MCX Current' : monthNames.currentMonth}
                      stroke="url(#mcxCurrentLineGradient)"
                      fill="url(#mcxCurrentAreaGradient)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      dot={{ 
                        r: 1.5, 
                        fill: '#10B981',
                        strokeWidth: 0
                      }}
                      activeDot={{
                        r: 6,
                        strokeWidth: 2,
                        fill: '#fff',
                        stroke: '#10B981' 
                      }}
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-in-out"
                      connectNulls={false}
                    />
                  )}
                  
                  {/* MCX Next Month Area - matches MCXMonthlyTrends style */}
                  {visibleLines.mcxNext && (
                    <Area
                      yAxisId="right"
                      type="linear"
                      dataKey="mcxNextScaled"
                      name={loading.names ? 'MCX Next' : monthNames.nextMonth}
                      stroke="url(#mcxNextLineGradient)"
                      fill="url(#mcxNextAreaGradient)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      dot={{ 
                        r: 1.5, 
                        fill: '#F97316',
                        strokeWidth: 0
                      }}
                      activeDot={{
                        r: 6,
                        strokeWidth: 2,
                        fill: '#fff',
                        stroke: '#F97316' 
                      }}
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-in-out"
                      connectNulls={false}
                    />
                  )}
                  
                  {/* MCX Third Month Area - matches MCXMonthlyTrends style */}
                  {visibleLines.mcxThird && (
                    <Area
                      yAxisId="right"
                      type="linear"
                      dataKey="mcxThirdScaled"
                      name={loading.names ? 'MCX Third' : monthNames.thirdMonth}
                      stroke="url(#mcxThirdLineGradient)"
                      fill="url(#mcxThirdAreaGradient)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      dot={{ 
                        r: 1.5, 
                        fill: '#A855F7',
                        strokeWidth: 0
                      }}
                      activeDot={{
                        r: 6,
                        strokeWidth: 2,
                        fill: '#fff',
                        stroke: '#A855F7' 
                      }}
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-in-out"
                      connectNulls={false}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 