'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length > 0) {
        // Get the displayTime from payload - this comes directly from API with timestamp data
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

export default function MCXThirdMonthTrends() {
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [thirdMonthData, setThirdMonthData] = useState<Array<{ date: string, value: number, createdAt: string, displayTime: string }>>([]);
    const [stats, setStats] = useState<{ min: number, max: number, avg: number }>({ min: 0, max: 0, avg: 0 });
    const [monthName, setMonthName] = useState<string>('MCX Third Month');
    const [todayDateFormatted, setTodayDateFormatted] = useState<string>('');
    const chartContainerRef = useRef<HTMLDivElement>(null);
    
    // Format today's date for display
    useEffect(() => {
        const today = new Date();
        const options: Intl.DateTimeFormatOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        setTodayDateFormatted(today.toLocaleDateString('en-US', options));
    }, []);

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
                    // Set the third month name
                    setMonthName(result.data.thirdMonth);
                    console.log('Third month name:', result.data.thirdMonth);
                }
            } catch (err) {
                console.error('Error fetching month names:', err);
            }
        };
        
        fetchMonthNames();
    }, []);

    // Get data for the active month
    const currentData = thirdMonthData;
    
    // Calculate min, max, and average for the current data
    let min = 0;
    let max = 0;
    let avg = 0;

    if (currentData.length > 0) {
        const values = currentData.map(item => item.value);
        min = Math.min(...values) * 0.995; // 0.5% below min
        max = Math.max(...values) * 1.005; // 0.5% above max
        avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    } else {
        min = 0;
        max = 0;
        avg = 0;
    }

    // Fetch Third Month data from API
    useEffect(() => {
        const fetchThirdMonthData = async () => {
            try {
                setLoading(true);
                
                // Simple API call without date parameters (handled on server using timestamp)
                const response = await fetch('/api/mcx_third_month');
                if (!response.ok) {
                    throw new Error('Failed to fetch MCX third month data');
                }
                const data = await response.json();

                if (data.success && data.data) {
                    // Log the raw data to see what we're getting from the server
                    console.log('Raw third month data from API:', data.data);
                    
                    if (data.data.length === 0) {
                        setThirdMonthData([]);
                        setLoading(false);
                        return;
                    }
                    
                    // Data comes pre-formatted from the API with timestamp data, just set it directly
                    setThirdMonthData(data.data);

                    // Update stats
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
                console.error('Error fetching MCX third month data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchThirdMonthData();
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
                            <h2 className="text-xl font-bold text-gray-800">{monthName} Prices</h2>
                        </div>
                    </div>

                    {/* Trading Hours Notice with today's date */}
                    <div className="text-sm text-gray-600 text-center bg-gray-100 py-2 rounded-lg">
                        <div>
                            Metal Price Trend for {todayDateFormatted}
                        </div>
                        <div className="text-xs mt-1">
                            Trading Hours: 9:00 - 23:30 (9:00 AM - 11:30 PM)
                        </div>
                    </div>

                    {/* Loading state */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex items-center justify-center h-[400px]">
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                            <p className="text-gray-500">Loading MCX metal third month prices...</p>
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
                            <h2 className="text-xl font-bold text-gray-800">{monthName} Prices</h2>
                        </div>
                    </div>

                    {/* Trading Hours Notice with today's date */}
                    <div className="text-sm text-gray-600 text-center bg-gray-100 py-2 rounded-lg">
                        <div>
                            Metal Price Trend for {todayDateFormatted}
                        </div>
                        <div className="text-xs mt-1">
                            Trading Hours: 9:00 - 23:30 (9:00 AM - 11:30 PM)
                        </div>
                    </div>

                    {/* Error state */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex items-center justify-center h-[400px]">
                        <div className="flex flex-col items-center text-center">
                            <div className="text-red-500 text-5xl mb-4">⚠️</div>
                            <p className="text-gray-700 font-medium">Failed to load MCX metal third month prices</p>
                            <p className="text-gray-500 mt-2">{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // If no data is available
    if (currentData.length === 0) {
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
                    
                    {/* Trading Hours Notice with today's date */}
                    <div className="text-sm text-gray-600 text-center bg-gray-100 py-2 rounded-lg">
                        <div>
                            Metal Price Trend for {todayDateFormatted}
                        </div>
                        <div className="text-xs mt-1">
                            Trading Hours: 9:00 - 23:30 (9:00 AM - 11:30 PM)
                        </div>
                    </div>

                    {/* No data state */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex items-center justify-center h-[400px]">
                        <div className="flex flex-col items-center text-center">
                            <div className="text-gray-400 text-5xl mb-4">📊</div>
                            <p className="text-gray-700 font-medium">No data available right now</p>
                            <p className="text-gray-500 mt-2">Please check back between 9:00 AM - 11:30 PM</p>
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
                
                {/* Trading Hours Notice with today's date */}
                <div className="text-sm text-gray-600 text-center bg-gray-100 py-2 rounded-lg">
                    <div>
                        Metal Price Trend for {todayDateFormatted}
                    </div>
                    <div className="text-xs mt-1">
                        Trading Hours: 9:00 - 23:30 (9:00 AM - 11:30 PM)
                    </div>
                </div>

                {/* Chart */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
                    <div className="h-[400px] w-full" ref={chartContainerRef}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={currentData}
                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="thirdMonthLineGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={1} />
                                        <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.8} />
                                    </linearGradient>
                                    <linearGradient id="thirdMonthAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#60A5FA" stopOpacity={0} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />

                                <YAxis
                                    domain={[min, max]}
                                    tick={{ fontSize: 12, fill: '#6B7280' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={40}
                                    tickFormatter={(value) => `₹${value.toFixed(0)}`}
                                />

                                <Tooltip content={<CustomTooltip />} />

                                <ReferenceLine
                                    y={avg}
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
                                    stroke="url(#thirdMonthLineGradient)"
                                    strokeWidth={2.5}
                                    fill="url(#thirdMonthAreaGradient)"
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
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
} 