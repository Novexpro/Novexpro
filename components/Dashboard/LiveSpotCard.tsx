'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, TrendingUp, TrendingDown, BarChart3, Calendar, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface LiveSpotCardProps {
    lastUpdated?: Date;
    spotPrice?: number;
    change?: number;
    changePercent?: number;
    unit?: string;
    isDerived?: boolean;
    apiUrl?: string;
    title?: string;
}

// Updated interface to match the API response structure
interface ApiResponse {
    type: 'spotPrice' | 'cashSettlement' | 'noData' | 'averagePrice';
    spotPrice?: number;
    change?: number;
    changePercent?: number;
    lastUpdated?: string;
    cashSettlement?: number;
    dateTime?: string;
    message?: string;
    dataPointsCount?: number;
    averagePrice?: number; // For average price data
    lastCashSettlementPrice?: number; // For cash settlement price comparison
    fresh?: boolean;
    source?: string;
    error?: string;
}

export default function LiveSpotCard({
    lastUpdated,
    spotPrice = 2700.00,
    change = 13.00,
    changePercent = 0.48,
    unit = '/MT',
    isDerived = false,
    apiUrl = '/api/average-price',
    title = 'Live Spot Price',
}: LiveSpotCardProps) {
    const [priceData, setPriceData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dataPointsCount, setDataPointsCount] = useState<number>(0);
    
    // Use a ref to prevent flickering during updates
    const dataRef = useRef<ApiResponse | null>(null);

    // Use useMemo for functions that don't need to be recreated on every render
    const getUrlWithTimestamp = useMemo(() => {
        return (url: string) => {
            const separator = url.includes('?') ? '&' : '?';
            return `${url}${separator}_t=${Date.now()}`;
        };
    }, []);

    useEffect(() => {
        const fetchWithRetry = async (url: string, retries = 2, retryDelay = 2000) => {
            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000);
                    
                    console.log(`Fetching data from ${url}, attempt ${attempt + 1}/${retries + 1}`);
                    
                    // Add timestamp to URL to prevent caching
                    const urlWithTimestamp = getUrlWithTimestamp(url);
                    const response = await fetch(urlWithTimestamp, {
                        signal: controller.signal,
                        headers: {
                            'Cache-Control': 'no-cache, no-store, must-revalidate',
                            'Pragma': 'no-cache',
                        }
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        throw new Error(`API responded with status ${response.status}`);
                    }
                    
                    return await response.json();
                } catch (error) {
                    if (attempt === retries) {
                        throw error; // Rethrow if we're out of retries
                    }
                    
                    console.log(`Attempt ${attempt + 1} failed, retrying in ${retryDelay}ms...`);
                    await new Promise(r => setTimeout(r, retryDelay));
                    // Increase delay for next retry (exponential backoff)
                    retryDelay = retryDelay * 1.5;
                }
            }
            
            throw new Error('All retry attempts failed');
        };
        
        const fetchPriceData = async () => {
            try {
                // Only show loading on initial load, not during updates
                if (!dataRef.current) {
                    setLoading(true);
                }
                setError(null); // Reset error state at start of fetch
                
                try {
                    // Use the retry mechanism
                    const data = await fetchWithRetry(apiUrl);
                    
                    if (data.type === 'noData') {
                        setError(data.message || 'No price data available');
                        if (!dataRef.current) {
                            setLoading(false);
                        }
                        return;
                    }
                    
                    // If we have average price and last cash settlement price, calculate changes based on those
                    if (data.type === 'averagePrice' && data.lastCashSettlementPrice && data.averagePrice) {
                        const lastPrice = data.lastCashSettlementPrice;
                        const currentAvg = data.averagePrice;
                        data.change = currentAvg - lastPrice;
                        data.changePercent = (data.change / lastPrice) * 100;
                    }
                    
                    // Avoid unnecessary re-renders by comparing data
                    const isSignificantChange = !dataRef.current || 
                        dataRef.current.type !== data.type ||
                        (data.type === 'averagePrice' && dataRef.current.averagePrice !== data.averagePrice) ||
                        (data.type === 'spotPrice' && 
                         dataRef.current.spotPrice !== undefined && 
                         data.spotPrice !== undefined && 
                         Math.abs(dataRef.current.spotPrice - data.spotPrice) > 0.01);
                    
                    if (isSignificantChange) {
                        dataRef.current = data;
                        setPriceData(data);
                        
                        // Store the data points count if available
                        if (data.type === 'averagePrice' && data.dataPointsCount) {
                            setDataPointsCount(data.dataPointsCount);
                        }
                    }
                    
                    setError(null);
                } catch (fetchErr: unknown) {
                    console.error('Fetch error after retries:', fetchErr);
                    
                    if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
                        setError('Request timed out. Please try again later.');
                    } else {
                        setError('Failed to load data. Please try again.');
                    }
                    
                    // Use fallback data if API fails and we're looking for average price
                    if (apiUrl.includes('/api/average-price') && !dataRef.current) {
                        const fallbackData: ApiResponse = {
                            type: 'averagePrice',
                            averagePrice: spotPrice,
                            change: change,
                            changePercent: changePercent,
                            lastUpdated: new Date().toISOString(),
                            dataPointsCount: 0,
                            message: 'Using fallback data due to API failure',
                        };
                        dataRef.current = fallbackData;
                        setPriceData(fallbackData);
                    }
                }
            } catch (err) {
                console.error('Error in fetchPriceData:', err);
                setError('An unexpected error occurred');
            } finally {
                setLoading(false);
            }
        };

        // Fetch data immediately
        fetchPriceData();
        
        // Set up polling with a longer interval to reduce server load and prevent flickering
        // Increased interval significantly to reduce flickering while still getting updates
        const intervalId = setInterval(fetchPriceData, 10 * 60 * 1000); // 10 minutes
        
        // Clean up interval on component unmount
        return () => clearInterval(intervalId);
    }, [apiUrl, spotPrice, change, changePercent, isDerived, title, unit]);

    // Render optimizations with useMemo to avoid unnecessary re-renders
    const cardContent = useMemo(() => {
        // Determine if we're showing average price
        const isAveragePrice = priceData?.type === 'averagePrice';
        
        // Only calculate values if we have data
        if (!priceData) {
            return { loading, error, isAveragePrice };
        }
        
        // Use API data if available, otherwise use props
        const displayTime = (() => {
            try {
                // First try to parse the date from priceData
                if (priceData?.lastUpdated) {
                    const parsedDate = parseISO(priceData.lastUpdated);
                    // Verify the date is valid
                    if (!isNaN(parsedDate.getTime())) {
                        return parsedDate;
                    }
                    console.error('Invalid date from API:', priceData.lastUpdated);
                }
                
                // If lastUpdated prop is available and valid, use it
                if (lastUpdated && !isNaN(lastUpdated.getTime())) {
                    return lastUpdated;
                }
                
                // If all else fails, return current date
                return new Date();
            } catch (err) {
                console.error('Error parsing date:', err);
                return new Date(); // Fallback to current date on parse error
            }
        })();
        
        // Prioritize average price when available (for averagePrice type)
        const currentSpotPrice = (() => {
            try {
                return priceData?.type === 'averagePrice' && priceData?.averagePrice !== undefined
                    ? priceData.averagePrice
                    : priceData?.spotPrice !== undefined
                        ? priceData.spotPrice 
                        : spotPrice;
            } catch (err) {
                console.error('Error calculating spot price:', err);
                return spotPrice; // Fallback to props on error
            }
        })();
            
        const currentChange = (() => {
            try {
                return priceData?.change !== undefined ? priceData.change : change;
            } catch (err) {
                console.error('Error calculating change:', err);
                return change; // Fallback to props on error
            }
        })();
            
        const currentChangePercent = (() => {
            try {
                return priceData?.changePercent !== undefined ? priceData.changePercent : changePercent;
            } catch (err) {
                console.error('Error calculating change percent:', err);
                return changePercent; // Fallback to props on error
            }
        })();
        
        const isIncrease = currentChange >= 0;
        const trendColor = isIncrease ? "text-green-600" : "text-red-600";
        const TrendIcon = isIncrease ? TrendingUp : TrendingDown;
        
        // Format the change sign correctly for display
        const displayChangeSign = isIncrease ? '+' : '-';
        
        return {
            displayTime,
            currentSpotPrice,
            currentChange,
            currentChangePercent,
            isIncrease,
            trendColor,
            TrendIcon,
            displayChangeSign,
            loading,
            error,
            isAveragePrice,
            dataPointsCount: priceData?.type === 'averagePrice' ? (priceData.dataPointsCount || dataPointsCount) : dataPointsCount,
            lastCashSettlementPrice: priceData?.lastCashSettlementPrice,
        };
    }, [priceData, loading, error, dataPointsCount, lastUpdated, spotPrice, change, changePercent, isDerived, title, unit]);
    
    // Safe formatting functions - defined outside the render cycle
    const formatPrice = (price: number) => {
        try {
            return price.toFixed(2);
        } catch (err) {
            console.error('Error formatting price:', err);
            return '0.00';
        }
    };

    const formatPercent = (percent: number) => {
        try {
            return percent.toFixed(2);
        } catch (err) {
            console.error('Error formatting percent:', err);
            return '0.00';
        }
    };

    const formatDate = (date: Date) => {
        try {
            // Check if date is valid before formatting
            if (!date || isNaN(date.getTime())) {
                console.error('Invalid date received:', date);
                return 'N/A';
            }
            return format(date, 'dd MMM yyyy');
        } catch (err) {
            console.error('Error formatting date:', err);
            return 'N/A';
        }
    };

    // Destructure values from cardContent for cleaner JSX
    const {
        displayTime,
        currentSpotPrice,
        currentChange,
        currentChangePercent,
        isIncrease,
        trendColor,
        TrendIcon,
        displayChangeSign,
        isAveragePrice,
        lastCashSettlementPrice,
    } = cardContent;

    return (
        <div className={`price-card rounded-xl p-2 md:p-4 border 
          shadow-sm hover:shadow-sm transition-all duration-150 w-full
          relative overflow-hidden gpu-render group
          ${isAveragePrice 
            ? 'bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 border-indigo-200 shadow-indigo-100/50 h-[140px] md:h-[162px]' 
            : 'bg-white border-gray-200 h-[162px]'}`}>
            
            {/* Background effect - even more subtle */}
            {isAveragePrice ? (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-3 transition-opacity duration-200 bg-indigo-500 -z-10"></div>
            ) : (
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-3 transition-opacity duration-200
                  ${isIncrease ? 'bg-green-500' : 'bg-red-500'} 
                  -z-10`}></div>
            )}
            
            {isAveragePrice && (
              <>
                {/* Minimalist decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 -m-12 bg-indigo-200 rounded-full opacity-15 blur-sm"></div>
              </>
            )}

            <div className={`relative flex flex-col h-full ${isAveragePrice ? 'gap-0.5 md:gap-2' : 'gap-1 md:gap-2'} justify-between`}>
                {/* Header with indicator badge */}
                <div>
                    {/* Check if it's an average price API URL even during loading */}
                    {/* Display title based on props or derived from API URL */}
                    {apiUrl.includes('/api/average-price') || isAveragePrice ? (
                        <div className="bg-indigo-600 text-white text-xs px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5 mb-1 md:mb-2 shadow-sm">
                            <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5 crisp-text" />
                            <span className="text-[10px] md:text-xs">{isDerived ? 'Derived' : 'Estimated'} {title || 'Average CSP'}</span>
                        </div>
                    ) : (
                        <div className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1.5 mb-2">
                            <Clock className="w-3.5 h-3.5 crisp-text" />
                            <span>{title || 'Spot Price'}</span>
                        </div>
                    )}
                </div>

                {/* Price Content */}
                <div className="flex-1">
                    {cardContent.loading ? (
                        <div className="py-1 md:py-2 h-[65px] flex flex-col justify-center">
                            <div className="h-6 w-28 md:w-32 bg-gray-200 animate-pulse mb-2 rounded"></div>
                            <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div>
                            {/* Add a subtle indicator for what type of data is loading */}
                            <div className="mt-2 text-[9px] text-gray-400 text-center">
                                {apiUrl.includes('/api/average-price') ? 'Loading estimated average...' : 'Loading spot price...'}
                            </div>
                        </div>
                    ) : cardContent.error ? (
                        <div className="h-[65px] flex flex-col justify-center">
                            <div className="flex items-center justify-center bg-red-50 border border-red-200 rounded-md p-3 mb-2">
                                <p className="text-sm text-red-600 font-medium">{cardContent.error}</p>
                            </div>
                            <div className="text-xs text-gray-500 text-center">
                                Please check if data is available in the database
                            </div>
                        </div>
                    ) : isAveragePrice ? (
                        <div className={`${isAveragePrice ? 'h-[50px] md:h-[65px]' : 'h-[65px]'} flex flex-row justify-between items-start`}>
                            <div className="flex flex-col">
                                <span className="font-mono text-xl md:text-3xl font-bold text-indigo-700 tracking-tight">
                                    ${formatPrice(currentSpotPrice)}
                                </span>
                                <span className="text-[9px] md:text-xs text-indigo-600 -mt-0.5 md:mt-1">
                                    {unit} • Based on {cardContent.dataPointsCount} data points
                                </span>
                            </div>
                            <div className={`flex flex-col items-center ${trendColor} bg-white/40 p-1 md:p-2 rounded-lg my-auto transition-colors duration-200 group-hover:bg-white/50`}>
                                <TrendIcon className="w-5 h-5 md:w-7 md:h-7 mb-0 md:mb-1 mx-auto" />
                                <span className="font-mono font-bold text-sm md:text-base">
                                    {displayChangeSign}${Math.abs(currentChange).toFixed(2)}
                                </span>

                            </div>
                        </div>
                    ) : (
                        <div className="h-[65px] flex flex-col justify-center">
                            <div className="flex items-baseline gap-2">
                                <span className="font-mono text-xl md:text-2xl font-bold text-indigo-600">
                                    ${formatPrice(currentSpotPrice)}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {unit}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className={`font-mono text-sm font-medium ${trendColor}`}>
                                    {displayChangeSign}${Math.abs(currentChange).toFixed(2)}
                                </span>
                                <span className={`text-xs ${trendColor}`}>
                                    ({displayChangeSign}{formatPercent(Math.abs(currentChangePercent))}%)
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-0 text-xs text-gray-500">
                    {isAveragePrice ? (
                        <>
                            <div className="font-medium flex items-center text-indigo-800">
                                <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5 mr-1" />
                                <span className="text-[9px] md:text-xs">
                                    {displayTime instanceof Date && !isNaN(displayTime.getTime()) 
                                        ? formatDate(displayTime) 
                                        : 'N/A'}
                                </span>
                            </div>
                            <div className="text-indigo-700 font-medium bg-white/40 px-1.5 py-0.5 md:px-2 md:py-0.5 rounded-md text-[9px] md:text-xs">
                                {priceData?.message || ''}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="font-medium">
                                {displayTime instanceof Date && !isNaN(displayTime.getTime())
                                    ? formatDate(displayTime)
                                    : 'N/A'}
                            </div>
                            <div>
                                {priceData?.message || ''}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}