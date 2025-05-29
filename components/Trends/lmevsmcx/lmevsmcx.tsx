'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, 
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
    timeValue?: number; // For X-axis positioning
}

// Define combined stats interface
interface CombinedStats {
    min: number;
    max: number;
}

// Define month names response interface
interface MonthNamesResponse {
    success: boolean;
    data?: {
        currentMonth: string;
        nextMonth: string;
        thirdMonth: string;
        rawLabels?: {
            currentMonth: string;
            nextMonth: string;
            thirdMonth: string;
        }
    };
    message?: string;
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

// Empty tooltip component to hide price display
const CustomTooltip = ({ active, payload }: TooltipProps) => {
    return null; // Return null to hide the tooltip
};

const LMEvsMCXChart: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [lmeData, setLmeData] = useState<DataItem[]>([]);
    const [mcxData, setMcxData] = useState<DataItem[]>([]);
    const [stats, setStats] = useState<{ min: number, max: number, avg: number, startPrice?: number, endPrice?: number, totalChange?: number, totalChangePercent?: number }>({ min: 0, max: 0, avg: 0 });
    const [combinedStats, setCombinedStats] = useState<CombinedStats>({ min: 0, max: 0 });
    const [mcxMonthName, setMcxMonthName] = useState<string>('MCX Current Month');
    const [showLme, setShowLme] = useState<boolean>(true); // Whether to show LME data
    const [activeMcxButton, setActiveMcxButton] = useState<string>('current'); // Track which MCX button is active
    const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
    const [hoveredValue, setHoveredValue] = useState<number | null>(null);
    const [hoveredTime, setHoveredTime] = useState<string | null>(null);
    const [priceDifference, setPriceDifference] = useState<number | null>(null);
    const [usdPriceDifference, setUsdPriceDifference] = useState<number | null>(null);
    const [sbiRate, setSbiRate] = useState<number | null>(null);
    const [monthNames, setMonthNames] = useState<{
        currentMonth: string;
        nextMonth: string;
        thirdMonth: string;
    }>({ 
        currentMonth: 'MCX Current', 
        nextMonth: 'MCX Next', 
        thirdMonth: 'MCX Third' 
    });
    const chartContainerRef = useRef<HTMLDivElement>(null);
    
    // Function to determine if we're currently within trading hours and not on a weekend
    const getTradingStatus = () => {
        const now = new Date();
        const hours = now.getUTCHours();
        const minutes = now.getUTCMinutes();
        const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        // Check if it's a weekend (Saturday = 6 or Sunday = 0)
        const isWeekend = day === 0 || day === 6;
        
        // Trading hours: 9:00 AM to 11:30 PM (9:00 to 23:30) on weekdays only
        const isWithinTradingHours = (
            !isWeekend && // Not a weekend
            (hours > 9 || (hours === 9 && minutes >= 0)) && // After or at 9:00 AM
            (hours < 23 || (hours === 23 && minutes <= 30)) // Before or at 11:30 PM (23:30)
        );
        
        // Before trading hours starts
        const isBeforeTradingHours = !isWeekend && (hours < 9 || (hours === 9 && minutes < 0));
        
        console.log(`Current time: ${now.toISOString()}, UTC Hours: ${hours}, Minutes: ${minutes}, Day: ${day}`);
        console.log(`Is weekend: ${isWeekend}, Is within trading hours: ${isWithinTradingHours}, Is before trading hours: ${isBeforeTradingHours}`);
        
        return { isWithinTradingHours, isBeforeTradingHours, isWeekend };
    };
    
