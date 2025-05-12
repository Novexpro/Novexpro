'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// Static data for MCX months
const mcxData = {
    // May data will be fetched from API
    may: [],
    june: [
        { date: '2023-06-01', value: 2420 },
        { date: '2023-06-02', value: 2430 },
        { date: '2023-06-05', value: 2445 },
        { date: '2023-06-06', value: 2460 },
        { date: '2023-06-07', value: 2455 },
        { date: '2023-06-08', value: 2470 },
        { date: '2023-06-09', value: 2485 },
        { date: '2023-06-12', value: 2490 },
        { date: '2023-06-13', value: 2500 },
        { date: '2023-06-14', value: 2510 },
        { date: '2023-06-15', value: 2525 },
    ],
    july: [
        { date: '2023-07-03', value: 2530 },
        { date: '2023-07-04', value: 2545 },
        { date: '2023-07-05', value: 2560 },
        { date: '2023-07-06', value: 2550 },
        { date: '2023-07-07', value: 2565 },
        { date: '2023-07-10', value: 2580 },
        { date: '2023-07-11', value: 2590 },
        { date: '2023-07-12', value: 2600 },
        { date: '2023-07-13', value: 2615 },
        { date: '2023-07-14', value: 2630 },
        { date: '2023-07-17', value: 2645 },
    ],
};

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
        let formattedDate = '';
        let formattedTime = '';
        
        if (displayTime) {
            // Use the pre-calculated display time if available
            const [datePart, timePart] = displayTime.split(', ');
            formattedDate = datePart;
            formattedTime = timePart;
        } else {
            // Fallback to formatting from timestamp or label
            const date = payload[0]?.payload?.timestamp 
                ? new Date(payload[0].payload.timestamp)
                : label ? new Date(label) : new Date();
                
            formattedDate = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: '2-digit'
            });
            
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
                <p className="text-xs font-medium text-gray-500">{formattedDate} {formattedTime}</p>
                <div className="flex items-center mt-1">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 mr-2"></div>
                    <p className="text-lg font-bold text-gray-800">₹{price.toFixed(2)}</p>
                </div>
            </div>
        );
    }
    return null;
};

interface MCXMonthlyTrendsProps {
    initialMonth?: 'may' | 'june' | 'july';
}

