'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
  TooltipProps,
} from 'recharts';

interface DataPoint {
  time: string;
  value: number;
  displayTime?: string;
  displayDate?: string;
  source?: string;
}

interface StatsData {
  avgPrice: number;
  totalChange: number;
  totalChangePercent: number;
  count: number;
  minPrice: number;
  maxPrice: number;
  startPrice: number;
  endPrice: number;
}

// API response interfaces
interface ApiResponse {
  data: DataPoint[];
  stats: StatsData;
}

// Static mock data
const generateMockData = (): { data: DataPoint[], stats: StatsData } => {
  const today = new Date();
  today.setHours(9, 0, 0, 0); // Start at 9 AM
  
  const data: DataPoint[] = [];
  
  // Generate data points for every 30 minutes from 9 AM to 11:30 PM
  for (let i = 0; i < 30; i++) {
    const pointTime = new Date(today);
    pointTime.setMinutes(today.getMinutes() + i * 30);
    
    // Stop if we reach 11:30 PM
    if (pointTime.getHours() === 23 && pointTime.getMinutes() > 30) {
      break;
    }
    
    // Generate a somewhat realistic price curve with some volatility
    // Base price around 2500 with some up and down movement
    let baseValue = 2500;
    
    // Add a trend during the day (increasing in morning, decreasing in afternoon)
    const hourOfDay = pointTime.getHours();
    if (hourOfDay < 14) {
      // Morning trend up
      baseValue += (hourOfDay - 9) * 15;
    } else {
      // Afternoon trend slightly down
      baseValue += 75 - (hourOfDay - 14) * 5;
    }
    
    // Add some randomness for realism
    const randomVariation = Math.random() * 40 - 20; // +/- $20
    const value = baseValue + randomVariation;
    
    data.push({
      time: pointTime.toISOString(),
      value: Math.round(value * 100) / 100, // Round to 2 decimal places
      displayTime: pointTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });
  }
  
  // Calculate stats from the generated data
  const prices = data.map(item => item.value);
  const count = prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((sum, val) => sum + val, 0) / count;
  const startPrice = data[0].value;
  const endPrice = data[data.length - 1].value;
  const totalChange = endPrice - startPrice;
  const totalChangePercent = (totalChange / startPrice) * 100;
  
  const stats: StatsData = {
    count,
    minPrice,
    maxPrice,
    avgPrice,
    startPrice,
    endPrice,
    totalChange,
    totalChangePercent,
  };
  
  return { data, stats };
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length > 0) {
    // Get the displayTime from payload - this comes directly from API with UTC time
    const data = payload[0].payload;
    const displayTime = data.displayTime || '';
    
    // Get the value
    const price = data.value !== undefined ? data.value : 0;

    return (
      <div className="bg-white p-4 border border-gray-100 rounded-lg shadow-lg">
        <p className="text-xs font-medium text-gray-500">{displayTime}</p>
        <div className="flex items-center mt-1">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-green-600 mr-2"></div>
          <p className="text-lg font-bold text-gray-800">${price.toFixed(2)}</p>
        </div>
      </div>
    );
  }
  return null;
};

const ChartIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
    />
  </svg>
);

const RefreshIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
);

const TrendIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
    />
  </svg>
);

const LoadingIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="w-6 h-6 animate-spin"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
);