    // Function to fetch SBI exchange rate
    const fetchSbiRate = async () => {
        try {
            console.log('Fetching SBI exchange rate from /api/sbitt');
            
            const response = await fetch('/api/sbitt');
            
            if (!response.ok) {
                throw new Error(`Failed to fetch SBI rate: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('SBI API response:', result);
            
            if (result.success && result.data && result.data.length > 0) {
                // The API returns the rate in the sbi_tt_sell field
                const rateStr = result.data[0].sbi_tt_sell;
                console.log('Raw SBI TT sell rate:', rateStr);
                
                // Parse the rate to a number
                const rate = parseFloat(rateStr);
                
                if (!isNaN(rate) && rate > 0) {
                    console.log(`SBI TT Sell Rate (parsed): ${rate}`);
                    setSbiRate(rate);
                    return rate;
                } else {
                    console.warn('Invalid SBI rate received:', rateStr);
                    return null;
                }
            } else {
                console.warn('No SBI rate data available');
                return null;
            }
        } catch (error) {
            console.error('Error fetching SBI rate:', error);
            return null;
        }
    };
    
    // Function to fetch LME data
    const fetchLmeData = async () => {
        try {
            setLoading(true);
            setError(null); // Clear any previous errors
            
            console.log('Fetching LME data from /api/lme-trends');
            
            // Fetch data from the API
            const response = await fetch('/api/lme-trends');
            
            if (!response.ok) {
                throw new Error(`Failed to fetch LME data: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('LME API response:', result);
            
            if (result.success) {
                console.log(`Received ${result.data.length} LME data points from API`);
                
                // Process LME data
                const processedData = result.data.map((point: any) => {
                    try {
                        // LME API returns 'time' instead of 'createdAt'
                        const timeField = point.time || point.createdAt;
                        const dateObj = new Date(timeField);
                        
                        if (isNaN(dateObj.getTime())) {
                            console.warn('Invalid date in LME data:', timeField);
                            return null; // Skip invalid data points
                        }
                        
                        // Extract UTC hours and minutes to maintain consistency
                        const utcHours = dateObj.getUTCHours();
                        const utcMinutes = dateObj.getUTCMinutes();
                        
                        // Calculate timeValue for X-axis positioning (9.0 to 23.5)
                        const timeValue = utcHours + (utcMinutes / 60);
                        
                        // Only include data points within our trading hours (9:00 to 23:30)
                        if (timeValue < 9 || timeValue > 23.5) {
                            console.log(`Skipping LME data point outside trading hours: ${timeValue}`);
                            return null;
                        }
                        
                        // Format displayTime consistently
                        const hours12 = utcHours % 12 || 12;
                        const ampm = utcHours >= 12 ? 'PM' : 'AM';
                        const formattedTime = `${hours12}:${utcMinutes < 10 ? '0' + utcMinutes : utcMinutes} ${ampm}`;
                        
                        // Create a properly formatted data point that matches MCX structure
                        return {
                            createdAt: timeField,
                            date: dateObj.toISOString().split('T')[0],
                            value: point.value || 0,
                            displayTime: formattedTime,
                            timeValue: timeValue
                        };
                    } catch (error) {
                        console.error('Error processing LME date:', error);
                        return null;
                    }
                }).filter(Boolean); // Remove any null values
                
                console.log(`Processed ${processedData.length} LME data points`);
                if (processedData.length > 0) {
                    console.log('Sample LME data:', processedData[0]);
                }
                
                // Set the LME data
                setLmeData(processedData);
                
                // Update combined stats and calculate price difference
                updateCombinedStats(processedData, mcxData);
                calculatePriceDifference(processedData, mcxData);
            } else {
                throw new Error(result.message || 'Failed to fetch LME data');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch LME data';
            setError(errorMessage);
            console.error('Error fetching LME data:', err);
        } finally {
            setLoading(false);
            setLastUpdatedTime(new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }) + ' IST');
        }
    };
    
    // Function to fetch MCX data based on the month
    const fetchMcxData = async (endpoint: string, monthType: string) => {
        try {
            setLoading(true);
            setError(null); // Clear any previous errors
            
            console.log(`Fetching MCX data from ${endpoint} for month type: ${monthType}`);
            
            // Fetch data from the API
            const response = await fetch(endpoint);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch MCX data: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('MCX API response:', result);
            
            if (result.success) {
                console.log(`Received ${result.data.length} MCX data points from API`);
                
                // Update month name based on the month type
                let newMonthName = 'MCX Current Month';
                if (monthType === 'current') {
                    newMonthName = result.currentMonth || 'MCX May';
                } else if (monthType === 'next') {
                    newMonthName = result.nextMonth || 'MCX June';
                } else if (monthType === 'third') {
                    newMonthName = result.thirdMonth || 'MCX July';
                }
                
                setMcxMonthName(newMonthName);
                
                // The API now handles the time filtering appropriately (9:00 AM to 11:30 PM)
                const filteredData = result.data;
                console.log(`Using all ${filteredData.length} MCX data points from API`);
                
                // Convert createdAt strings to timestamps for the X-axis with error handling
                const processedData = filteredData.map((point: DataItem) => {
                    try {
                        // Make sure we have a valid date
                        const dateObj = new Date(point.createdAt);
                        // Check if date is valid before using it
                        if (isNaN(dateObj.getTime())) {
                            console.warn('Invalid date found:', point.createdAt);
                            // Use current time as fallback for invalid dates
                            return {
                                ...point,
                                createdAt: Date.now()
                            };
                        }
                        
                        // Extract UTC hours and minutes to maintain consistency
                        const utcHours = dateObj.getUTCHours();
                        const utcMinutes = dateObj.getUTCMinutes();
                        
                        // Calculate a numeric value for X-axis positioning (9.0 to 23.5)
                        // This maps 9:00 to 9.0, 9:30 to 9.5, 10:00 to 10.0, etc.
                        const timeValue = utcHours + (utcMinutes / 60);
                        
                        // Format as 12-hour time with AM/PM for display
                        const hours12 = utcHours % 12 || 12;
                        const ampm = utcHours >= 12 ? 'PM' : 'AM';
                        const formattedTime = `${hours12}:${utcMinutes < 10 ? '0' + utcMinutes : utcMinutes} ${ampm}`;
                        
                        // Also create a 24-hour format for internal use
                        const formattedTime24 = `${utcHours}:${utcMinutes < 10 ? '0' + utcMinutes : utcMinutes}`;
                        
                        return {
                            ...point,
                            createdAt: dateObj.getTime(),
                            displayTime: formattedTime,
                            timeValue: timeValue // Add the numeric time value for X-axis positioning
                        };
                    } catch (error) {
                        console.error('Error processing date:', error);
                        // Use current time as fallback
                        return {
                            ...point,
                            createdAt: Date.now()
                        };
                    }
                });
                
                // Log the first and last data points for debugging
                if (processedData.length > 0) {
                    try {
                        const firstPoint = processedData[0];
                        const lastPoint = processedData[processedData.length - 1];
                        
                        // Safe date logging with error handling
                        const logDateInfo = (point: { createdAt: number; value: number }, label: string) => {
                            try {
                                const dateObj = new Date(point.createdAt);
                                console.log(`${label}:`, {
                                    timestamp: point.createdAt,
                                    value: point.value,
                                    utcHours: dateObj.getUTCHours(),
                                    utcMinutes: dateObj.getUTCMinutes()
                                });
                            } catch (error) {
                                console.error(`Error logging ${label}:`, error);
                            }
                        };
                        
                        logDateInfo(firstPoint, 'First data point');
                        logDateInfo(lastPoint, 'Last data point');
                    } catch (error) {
                        console.error('Error logging data points:', error);
                    }
                }
                
                console.log(`Filtered to ${filteredData.length} data points within trading hours`);
                
                // Log some sample data points for debugging
                if (filteredData.length > 0) {
                    console.log('First data point:', filteredData[0]);
                    console.log('Last data point:', filteredData[filteredData.length - 1]);
                }
                
                // Make sure all data points have timeValue for proper X-axis positioning
                const dataWithTimeValues = filteredData.map((point: DataItem) => {
                    // Create a new object instead of modifying the existing one
                    const newPoint = { ...point };
                    
                    if (!newPoint.timeValue && newPoint.createdAt) {
                        // If timeValue is missing but we have createdAt, calculate it
                        try {
                            const dateObj = new Date(newPoint.createdAt);
                            if (!isNaN(dateObj.getTime())) {
                                const utcHours = dateObj.getUTCHours();
                                const utcMinutes = dateObj.getUTCMinutes();
                                newPoint.timeValue = utcHours + (utcMinutes / 60);
                            }
                        } catch (error) {
                            console.error('Error calculating timeValue:', error);
                        }
                    }
                    return newPoint;
                });

                // Set the MCX data
                setMcxData(dataWithTimeValues);
                
                // Update combined stats and calculate price difference
                updateCombinedStats(lmeData, dataWithTimeValues);
                calculatePriceDifference(lmeData, dataWithTimeValues);
                
                // Recalculate stats if we filtered out any data points
                if (filteredData.length !== result.data.length && filteredData.length > 0) {
                    const prices = filteredData.map((item: DataItem) => item.value);
                    const newStats = {
                        min: Math.min(...prices) * 0.995, // 0.5% below min
                        max: Math.max(...prices) * 1.005, // 0.5% above max
                        avg: prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length,
                        startPrice: filteredData[0].value,
                        endPrice: filteredData[filteredData.length - 1].value,
                        totalChange: filteredData[filteredData.length - 1].value - filteredData[0].value,
                        totalChangePercent: ((filteredData[filteredData.length - 1].value - filteredData[0].value) / filteredData[0].value) * 100
                    };
                    setStats(newStats);
                } else if (result.stats) {
                    console.log('Stats from API:', result.stats);
                    setStats({
                        min: result.stats.minPrice * 0.995, // 0.5% below min
                        max: result.stats.maxPrice * 1.005, // 0.5% above max
                        avg: result.stats.avgPrice,
                        startPrice: result.stats.startPrice,
                        endPrice: result.stats.endPrice,
                        totalChange: result.stats.totalChange,
                        totalChangePercent: result.stats.totalChangePercent
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
            setLastUpdatedTime(new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }) + ' IST');
        }
    };
    
    // Handle LME button click to toggle LME data visibility
    const handleLmeButtonClick = () => {
        setShowLme(!showLme);
        if (!lmeData.length) {
            fetchLmeData();
        } else {
            // Recalculate price difference when toggling LME visibility
            calculatePriceDifference(lmeData, mcxData);
        }
    };
    
    // Handle MCX button click to change the active MCX month
    const handleMcxButtonClick = (monthType: string, endpoint: string) => {
        setActiveMcxButton(monthType);
        fetchMcxData(endpoint, monthType);
        // Price difference will be recalculated after data is fetched
    };
    
    // Function to update combined stats for both LME and MCX data
    const updateCombinedStats = (lmeData: DataItem[], mcxData: DataItem[]) => {
        if (lmeData.length === 0 && mcxData.length === 0) return;
        
        // Get all values from both datasets
        const lmeValues = lmeData.map(item => item.value);
        const mcxValues = mcxData.map(item => item.value);
        const allValues = [...lmeValues, ...mcxValues];
        
        if (allValues.length === 0) return;
        
        // Calculate min and max with extra padding
        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        
        // Add 15% padding to both top and bottom
        const range = maxValue - minValue;
        const paddedMin = Math.max(0, minValue - (range * 0.15)); // Ensure min is not negative
        const paddedMax = maxValue + (range * 0.15);
        
        console.log(`Combined stats - Min: ${paddedMin}, Max: ${paddedMax}`);
        
        setCombinedStats({
            min: paddedMin,
            max: paddedMax
        });
    };
    
    // Function to calculate the price difference between MCX and LME
    const calculatePriceDifference = (lmeData: DataItem[], mcxData: DataItem[]) => {
        try {
            if (!lmeData || !mcxData || !Array.isArray(lmeData) || !Array.isArray(mcxData)) {
                console.log('Invalid data types for price difference calculation');
                setPriceDifference(null);
                setUsdPriceDifference(null);
                return;
            }
            
            if (lmeData.length === 0 || mcxData.length === 0) {
                console.log('Empty datasets for price difference calculation');
                setPriceDifference(null);
                setUsdPriceDifference(null);
                return;
            }
            
            // Get the latest values from both datasets
            const latestLmeValue = lmeData[lmeData.length - 1]?.value || 0;
            const latestMcxValue = mcxData[mcxData.length - 1]?.value || 0;
            
            if (typeof latestLmeValue !== 'number' || typeof latestMcxValue !== 'number') {
                console.log('Invalid value types for price difference calculation');
                setPriceDifference(null);
                setUsdPriceDifference(null);
                return;
            }
            
            // Calculate the difference (MCX - LME) and take the absolute value
            const difference = Math.abs(latestMcxValue - latestLmeValue);
            
            // Only update if the difference is a valid number
            if (!isNaN(difference) && isFinite(difference)) {
                // Set the INR difference
                setPriceDifference(difference);
                console.log(`Price difference calculated - Latest LME: ${latestLmeValue}, Latest MCX: ${latestMcxValue}, Absolute Difference: ${difference}`);
                
                // Calculate USD difference immediately if SBI rate is available
                const calculateUsdDifference = (rate: number) => {
                    if (rate > 0) {
                        // Calculate USD difference by dividing INR difference by SBI TT rate
                        const usdDifference = difference / rate;
                        // Round to 2 decimal places for better display
                        const roundedUsdDifference = Math.round(usdDifference * 100) / 100;
                        setUsdPriceDifference(roundedUsdDifference);
                        console.log(`USD Price difference calculated - INR Diff: ${difference}, SBI Rate: ${rate}, USD Diff: ${roundedUsdDifference}`);
                        return true;
                    }
                    return false;
                };
                
                // First try with existing SBI rate
                if (sbiRate && sbiRate > 0) {
                    calculateUsdDifference(sbiRate);
                } else {
                    // If no SBI rate available, fetch it
                    console.log('SBI rate not available, fetching it now...');
                    fetchSbiRate()
                        .then(rate => {
                            if (rate && rate > 0) {
                                calculateUsdDifference(rate);
                            } else {
                                // If we still can't get a valid rate, try one more time
                                console.warn('First attempt to get SBI rate failed, trying again...');
                                setTimeout(() => {
                                    fetchSbiRate()
                                        .then(retryRate => {
                                            if (retryRate && retryRate > 0) {
                                                calculateUsdDifference(retryRate);
                                            } else {
                                                console.warn('Could not get valid SBI rate for USD conversion after retry');
                                                setUsdPriceDifference(null);
                                            }
                                        })
                                        .catch(error => {
                                            console.error('Error fetching SBI rate on retry:', error);
                                            setUsdPriceDifference(null);
                                        });
                                }, 1000); // Wait 1 second before retrying
                            }
                        })
                        .catch(error => {
                            console.error('Error fetching SBI rate for USD conversion:', error);
                            setUsdPriceDifference(null);
                        });
                }
            } else {
                console.warn('Invalid difference calculation result:', difference);
                setPriceDifference(null);
                setUsdPriceDifference(null);
            }
        } catch (error) {
            console.error('Error calculating price difference:', error);
            setPriceDifference(null);
            setUsdPriceDifference(null);
        }
    };
    
    // Fetch month names from the API
    const fetchMonthNames = async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            const response = await fetch('/api/mcx_month_names', {
                signal: controller.signal
            }).finally(() => clearTimeout(timeoutId));
            
            if (!response.ok) {
                throw new Error(`Failed to fetch month names: ${response.status}`);
            }
            
            const data: MonthNamesResponse = await response.json();
            
            if (data.success && data.data) {
                // Use a safe approach to set month names
                const safeMonthNames = {
                    currentMonth: data.data.currentMonth || 'MCX Current',
                    nextMonth: data.data.nextMonth || 'MCX Next',
                    thirdMonth: data.data.thirdMonth || 'MCX Third'
                };
                
                // Only update state if the component is still mounted
                setMonthNames(safeMonthNames);
                console.log('Month names fetched successfully:', safeMonthNames);
                return safeMonthNames;
            } else {
                console.warn('Month names API returned success=false or no data');
                return null;
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                console.warn('Month names fetch timed out');
            } else {
                console.error('Error fetching month names:', err);
            }
            return null;
        }
    };

    // Function to fetch SBI exchange rate is already defined above

    // Fetch SBI rate when component mounts
    useEffect(() => {
        // Check if today is a weekend before fetching SBI rate
        const now = new Date();
        const day = now.getUTCDay();
        const isWeekend = day === 0 || day === 6;
        
        if (!isWeekend) {
            fetchSbiRate();
        } else {
            console.log(`Today is a weekend (day ${day}). No SBI rate will be fetched.`);
        }
                        
        // Set up interval to refresh SBI rate every 30 minutes
        const sbiRateInterval = setInterval(() => {
            const currentDate = new Date();
            const currentDay = currentDate.getUTCDay();
            const isCurrentlyWeekend = currentDay === 0 || currentDay === 6;

            if (!isCurrentlyWeekend) {
                fetchSbiRate();
            } else {
                console.log(`Current day is a weekend (day ${currentDay}). No SBI rate will be refreshed.`);
            }
        }, 30 * 60 * 1000); // 30 minutes

        return () => clearInterval(sbiRateInterval);
    }, []);

    // Initial data fetch on component mount
    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();
        
        const fetchInitialData = async () => {
            if (!isMounted) {
                return;
            }
            setLoading(true);
            setError('');
            
            // First, fetch the SBI TT rate to ensure it's available for all calculations
            try {
                console.log('Fetching initial SBI TT rate...');
                const initialRate = await fetchSbiRate();
                console.log('Initial SBI TT rate fetched:', initialRate);
            } catch (error) {
                console.error('Error fetching initial SBI TT rate:', error);
                // Continue with the rest of the data fetching even if SBI rate fails
            }

            // Check if today is a weekend (Saturday = 6 or Sunday = 0)
            const today = new Date();
            const dayOfWeek = today.getUTCDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            if (isWeekend) {
                console.log(`Today is a weekend (day ${dayOfWeek}). No data will be fetched.`);
                setLoading(false);
                // Clear any existing data to ensure no trends are shown on weekends
                setLmeData([]);
                setMcxData([]);
                return;
            }
            
            // Fetch month names first with a timeout
            const monthNamesResult = await fetchMonthNames();
            if (!isMounted) return;
            
            try {
                
                // Create promises for both data fetches with timeouts
                const fetchWithTimeout = async (url: string, timeoutMs = 10000) => {
                    const timeoutController = new AbortController();
                    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
                    
                    try {
                        const response = await fetch(url, { signal: timeoutController.signal });
                        return response;
                    } finally {
                        clearTimeout(timeoutId);
                    }
                };
                
                // Wait for both requests to complete
                const [lmeResponse, mcxResponse] = await Promise.all([
                    fetchWithTimeout('/api/lme-data'),
                    fetchWithTimeout('/api/mcx_current_month')
                ]);
                
                if (!isMounted) return;
                
                if (!lmeResponse.ok) {
                    throw new Error(`Failed to fetch LME data: ${lmeResponse.status}`);
                }
                
                if (!mcxResponse.ok) {
                    throw new Error(`Failed to fetch MCX data: ${mcxResponse.status}`);
                }
                
                // Parse the JSON responses
                const lmeResult = await lmeResponse.json();
                const mcxResult = await mcxResponse.json();
                
                if (!isMounted) return;
                
                console.log('Initial data loaded - LME:', lmeResult.data?.length || 0, 'MCX:', mcxResult.data?.length || 0);
                
                // Process LME data
                if (lmeResult.success && Array.isArray(lmeResult.data) && lmeResult.data.length > 0) {
                    try {
                        const processedLmeData = lmeResult.data
                            .map((point: any) => {
                                try {
                                    if (!point) return null;
                                    
                                    const timeField = point.time || point.createdAt;
                                    if (!timeField) return null;
                                    
                                    const dateObj = new Date(timeField);
                                    if (isNaN(dateObj.getTime())) return null;
                                    
                                    // Check if it's a weekend (Saturday = 6 or Sunday = 0)
                                    const day = dateObj.getUTCDay();
                                    if (day === 0 || day === 6) return null; // Skip weekend data
                                    
                                    const utcHours = dateObj.getUTCHours();
                                    const utcMinutes = dateObj.getUTCMinutes();
                                    const timeValue = utcHours + (utcMinutes / 60);
                                    
                                    if (timeValue < 9 || timeValue > 23.5) return null;
                                    
                                    const hours12 = utcHours % 12 || 12;
                                    const ampm = utcHours >= 12 ? 'PM' : 'AM';
                                    const formattedTime = `${hours12}:${utcMinutes < 10 ? '0' + utcMinutes : utcMinutes} ${ampm}`;
                                    
                                    const value = typeof point.value === 'number' ? point.value : parseFloat(point.value);
                                    if (isNaN(value)) return null;
                                    
                                    return {
                                        createdAt: timeField,
                                        date: dateObj.toISOString().split('T')[0],
                                        value: value,
                                        displayTime: formattedTime,
                                        timeValue: timeValue
                                    };
                                } catch (error) {
                                    console.warn('Error processing LME data point:', error);
                                    return null;
                                }
                            })
                            .filter(Boolean);
                        
                        if (processedLmeData.length > 0) {
                            if (isMounted) setLmeData(processedLmeData);
                        } else {
                            console.warn('No valid LME data points after processing');
                        }
                    } catch (error) {
                        console.error('Error processing LME data:', error);
                    }
                } else {
                    console.warn('Invalid or empty LME data received');
                }
                
                // Process MCX data
                if (mcxResult.success && Array.isArray(mcxResult.data) && mcxResult.data.length > 0) {
                    try {
                        const processedMcxData = mcxResult.data
                            .map((point: any) => {
                                try {
                                    if (!point) return null;
                                    
                                    // Create a new point object with validated properties
                                    const newPoint: DataItem = {
                                        createdAt: point.createdAt || '',
                                        date: point.date || '',
                                        value: typeof point.value === 'number' ? point.value : parseFloat(point.value),
                                        displayTime: point.displayTime || ''
                                    };
                                    
                                    // Skip invalid values
                                    if (isNaN(newPoint.value)) return null;
                                    
                                    // Calculate timeValue if not present
                                    if (!point.timeValue && point.createdAt) {
                                        const dateObj = new Date(point.createdAt);
                                        if (!isNaN(dateObj.getTime())) {
                                            // Check if it's a weekend (Saturday = 6 or Sunday = 0)
                                            const day = dateObj.getUTCDay();
                                            if (day === 0 || day === 6) return null; // Skip weekend data
                                            
                                            const utcHours = dateObj.getUTCHours();
                                            const utcMinutes = dateObj.getUTCMinutes();
                                            
                                            // Skip data outside trading hours (9:00 AM to 11:30 PM)
                                            const timeValue = utcHours + (utcMinutes / 60);
                                            if (timeValue < 9 || timeValue > 23.5) return null;
                                            
                                            newPoint.timeValue = timeValue;
                                        }
                                    } else {
                                        newPoint.timeValue = point.timeValue;
                                    }
                                    
                                    return newPoint;
                                } catch (error) {
                                    console.warn('Error processing MCX data point:', error);
                                    return null;
                                }
                            })
                            .filter(Boolean);
                        
                        if (processedMcxData.length > 0) {
                            if (isMounted) {
                                setMcxData(processedMcxData);
                                setMcxMonthName(mcxResult.currentMonth || monthNames.currentMonth || 'MCX Current');
                            }
                        } else {
                            console.warn('No valid MCX data points after processing');
                        }
                    } catch (error) {
                        console.error('Error processing MCX data:', error);
                    }
                } else {
                    console.warn('Invalid or empty MCX data received');
                }
                
                // Calculate stats and price difference directly here
                if (lmeResult.success && mcxResult.success) {
                    // Get the latest values from both datasets
                    const latestLmeValue = lmeResult.data.length > 0 ? lmeResult.data[lmeResult.data.length - 1].value : 0;
                    const latestMcxValue = mcxResult.data.length > 0 ? mcxResult.data[mcxResult.data.length - 1].value : 0;
                    
                    // Calculate the difference (MCX - LME)
                    if (latestLmeValue && latestMcxValue) {
                        // Calculate the difference (MCX - LME)
                        const difference = Math.abs(latestMcxValue - latestLmeValue);
                        console.log(`Initial price difference: ${difference} (MCX: ${latestMcxValue}, LME: ${latestLmeValue})`);
                        setPriceDifference(difference);
                        
                        // Use the SBI TT rate that was fetched at the beginning if available
                        if (sbiRate && sbiRate > 0) {
                            // Calculate USD difference directly using the available rate
                            const usdDifference = difference / sbiRate;
                            const roundedUsdDifference = Math.round(usdDifference * 100) / 100;
                            console.log(`Initial USD difference calculated with existing rate: ${roundedUsdDifference} (INR: ${difference}, Rate: ${sbiRate})`);
                            setUsdPriceDifference(roundedUsdDifference);
                        } else {
                            // If no rate is available yet, fetch it
                            console.log('No SBI rate available, fetching for initial USD difference calculation');
                            fetchSbiRate().then(rate => {
                                if (rate && rate > 0) {
                                    const usdDifference = difference / rate;
                                    const roundedUsdDifference = Math.round(usdDifference * 100) / 100;
                                    console.log(`Initial USD difference: ${roundedUsdDifference} (INR: ${difference}, Rate: ${rate})`);
                                    setUsdPriceDifference(roundedUsdDifference);
                                } else {
                                    console.warn('Could not get valid SBI rate for initial USD conversion');
                                }
                            }).catch(error => {
                                console.error('Error fetching SBI rate for initial USD conversion:', error);
                            });
                        }
                    }
                    
                    // Calculate combined stats
                    const lmeValues = lmeResult.data.map((item: any) => item.value || 0);
                    const mcxValues = mcxResult.data.map((item: any) => item.value || 0);
                    const allValues = [...lmeValues, ...mcxValues].filter(v => v > 0);
                    
                    if (allValues.length > 0) {
                        const minValue = Math.min(...allValues);
                        const maxValue = Math.max(...allValues);
                        const range = maxValue - minValue;
                        const paddedMin = Math.max(0, minValue - (range * 0.15));
                        const paddedMax = maxValue + (range * 0.15);
                        
                        setCombinedStats({
                            min: paddedMin,
                            max: paddedMax
                        });
                    }
                }
            } catch (error) {
                console.error('Error fetching initial data:', error);
                if (isMounted) {
                    setError('Failed to load data. Please try again.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                    setLastUpdatedTime(new Date().toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }) + ' IST');
                }
            }
        };
        
        // Call the async function
        fetchInitialData();
        
        // Cleanup function to prevent state updates after unmount
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, []);

    return (
        <div className="w-full p-6 bg-gray-50 rounded-2xl mt-8">
            <div className="flex flex-col space-y-6">
                {/* Title */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                        <h2 className="text-xl font-bold text-gray-800">Metal Prices Comparison</h2>
                    </div>
                </div>
                
                {/* Chart Selection Buttons */}
                <div className="flex flex-wrap items-center justify-start gap-2 md:gap-3 py-2">
                    <button
                        className={`w-full md:w-auto px-4 md:px-5 py-2 text-sm font-medium rounded-md transition-all ${showLme ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm' : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'}`}
                        onClick={handleLmeButtonClick}
                    >
                        LME
                    </button>
                    
                    {/* Vertical divider line */}
                    <div className="hidden md:block h-8 w-px bg-gray-300 mx-1"></div>
                    
                    <button
                        className={`w-full md:w-auto px-4 md:px-5 py-2 text-sm font-medium rounded-md transition-all ${activeMcxButton === 'current' ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'}`}
                        onClick={() => handleMcxButtonClick('current', '/api/mcx_current_month')}
                    >
                        {monthNames.currentMonth}
                    </button>
                    
                    <button
                        className={`w-full md:w-auto px-4 md:px-5 py-2 text-sm font-medium rounded-md transition-all ${activeMcxButton === 'next' ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'}`}
                        onClick={() => handleMcxButtonClick('next', '/api/mcx_next_month')}
                    >
                        {monthNames.nextMonth}
                    </button>
                    
                    <button
                        className={`w-full md:w-auto px-4 md:px-5 py-2 text-sm font-medium rounded-md transition-all ${activeMcxButton === 'third' ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'}`}
                        onClick={() => handleMcxButtonClick('third', '/api/mcx_third_month')}
                    >
                        {monthNames.thirdMonth}
                    </button>
                    
                    {/* MCX-LME Difference Card */}
                    <div className="flex ml-auto">
                        <div className="flex flex-col items-center justify-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-md">
                            <div className="flex items-center justify-center mb-1">
                                <span className="text-sm font-semibold text-gray-700">MCX-LME DIFF</span>
                            </div>
                            {priceDifference !== null && !isNaN(priceDifference) ? (
                                <div className="flex flex-col items-center justify-center">
                                    <div className="flex items-center justify-center">
                                        <span className="text-xl font-bold text-green-600">
                                            ₹{priceDifference.toFixed(2)}
                                        </span>
                                    </div>
                                    {usdPriceDifference !== null && !isNaN(usdPriceDifference) ? (
                                        <div className="flex items-center justify-center mt-1">
                                            <span className="text-sm font-semibold text-blue-600">
                                                ${usdPriceDifference.toFixed(2)}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center mt-1">
                                            <span className="text-sm font-medium text-gray-500">$--</span>
                                        </div>
                                    )}
                                </div>
                            ) : loading ? (
                                <div className="flex items-center justify-center">
                                    <span className="text-xl font-medium text-gray-500">Loading...</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center">
                                    <span className="text-xl font-medium text-gray-500">--</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Trading Hours Notice */}
                <div className="text-sm text-gray-600 text-center bg-gray-100 py-2 px-2 md:px-4 rounded-lg">
                    <div className="text-xs md:text-sm">
                        Metal Price Trend for {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-xs mt-1">
                        Trading Hours: 9:00 - 23:30 (9:00 AM - 11:30 PM)
                    </div>
                </div>

                {/* Chart */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-300">
                    {loading ? (
                        <div className="h-[400px] w-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : error ? (
                        <div className="h-[400px] w-full flex items-center justify-center flex-col">
                            <p className="text-red-500 mb-2">Error: {error}</p>
                            <p className="text-gray-500">Please try refreshing the data</p>
                        </div>
                    ) : (lmeData.length === 0 && mcxData.length === 0) ? (
                        <div className="h-[400px] w-full flex items-center justify-center flex-col">
                            <p className="text-gray-500 mb-2">No metal price data available.</p>
                            <p className="text-gray-500 text-sm">
                                {new Date().getUTCDay() === 0 || new Date().getUTCDay() === 6 
                                    ? 'Trading is closed on weekends. Check back on Monday after 9:00 AM.' 
                                    : 'Trading hours are from 9:00 AM to 11:30 PM on weekdays.'}
                            </p>
                        </div>
                    ) : (
                        <div className="h-[400px] w-full" ref={chartContainerRef}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart 
                                    margin={{ top: 10, right: 10, left: 10, bottom: 30 }}
                                >
                                    <defs>
                                        {/* Gradient for LME data (Green) */}
                                        <linearGradient id="lmeLineGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#047857" stopOpacity={1} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.8} />
                                        </linearGradient>
                                        <linearGradient id="lmeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#047857" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                        
                                        {/* Gradient for MCX data (Blue) */}
                                        <linearGradient id="mcxLineGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563EB" stopOpacity={1} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.8} />
                                        </linearGradient>
                                        <linearGradient id="mcxAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>

                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />

                                    <YAxis
                                        domain={[combinedStats.min, combinedStats.max]}
                                        tick={{ fontSize: 12, fill: '#6B7280' }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={50}
                                        tickFormatter={(value) => `₹${value.toFixed(0)}`}
                                        allowDataOverflow={false}
                                    />
                                    
                                    <XAxis
                                        type="number"
                                        dataKey="timeValue"
                                        domain={[9, 23.5]} // Fixed domain from 9:00 to 23:30
                                        axisLine={{ stroke: '#E5E7EB' }}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: '#6B7280' }}
                                        ticks={[9, 11, 13, 15, 17, 19, 21, 23]} // Reduced number of ticks for better spacing
                                        tickFormatter={(value) => {
                                            // Convert numeric value to time string
                                            const hour24 = Math.floor(value);
                                            const hour12 = hour24 % 12 || 12;
                                            const ampm = hour24 >= 12 ? 'PM' : 'AM';
                                            return `${hour12}${ampm}`;
                                        }}
                                        padding={{ left: 10, right: 10 }}
                                        allowDataOverflow={true}
                                        scale="linear"
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
                                    {/* LME Area */}
                                    {showLme && lmeData.length > 0 && (
                                        <Area
                                            type="linear" // Use linear for both LME and MCX to make them pointed
                                            dataKey="value"
                                            data={lmeData}
                                            stroke="url(#lmeLineGradient)"
                                            strokeWidth={2.5}
                                            fill="url(#lmeAreaGradient)"
                                            fillOpacity={1}
                                            animationDuration={1500}
                                            animationEasing="ease-in-out"
                                            dot={false} // Hide regular dots on the line
                                            activeDot={false} // Don't show dots when hovering
                                            isAnimationActive={true}
                                            connectNulls={true}
                                            name="LME Price"
                                        />
                                    )}
                                    
                                    {/* MCX Area */}
                                    {mcxData.length > 0 && (
                                        <Area
                                            type="linear" // Use linear for both LME and MCX to make them pointed
                                            dataKey="value"
                                            data={mcxData}
                                            stroke="url(#mcxLineGradient)"
                                            strokeWidth={2.5}
                                            fill="url(#mcxAreaGradient)"
                                            fillOpacity={1}
                                            animationDuration={1500}
                                            animationEasing="ease-in-out"
                                            dot={false} // Hide regular dots on the line
                                            activeDot={false} // Don't show dots when hovering
                                            isAnimationActive={true}
                                            connectNulls={true}
                                            name="MCX Price"
                                        />
                                    )}
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