export default function MCXMonthlyTrends({ initialMonth = 'may' }: MCXMonthlyTrendsProps) {
    const [activeMonth] = useState<'may' | 'june' | 'july'>(initialMonth);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [mayData, setMayData] = useState<Array<{ date: string, value: number, timestamp: string, displayTime: string }>>([]);
    const [, setStats] = useState<{ min: number, max: number, avg: number }>({ min: 0, max: 0, avg: 0 });
    const [viewWindow, setViewWindow] = useState<{ start: number, end: number }>({ start: 0, end: 0 });
    const [windowSize, setWindowSize] = useState<number>(20); // How many data points to show at once
    const chartContainerRef = useRef<HTMLDivElement>(null);
    
    // Get data for the active month - MOVED UP before any useEffects that depend on it
    const currentData = activeMonth === 'may' ? mayData : mcxData[activeMonth];
    
    // Get visible data based on view window
    const visibleData = useCallback(() => {
        if (currentData.length === 0) return [];
        
        // Calculate visible data range
        const dataLength = currentData.length;
        
        // Ensure we don't exceed array bounds
        const newStart = Math.max(0, viewWindow.start);
        let newEnd = Math.min(dataLength - 1, viewWindow.end);
        
        // If window is invalid, reset it
        if (newEnd < newStart) {
            newEnd = Math.min(dataLength - 1, newStart + windowSize - 1);
        }
        
        // Update view window state if needed (but don't trigger a re-render during this callback)
        if (newStart !== viewWindow.start || newEnd !== viewWindow.end) {
            // Use setTimeout to avoid state updates during render
            setTimeout(() => {
                setViewWindow({
                    start: newStart,
                    end: newEnd
                });
            }, 0);
        }
        
        // Return the visible slice of data
        return currentData.slice(newStart, newEnd + 1);
    }, [currentData, viewWindow, windowSize]);
    
    // Memoized visible data
    const visibleDataPoints = visibleData();
    
    // Calculate slider position based on current view window
    const sliderPosition = currentData.length <= windowSize
        ? 100 // If all data is visible, slider is at 100%
        : (viewWindow.start / (currentData.length - windowSize)) * 100;

    // Define a proper interface for the API response item
    interface APIDataItem {
        timestamp?: string;
        date?: string;
        value: number;
        [key: string]: unknown; // Replace any with unknown for better type safety
    }

    // Fetch May data from API
    useEffect(() => {
        const fetchMayData = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/mcx_current_month');
                if (!response.ok) {
                    throw new Error('Failed to fetch MCX data');
                }
                const data = await response.json();

                if (data.success && data.data) {
                    // Log the raw data to see what we're getting from the server
                    console.log('Raw data from API:', data.data);
                    
                    // Format the data for the chart and ensure consistent date format
                    const formattedData = data.data.map((item: APIDataItem) => {
                        // Use timestamp as the primary date field for display
                        const displayDate = item.timestamp 
                            ? new Date(item.timestamp) 
                            : item.date 
                                ? new Date(item.date) 
                                : new Date();
                        
                        return {
                            // Convert to ISO string for consistent formatting
                            date: displayDate.toISOString(),
                            value: item.value,
                            // Store timestamp for reference
                            timestamp: item.timestamp || displayDate.toISOString(),
                            // Add a calculated display time field
                            displayTime: displayDate.toLocaleString()
                        };
                    });
                    
                    console.log('Formatted data with timestamp:', formattedData);
                    
                    // Check for the last record in the data
                    if (formattedData.length > 0) {
                        const lastItem = formattedData[formattedData.length - 1];
                        console.log('Last item in data:', lastItem);
                        console.log('Last time as Date:', lastItem.displayTime);
                        console.log('Using timestamp:', lastItem.timestamp);
                    }

                    // Sort the data by date field to ensure chronological order
                    formattedData.sort((a: { date: string }, b: { date: string }) => {
                        const dateA = new Date(a.date);
                        const dateB = new Date(b.date);
                        return dateA.getTime() - dateB.getTime();
                    });
                    
                    console.log('Sorted data:', formattedData);
                    console.log('Total data points:', formattedData.length);
                    
                    // Update the may data
                    setMayData(formattedData);

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
                console.error('Error fetching MCX data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMayData();
    }, []);

    // Initialize view window after data is loaded
    useEffect(() => {
        if (currentData.length > 0) {
            // Default to showing the last 20 data points, or all if less than 20
            const size = Math.min(20, currentData.length);
            setWindowSize(size);
            setViewWindow({
                start: Math.max(0, currentData.length - size),
                end: currentData.length - 1
            });
        }
    }, [mayData, activeMonth, currentData.length]);

    // Memoized scroll function to avoid recreating in every render
    const scrollChart = useCallback((direction: 'left' | 'right') => {
        setViewWindow(prevWindow => {
            const currentWindowSize = prevWindow.end - prevWindow.start + 1;
            const scrollStep = Math.max(1, Math.floor(currentWindowSize / 4)); // Scroll by 25% of visible window
    
            if (direction === 'left' && prevWindow.start > 0) {
                // Scroll left (backward in time)
                const newStart = Math.max(0, prevWindow.start - scrollStep);
                return {
                    start: newStart,
                    end: newStart + currentWindowSize - 1
                };
            } else if (direction === 'right' && prevWindow.end < currentData.length - 1) {
                // Scroll right (forward in time)
                const newEnd = Math.min(currentData.length - 1, prevWindow.end + scrollStep);
                return {
                    start: newEnd - currentWindowSize + 1,
                    end: newEnd
                };
            }
            return prevWindow;
        });
    }, [currentData.length]);

    // Jump to a specific position in the data
    const jumpToPosition = useCallback((position: number) => {
        setViewWindow(prevWindow => {
            const currentWindowSize = prevWindow.end - prevWindow.start + 1;
            const maxStart = Math.max(0, currentData.length - currentWindowSize);
            
            // Calculate new start position based on the slider value (0-100)
            const newStart = Math.min(maxStart, Math.floor((position / 100) * maxStart));
            return {
                start: newStart,
                end: Math.min(currentData.length - 1, newStart + currentWindowSize - 1)
            };
        });
    }, [currentData.length]);

    // Function to handle time interval zooming
    const handleTimeIntervalZoom = useCallback((zoomIn: boolean) => {
        console.log(`Time interval zoom ${zoomIn ? 'in' : 'out'} clicked, current window size: ${windowSize}`);
        
        setWindowSize(prevSize => {
            // Zoom in: reduce window size by 25% (show fewer points = higher time resolution)
            // Zoom out: increase window size by 25% (show more points = lower time resolution)
            const newSize = zoomIn 
                ? Math.max(5, Math.floor(prevSize * 0.75))  // Zoom in (reduce window)
                : Math.min(currentData.length, Math.ceil(prevSize * 1.25));  // Zoom out (increase window)
            
            console.log(`New window size: ${newSize}`);
            
            // Update view window with new size but keeping current center
            const currentCenter = Math.floor((viewWindow.start + viewWindow.end) / 2);
            const halfNewSize = Math.floor(newSize / 2);
            
            // Update view window
            setTimeout(() => {
                setViewWindow({
                    start: Math.max(0, currentCenter - halfNewSize),
                    end: Math.min(currentData.length - 1, currentCenter + halfNewSize)
                });
            }, 0);
            
            return newSize;
        });
    }, [windowSize, viewWindow, currentData.length]);

    useEffect(() => {
        // Add keyboard navigation for chart
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                scrollChart('left');
            } else if (e.key === 'ArrowRight') {
                scrollChart('right');
            } else if (e.key === '+' || (e.key === '=' && e.shiftKey)) {
                handleTimeIntervalZoom(true);
            } else if (e.key === '-' || e.key === '_') {
                handleTimeIntervalZoom(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [viewWindow, scrollChart, handleTimeIntervalZoom]);

    // Add scroll wheel support for time interval zooming
    useEffect(() => {
        const chartContainer = chartContainerRef.current;
        if (!chartContainer) return;

        const handleWheel = (e: WheelEvent) => {
            // If Ctrl key is pressed, use wheel for time interval zooming
            if (e.ctrlKey) {
                e.preventDefault();
                handleTimeIntervalZoom(e.deltaY < 0); // Zoom in if scrolling up, out if scrolling down
                return;
            }
            
            // Regular scrolling behavior (no Ctrl key)
            e.preventDefault();
            if (e.deltaX > 0 || e.deltaY > 0) {
                scrollChart('right');
            } else if (e.deltaX < 0 || e.deltaY < 0) {
                scrollChart('left');
            }
        };

        chartContainer.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            chartContainer.removeEventListener('wheel', handleWheel);
        };
    }, [viewWindow, scrollChart, handleTimeIntervalZoom]);

    // Calculate min, max, and average values for visible data
    let min, max, avg;

    if (visibleDataPoints.length > 0) {
        const values = visibleDataPoints.map(item => item.value);
        min = Math.min(...values) * 0.995; // 0.5% below min
        max = Math.max(...values) * 1.005; // 0.5% above max
        avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    } else {
        min = 0;
        max = 0;
        avg = 0;
    }

    // Show loading state
    if (loading && activeMonth === 'may') {
        return (
            <div className="w-full p-6 bg-gray-50 rounded-2xl mt-8">
                <div className="flex flex-col space-y-6">
                    {/* Title */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                            <h2 className="text-xl font-bold text-gray-800">MCX Aluminum Price Trends</h2>
                        </div>
                    </div>

                    {/* Loading state */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex items-center justify-center h-[400px]">
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                            <p className="text-gray-500">Loading MCX data...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show error state
    if (error && activeMonth === 'may') {
        return (
            <div className="w-full p-6 bg-gray-50 rounded-2xl mt-8">
                <div className="flex flex-col space-y-6">
                    {/* Title */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                            <h2 className="text-xl font-bold text-gray-800">MCX Aluminum Price Trends</h2>
                        </div>
                    </div>

                    {/* Error state */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 flex items-center justify-center h-[400px]">
                        <div className="flex flex-col items-center text-center">
                            <div className="text-red-500 text-5xl mb-4">⚠️</div>
                            <p className="text-gray-700 font-medium">Failed to load MCX data</p>
                            <p className="text-gray-500 mt-2">{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Format data for the chart
    const formattedData = visibleDataPoints.map((item, index) => ({
        ...item,
        index
    }));

    return (
        <div className="w-full p-6 bg-gray-50 rounded-2xl mt-8">
            <div className="flex flex-col space-y-6">
                {/* Title */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                        <h2 className="text-xl font-bold text-gray-800">MCX Aluminum Price Trends</h2>
                    </div>
                </div>

                {/* Chart with navigation controls */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
                    {/* Navigation controls */}
                    <div className="flex justify-between mb-4">
                        <button 
                            className={`px-3 py-1 rounded-md border border-gray-300 flex items-center ${viewWindow.start <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50 hover:border-blue-300 text-blue-600 transition-colors duration-200'}`}
                            onClick={() => scrollChart('left')}
                            disabled={viewWindow.start <= 0}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Previous
                        </button>
                        <div className="text-sm text-gray-500">
                            {visibleDataPoints.length > 0 ? (
                                <>
                                    <div>
                                        Showing {visibleDataPoints.length} of {currentData.length} data points
                                    </div>
                                    {visibleDataPoints.length > 0 && (
                                        <div className="mt-1 text-xs font-medium text-gray-400">
                                            {(visibleDataPoints[0] as { displayTime?: string, date: string }).displayTime || new Date(visibleDataPoints[0].date).toLocaleString()} to {(visibleDataPoints[visibleDataPoints.length - 1] as { displayTime?: string, date: string }).displayTime || new Date(visibleDataPoints[visibleDataPoints.length - 1].date).toLocaleString()}
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                        <button 
                            className={`px-3 py-1 rounded-md border border-gray-300 flex items-center ${viewWindow.end >= currentData.length - 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50 hover:border-blue-300 text-blue-600 transition-colors duration-200'}`}
                            onClick={() => scrollChart('right')}
                            disabled={viewWindow.end >= currentData.length - 1}
                        >
                            Next
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* Timeline slider (if we have enough data to make it useful) */}
                    {currentData.length > windowSize && (
                        <div className="mb-4 px-2">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={sliderPosition}
                                onChange={(e) => jumpToPosition(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    )}

                    <div className="h-[400px] relative" ref={chartContainerRef}>
                        <div className="absolute top-2 right-2 flex space-x-2 z-10">
                            <button 
                                className="p-2 bg-gray-50 border border-gray-300 rounded-md hover:bg-blue-50 hover:border-blue-300 focus:outline-none transition-colors duration-200"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log("Time interval zoom in clicked");
                                    handleTimeIntervalZoom(true);
                                }}
                                title="Zoom in (reduce time interval)"
                                type="button"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <button 
                                className="p-2 bg-gray-50 border border-gray-300 rounded-md hover:bg-blue-50 hover:border-blue-300 focus:outline-none transition-colors duration-200"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log("Time interval zoom out clicked");
                                    handleTimeIntervalZoom(false);
                                }}
                                title="Zoom out (increase time interval)"
                                type="button"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={formattedData}
                                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                                onMouseMove={(e) => {
                                    // This ensures all data points are considered during hover
                                    if (e && e.activeTooltipIndex) {
                                        // The chart will automatically handle tooltip display
                                    }
                                }}
                            >
                                <defs>
                                    <linearGradient id="mcxLineGradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#3B82F6" />
                                        <stop offset="100%" stopColor="#60A5FA" />
                                    </linearGradient>

                                    {/* Vertical gradient for area fill */}
                                    <linearGradient id="mcxAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                                        <stop offset="30%" stopColor="#60A5FA" stopOpacity={0.7} />
                                        <stop offset="95%" stopColor="#DBEAFE" stopOpacity={0.2} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#E5E7EB"
                                />

                                <XAxis 
                                    dataKey="date"
                                    hide={true}
                                />

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
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}