export default function LMETrends() {
  // State for the component
  const [trendData, setTrendData] = useState<DataPoint[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  const [hoveredTime, setHoveredTime] = useState<string | null>(null);

  // Function to get trading session status
  const getTradingStatus = () => {
    const now = new Date();
    const today = new Date(now);
    
    const tradingStart = new Date(today);
    tradingStart.setHours(9, 0, 0, 0);
    
    const tradingEnd = new Date(today);
    tradingEnd.setHours(23, 30, 0, 0);

    const isWithinTradingHours = now >= tradingStart && now <= tradingEnd;
    const isBeforeTradingHours = now < tradingStart;

    return {
      isWithinTradingHours,
      isBeforeTradingHours,
      sessionType: isWithinTradingHours
        ? 'current'
        : isBeforeTradingHours
          ? 'previous'
          : 'today-closed'
    };
  };

  // No need for timezone conversion functions as the API now handles this

  // Function to fetch trend data from API
  const fetchTrendData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/lme-trends');

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to fetch trend data');
        return;
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        setError('No data available');
        return;
      }

      // Filter data to only include points between 9:00 AM and 11:30 PM
      const filteredData = data.data.filter((point: DataPoint) => {
        const date = new Date(point.time);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        
        // If it's the end hour (23), only include up to the specified minute (30)
        if (hours === 23) {
          return minutes <= 30;
        }
        
        // Include all data points between 9:00 AM and 11:00 PM
        return hours >= 9 && hours < 23;
      });

      // Set the trend data and stats
      setTrendData(filteredData);
      
      // Recalculate stats if we filtered out any data points
      if (filteredData.length !== data.data.length && filteredData.length > 0) {
        const prices = filteredData.map((item: DataPoint) => item.value);
        const newStats = {
          count: prices.length,
          minPrice: Math.min(...prices),
          maxPrice: Math.max(...prices),
          avgPrice: prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length,
          startPrice: filteredData[0].value,
          endPrice: filteredData[filteredData.length - 1].value,
          totalChange: filteredData[filteredData.length - 1].value - filteredData[0].value,
          totalChangePercent: ((filteredData[filteredData.length - 1].value - filteredData[0].value) / filteredData[0].value) * 100
        };
        setStats(newStats);
      } else {
        setStats(data.stats);
      }
      
      setLastUpdatedTime(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) + ' IST');
    } catch (error) {
      setError('Failed to fetch trend data');
      console.error('Error fetching trend data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load data on initial render and set up refresh interval
  useEffect(() => {
    fetchTrendData();
    
    // Simulate refresh every 5 minutes with static data
    const intervalId = setInterval(fetchTrendData, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Format time for display
  const formatTimeForAxis = (timeString: string): string => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Format date for tooltip
  const formatDateForTooltip = (timeString: string): string => {
    const date = new Date(timeString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Convert ISO string time to numeric value for the chart (minutes since midnight)
  const timeToMinutes = (timeString: string): number => {
    const date = new Date(timeString);
    return date.getHours() * 60 + date.getMinutes();
  };

  // Transform data to include numeric time values for the chart
  const transformedData = trendData.map(point => ({
    ...point,
    timeValue: timeToMinutes(point.time)
  }));

  // Use data directly from API
  const visibleData = useMemo(() => trendData, [trendData]);

  // Generate time ticks based on the available data
  const generateTimeTicks = () => {
    if (transformedData.length === 0) {
      return [];
    }
    
    // Get min and max time values
    const timeValues = transformedData.map(d => d.timeValue);
    const minTime = Math.min(...timeValues);
    const maxTime = Math.max(...timeValues);
    
    // Generate ticks at regular intervals
    const ticks = [];
    const interval = 60; // Every hour
    
    for (let time = Math.floor(minTime / interval) * interval; time <= maxTime; time += interval) {
      ticks.push(time);
    }
    
    return ticks;
  };

  // For display in the UI
  const timeTicks = generateTimeTicks();
  const currentValue = hoveredValue !== null 
    ? hoveredValue 
    : transformedData.length > 0 
      ? transformedData[transformedData.length - 1].value 
      : 0;
      
  const currentTime = hoveredTime !== null 
    ? hoveredTime 
    : transformedData.length > 0 
      ? formatTimeForAxis(transformedData[transformedData.length - 1].time)
      : '';
      
  const change = stats?.totalChange || 0;
  const changePercentage = stats?.totalChangePercent || 0;
  const isPositiveChange = change >= 0;

  return (
    <div className="w-full p-6 bg-gray-50 rounded-2xl mt-8">
      <div className="flex flex-col space-y-6">
        {/* Title and Last Updated Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-8 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-full"></div>
            <h2 className="text-xl font-bold text-gray-800">Aluminum Price Trends</h2>
          </div>
          
          {/* Last updated time is tracked internally but not displayed */}
        </div>

        {/* Filter controls */}
        <div className="flex justify-end items-center flex-wrap gap-4">
          {/* Refresh Button */}
          <button 
            onClick={fetchTrendData}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>

        {/* Trading Hours Notice */}
        <div className="text-sm text-gray-600 text-center bg-gray-100 py-2 rounded-lg">
          <div>
            Aluminum Price Trend for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="text-xs mt-1">
            Trading Hours: 9:00 AM - 11:30 PM
            {(() => {
              const { isWithinTradingHours, isBeforeTradingHours } = getTradingStatus();
              
              if (!isWithinTradingHours) {
                return (
                  <div className="mt-1 font-medium text-amber-600">
                    {isBeforeTradingHours
                      ? 'Showing previous day\'s session (new session starts at 9:00 AM)'
                      : 'Showing today\'s completed session (closed at 11:30 PM)'}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full flex-col">
                <p className="text-red-500 mb-2">Error: {error}</p>
                <p className="text-gray-500">Please try refreshing the data</p>
              </div>
            ) : trendData.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No data available for the selected time period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={visibleData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  onMouseMove={(e) => {
                    if (e.activePayload && e.activePayload.length > 0) {
                      setHoveredValue(e.activePayload[0].payload.value);
                      setHoveredTime(e.activePayload[0].payload.time);
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredValue(null);
                    setHoveredTime(null);
                  }}
                >
                  <defs>
                    <linearGradient id="lmeLineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#34D399" />
                    </linearGradient>
                    
                    {/* Vertical gradient for area fill */}
                    <linearGradient id="lmeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                      <stop offset="30%" stopColor="#34D399" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#D1FAE5" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false} 
                    stroke="#E5E7EB" 
                  />
                  
                  {/* X-axis removed as requested */}

                  <YAxis
                    domain={stats ? ['auto', 'auto'] : [0, 100]}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  
                  <Tooltip content={<CustomTooltip />} />
                  
                  {stats && (
                    <ReferenceLine 
                      y={stats.avgPrice} 
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

                  {/* Main Area with gradient fill - using linear type for pointed lines */}
                  <Area
                    type="linear"
                    dataKey="value"
                    stroke="url(#lmeLineGradient)"
                    strokeWidth={2.5}
                    fill="url(#lmeAreaGradient)"
                    fillOpacity={1}
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                    dot={false}
                    activeDot={{
                      r: 6,
                      strokeWidth: 2,
                      fill: '#fff',
                      stroke: '#10B981',
                    }}
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}