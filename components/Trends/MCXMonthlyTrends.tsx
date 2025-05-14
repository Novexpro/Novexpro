'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  XAxis,
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
      timestamp: string;
    };
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length > 0) {
    // Get the formatted date directly from the payload's displayTime if available
    const displayTime = payload[0]?.payload?.displayTime;
    
    // As fallback, format the date from label
    let formattedTime = '';
    
    if (displayTime) {
      // Use the pre-calculated display time if available
      formattedTime = displayTime;
    } else {
      // Fallback to formatting from timestamp or label
      const date = payload[0]?.payload?.timestamp 
        ? new Date(payload[0].payload.timestamp)
        : label ? new Date(label) : new Date();
          
      formattedTime = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }

    // Get the value directly from payload
    const price = payload[0]?.value !== undefined ? payload[0].value : 0;

    return (
      <div className="bg-white p-4 border border-gray-100 rounded-lg shadow-lg">
        <p className="text-xs font-medium text-gray-500">{formattedTime}</p>
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
  const [allData, setAllData] = useState<Array<{ date: string, value: number, timestamp: string, displayTime: string, isWithinTradingHours?: boolean }>>([]);
  const [stats, setStats] = useState<{ min: number, max: number, avg: number }>({ min: 0, max: 0, avg: 0 });
  const [tradingStatus, setTradingStatus] = useState<{ isWithinTradingHours: boolean, currentTime: string, tradingHours: string }>({ 
    isWithinTradingHours: false, 
    currentTime: '', 
    tradingHours: '9:0 - 23:30' 
  });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  // Filter data to only show points between 9:00 AM and 23:00 PM
  const currentMonthData = useMemo(() => {
    if (allData.length === 0) {
      return [];
    }
    
    // Get today's date
    const today = new Date();
    const indianToday = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayDateString = indianToday.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`Filtering data for today (${todayDateString})`);
    
    // Filter data to only include today's data between 9:00 AM and 23:00 PM
    return allData.filter((item: { timestamp: string }) => {
      const itemDate = new Date(item.timestamp);
      const itemDateString = itemDate.toISOString().split('T')[0];
      const isToday = itemDateString === todayDateString;
      
      // Get hours and minutes
      const hours = itemDate.getHours();
      const minutes = itemDate.getMinutes();
      
      // Check if time is between 9:00 AM and 23:00 PM
      const isAfter9AM = (hours > 9) || (hours === 9 && minutes >= 0);
      const isBefore23PM = hours < 23; // Strictly before 23:00
      
      console.log(`Data point at ${hours}:${minutes} - isToday: ${isToday}, isAfter9AM: ${isAfter9AM}, isBefore23PM: ${isBefore23PM}`);
      
      return isToday && isAfter9AM && isBefore23PM;
    });
  }, [allData]);
  
  // Get data for the active month
  const currentData = currentMonthData;
  
  // Calculate min, max, and average for the current data
  let min = 0;
  let max = 0;
  let avg = 0;

  if (currentData.length > 0) {
    const values = currentData.map(item => item.value);
    min = Math.min(...values) * 0.995; // 0.5% below min
    max = Math.max(...values) * 1.005; // 0.5% above max
    avg = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
  } else {
    min = 0;
    max = 0;
    avg = 0;
  }

  // Fetch Current Month data from API
  useEffect(() => {
    const fetchCurrentMonthData = async () => {
      try {
        setLoading(true);
        // Get today's date in Indian timezone
        const today = new Date();
        const indianDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        
        // For debugging - log the current time
        console.log('Current time (IST):', indianDate.toLocaleTimeString());
        
        const startOfDay = new Date(indianDate.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(indianDate.setHours(23, 59, 59, 999)).toISOString();

        // Add date range parameters to the API call
        const response = await fetch(`/api/mcx_current_month?startDate=${startOfDay}&endDate=${endOfDay}`);
        if (!response.ok) {
          throw new Error('Failed to fetch MCX current month data');
        }
        const data = await response.json();

        if (data.success && data.data) {
          // Log the raw data to see what we're getting from the server
          console.log('Raw current month data from API:', data.data);
          
          // Get trading status from API response
          if (data.tradingStatus) {
            setTradingStatus(data.tradingStatus);
            console.log('Trading status:', data.tradingStatus);
          }
          
          // Format the data for the chart and ensure consistent date format
          const formattedData = data.data.map((item: { 
            timestamp?: string; 
            date?: string; 
            value: number; 
            isWithinTradingHours?: boolean;
            [key: string]: unknown 
          }) => {
            if (!item.timestamp) {
              console.error('Missing timestamp in data item:', item);
              return null;
            }
            
            // Use the displayTime from API or extract time from timestamp (HH:MM:SS)
            const displayTime = item.displayTime || item.timestamp.split('T')[1].split('.')[0];
            
            return {
              date: item.timestamp,
              value: item.value,
              timestamp: item.timestamp,
              displayTime: displayTime,
              isWithinTradingHours: item.isWithinTradingHours
            };
          }).filter((item: ReturnType<typeof data.data.map> extends (infer U)[] ? U : never): item is NonNullable<typeof item> => item !== null);
          
          console.log('Formatted current month data with timestamp:', formattedData);
          
          // Check for the last record in the data
          if (formattedData.length > 0) {
            const lastItem = formattedData[formattedData.length - 1];
            console.log('Last item in current month data:', lastItem);
            console.log('Last time as Date:', lastItem.displayTime);
            console.log('Using timestamp:', lastItem.timestamp);
          }

          // Sort the data by date field to ensure chronological order
          formattedData.sort((a: { date: string }, b: { date: string }) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA.getTime() - dateB.getTime();
          });
          
          console.log('Sorted current month data:', formattedData);
          console.log('Total current month data points:', formattedData.length);
          
          // Update the all data state with the new data
          if (formattedData.length > 0) {
            console.log('Updating all data - filtering will be done in useMemo');
            setAllData(formattedData);
          }

          // Update stats - only if we have filtered data
          if (data.stats) {
            setStats({
              min: data.stats.minPrice * 0.995, // 0.5% below min
              max: data.stats.maxPrice * 1.005, // 0.5% above max
              avg: data.stats.avgPrice
            });
          }
        } else {
          throw new Error('Invalid data format');
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
        setError(errorMessage);
        console.error('Error fetching MCX current month data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentMonthData();
    
    // Set up polling to refresh data more frequently (every minute) to ensure we get the latest data
    const intervalId = setInterval(fetchCurrentMonthData, 60 * 1000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
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
              <h2 className="text-xl font-bold text-gray-800">MCX Aluminum Current Month Prices</h2>
            </div>
          </div>

          {/* Loading state */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex items-center justify-center h-[400px]">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-500">Loading current month MCX data...</p>
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
              <h2 className="text-xl font-bold text-gray-800">MCX Aluminum Current Month Prices</h2>
            </div>
          </div>

          {/* Error state */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex items-center justify-center h-[400px]">
            <div className="flex flex-col items-center text-center">
              <div className="text-red-500 text-5xl mb-4">⚠️</div>
              <p className="text-gray-700 font-medium">Failed to load current month MCX data</p>
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
            <h2 className="text-xl font-bold text-gray-800">MCX Aluminum Current Month Prices</h2>
          </div>
          {currentMonthData.length > 0 && (
            <div className="text-sm text-gray-500">
              Last updated: {new Date(currentMonthData[currentMonthData.length - 1].timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
          {currentMonthData.length === 0 ? (
            <div className="h-[400px] w-full flex items-center justify-center">
              <p className="text-gray-500">No data available for today. Check back later.</p>
            </div>
          ) : (
            <div className="h-[400px] w-full" ref={chartContainerRef}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={currentMonthData}
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
                    type="monotone"
                    dataKey="value"
                    stroke="url(#mcxLineGradient)"
                    strokeWidth={2.5}
                    fill="url(#mcxAreaGradient)"
                    fillOpacity={1}
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                    dot={{ 
                      r: 3, 
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