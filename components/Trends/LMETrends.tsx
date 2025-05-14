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
  displayTime: string;
}

interface ApiResponse {
  success: boolean;
  data: DataPoint[];
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
}

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length > 0) {
    // Get the date and time from the ISO string
    const date = new Date(label);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Get the value directly from payload
    const price = payload[0]?.value !== undefined ? payload[0].value : 0;
    
    return (
      <div className="bg-white p-4 border border-gray-100 rounded-lg shadow-lg">
        <p className="text-xs font-medium text-gray-500">{formattedDate} • {formattedTime}</p>
        <div className="flex items-center mt-1">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 mr-2"></div>
          <p className="text-lg font-bold text-gray-800">${price.toFixed(2)}</p>
        </div>
      </div>
    );
  }
  return null;
};

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

export default function LMETrends() {
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  const [hoveredTime, setHoveredTime] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<DataPoint[]>([]);
  const [stats, setStats] = useState<ApiResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transform date to display format for time axis
  const formatTimeForAxis = (timeString: string): string => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Convert ISO string time to numeric value for the chart (minutes since midnight)
  const timeToMinutes = (timeString: string): number => {
    const date = new Date(timeString);
    return date.getHours() * 60 + date.getMinutes();
  };

  // Transform API data to include numeric time values for the chart
  const transformedData = trendData.map(point => ({
    ...point,
    timeValue: timeToMinutes(point.time)
  }));

  // Format chart data
  const formattedData = trendData.map((point, index) => ({
    ...point,
    // Create sequential index for easier x-axis management
    index
  }));
  
  // Use all data without slicing
  const visibleData = useMemo(() => {
    return formattedData;
  }, [formattedData]);

  // Generate time ticks based on the available data
  const generateTimeTicks = () => {
    if (transformedData.length === 0) return [];
    
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

  // Fetch data from the API
  useEffect(() => {
    const fetchTrendData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching trend data');
        // Add a cache-busting parameter to prevent caching
        const cacheBuster = new Date().getTime();
        const response = await fetch(`/api/trends_lme?cacheBust=${cacheBuster}`);
        
        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }
        
        const data: ApiResponse = await response.json();
        console.log('API response:', data);
        
        if (!data.success) {
          throw new Error('API reported failure');
        }
        
        if (!data.data || data.data.length === 0) {
          console.log('No data returned from API');
          setError('No trend data available');
          setTrendData([]);
          setStats(null);
          return;
        }
        
        console.log(`Retrieved ${data.data.length} data points`);
        
        // Add date normalization for more reliable comparisons
        const normalizedData = data.data.map(point => {
          // Extract date part for easier debugging
          const date = new Date(point.time);
          const displayDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: '2-digit'
          });
          
          return {
            ...point,
            displayDate
          };
        });
        
        // Log date range information
        if (normalizedData.length > 0) {
          const dates = normalizedData.map(point => new Date(point.time));
          const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
          const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
          
          console.log(`Data date range: ${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}`);
          
          // Count data points by date
          const dateCounts: Record<string, number> = {};
          normalizedData.forEach(point => {
            const dateKey = point.displayDate;
            dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
          });
          
          console.log('Data points by date:', dateCounts);
        }
        
        // Apply date filtering with normalized dates to ensure all data points are included
        const filteredData = normalizedData;
        
        setTrendData(filteredData);
        setStats(data.stats);
      } catch (error) {
        console.error('Error fetching trend data:', error);
        setError('Failed to load trend data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTrendData();
    
    // Refresh data periodically (every 2 minutes)
    const intervalId = setInterval(fetchTrendData, 2 * 60 * 1000);
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []); 

  // Calculate chart range and stats
  const min = stats?.minPrice 
    ? Math.floor(stats.minPrice * 0.995) // 0.5% below min
    : transformedData.length > 0 
      ? Math.min(...transformedData.map(d => d.value)) * 0.995 
      : 0;
      
  const max = stats?.maxPrice 
    ? Math.ceil(stats.maxPrice * 1.005) // 0.5% above max
    : transformedData.length > 0 
      ? Math.max(...transformedData.map(d => d.value)) * 1.005 
      : 100;
      
  const avg = stats?.avgPrice || 0;

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
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-8 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-full"></div>
            <h2 className="text-xl font-bold text-gray-800">LME CSP Price Trends</h2>
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
              <div className="flex items-center justify-center h-full">
                <p className="text-red-500">{error}</p>
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

                  {/* Main Area with gradient fill */}
                  <Area
                    type="monotone"
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