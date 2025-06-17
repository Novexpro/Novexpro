'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts';

// Define proper tooltip props type
interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload?: {
      displayTime?: string;
      date: string;
      createdAt: string;
    };
  }>;
  label?: string;
}

// Define the data item interface
interface DataItem {
  createdAt: string;
  date: string;
  value: number;
  displayTime: string;
  istHour?: number;
  istMinute?: number;
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length > 0) {
    // Get the displayTime from payload - this comes directly from API with UTC time
    const displayTime = payload[0]?.payload?.displayTime || '';
    
    // Get the value
    const price = payload[0]?.value !== undefined ? payload[0].value : 0;

    return (
      <div className="bg-white p-4 border border-gray-100 rounded-lg shadow-lg">
        <p className="text-xs font-medium text-gray-500">{displayTime}</p>
        <div className="flex items-center mt-1">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 mr-2"></div>
          <p className="text-lg font-bold text-gray-800">₹{price.toFixed(2)}</p>
        </div>
      </div>
    );
  }
  return null;
};

export default function MCXMonthlyTrends() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DataItem[]>([]);
  const [stats, setStats] = useState<{ min: number, max: number, avg: number }>({ min: 0, max: 0, avg: 0 });
  const [monthName, setMonthName] = useState<string>('MCX Current Month');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Fetch month names from API
  useEffect(() => {
    const fetchMonthNames = async () => {
      try {
        const response = await fetch('/api/mcx_month_names');
        if (!response.ok) {
          console.error('Failed to fetch month names');
          return;
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          // Set the current month name
          setMonthName(result.data.currentMonth);
          console.log('Current month name:', result.data.currentMonth);
        }
      } catch (err) {
        console.error('Error fetching month names:', err);
      }
    };
    
    fetchMonthNames();
  }, []);

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch data from the API
        const response = await fetch('/api/mcx_current_month');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
          console.log(`Received ${result.data.length} data points from API`);
          
          // Log first and last item for debugging
          if (result.data.length > 0) {
            console.log('First data point:', result.data[0]);
            console.log('Last data point:', result.data[result.data.length - 1]);
          }
          
          // Set the data
          setData(result.data);
          
          // Set stats (add 0.5% padding to min/max for better visualization)
          if (result.stats) {
            setStats({
              min: result.stats.minPrice * 0.995, // 0.5% below min
              max: result.stats.maxPrice * 1.005, // 0.5% above max
              avg: result.stats.avgPrice
            });
          }
        } else {
          throw new Error(result.message || 'Failed to fetch data');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
        setError(errorMessage);
        console.error('Error fetching metal prices:', err);
      } finally {
        setLoading(false);
      }
    };

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
        console.log('⏰ MCXMonthlyTrends: Skipping fetch during off-hours');
      }
    };
    
    // Fetch data initially
    fetchDataIfAllowed();
    
    // Dynamic polling based on operating hours
    const scheduleNext = () => {
      const interval = isWithinOperatingHours() ? 60 * 1000 : 300 * 1000; // 1 min vs 5 min
      const timeoutId = setTimeout(() => {
        fetchDataIfAllowed();
        scheduleNext();
      }, interval);
      return timeoutId;
    };
    
    const timeoutId = scheduleNext();
    
    // Clean up interval on component unmount
    return () => clearTimeout(timeoutId);
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="w-full p-6 bg-gray-50 rounded-2xl mt-8">
        <div className="flex flex-col space-y-6">
          {/* Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
              <h2 className="text-xl font-bold text-gray-800">MCX Metal Spot Prices</h2>
            </div>
          </div>

          {/* Loading state */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex items-center justify-center h-[400px]">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-500">Loading MCX metal spot prices...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="w-full p-6 bg-gray-50 rounded-2xl mt-8">
        <div className="flex flex-col space-y-6">
          {/* Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
              <h2 className="text-xl font-bold text-gray-800">MCX Metal Spot Prices</h2>
            </div>
          </div>

          {/* Error state */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex items-center justify-center h-[400px]">
            <div className="flex flex-col items-center text-center">
              <div className="text-red-500 text-5xl mb-4">⚠️</div>
              <p className="text-gray-700 font-medium">Failed to load MCX metal spot prices</p>
              <p className="text-gray-500 mt-2">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 bg-gray-50 rounded-2xl mt-8">
      <div className="flex flex-col space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
            <h2 className="text-xl font-bold text-gray-800">{monthName} Prices</h2>
          </div>
        </div>
        
        {/* Trading Hours Notice */}
        <div className="text-sm text-gray-600 text-center bg-gray-100 py-2 rounded-lg">
          <div>
            Aluminum Price Trend for Tuesday, May 20, 2025
          </div>
          <div className="text-xs mt-1">
            Trading Hours: 9:00 AM - 11:30 PM
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
          {data.length === 0 ? (
            <div className="h-[400px] w-full flex items-center justify-center">
              <p className="text-gray-500">No metal price data available for today between 9:00 AM and 11:00 PM. Check back later.</p>
            </div>
          ) : (
            <div className="h-[400px] w-full" ref={chartContainerRef}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="mcxLineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={1} />
                      <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="mcxAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#60A5FA" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />

                  <YAxis
                    domain={[stats.min, stats.max]}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tickFormatter={(value) => `₹${value.toFixed(0)}`}
                  />

                  <Tooltip content={<CustomTooltip />} />

                  <ReferenceLine
                    y={stats.avg}
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

                  {/* Main Area with gradient fill */}
                  <Area
                    type="linear"
                    dataKey="value"
                    stroke="url(#mcxLineGradient)"
                    strokeWidth={2.5}
                    fill="url(#mcxAreaGradient)"
                    fillOpacity={1}
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                    dot={{ 
                      r: 1.5, 
                      fill: '#3B82F6',
                      strokeWidth: 0
                    }}
                    activeDot={{
                      r: 6,
                      strokeWidth: 2,
                      fill: '#fff',
                      stroke: '#3B82F6',
                    }}
                    isAnimationActive={true}
                    connectNulls={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}