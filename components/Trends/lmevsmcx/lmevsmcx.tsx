'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, AreaChart, Area, ReferenceLine
} from 'recharts';

// Import static data from lme and mcx files
import { processLmeData } from './lme';
import { 
    fetchMcxCurrentData, 
    initializeMcxData, 
    processMcxCurrentData, 
    processMcxNextData, 
    processMcxThirdData, 
    monthNames 
} from './mcx';

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

// This function is no longer needed as we're using the API data directly
// Keeping it as a reference but not using it
const createFallbackData = () => {
    // Create fallback data if needed
    const fallbackData: DataItem[] = [];
    
    // Add fallback data points
    for (let i = 0; i < 8; i++) {
        const hour = 9 + Math.floor(i / 2);
        const minute = (i % 2) * 30;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        
        const date = new Date();
        date.setHours(hour, minute, 0, 0);
        
        fallbackData.push({
            createdAt: date.toISOString(),
            date: date.toISOString().split('T')[0],
            value: 250 + (i * 10),
            displayTime: `${hour12}:${minute === 0 ? '00' : minute} ${ampm}`,
            istHour: hour,
            istMinute: minute
        });
    }
    
    return fallbackData;
};

// Custom tooltip component
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

const LMEvsMCXChart: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<DataItem[]>([]);
    const [stats, setStats] = useState<{ min: number, max: number, avg: number }>({ min: 0, max: 0, avg: 0 });
    const [monthName, setMonthName] = useState<string>('MCX Current Month');
    const chartContainerRef = useRef<HTMLDivElement>(null);
    
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
                    
                    // Update month name if available
                    if (result.currentMonth) {
                        setMonthName(result.currentMonth);
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
        
        fetchData();
    }, []);

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
                
                {/* Chart Selection Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3 py-2">
                    <button
                        className="px-5 py-2 text-sm font-medium rounded-md transition-all bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                        onClick={() => alert('LME data coming soon')}
                    >
                        LME
                    </button>
                    
                    <button
                        className="px-5 py-2 text-sm font-medium rounded-md transition-all bg-green-600 text-white hover:bg-green-700 shadow-sm"
                    >
                        MCX May
                    </button>
                    
                    <button
                        className="px-5 py-2 text-sm font-medium rounded-md transition-all bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200"
                        onClick={() => alert('MCX June data coming soon')}
                    >
                        MCX June
                    </button>
                    
                    <button
                        className="px-5 py-2 text-sm font-medium rounded-md transition-all bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200"
                        onClick={() => alert('MCX July data coming soon')}
                    >
                        MCX July
                    </button>
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
};

export default LMEvsMCXChart;
