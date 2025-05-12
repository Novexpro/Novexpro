'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';

interface ApiResponse {
  type: 'averagePrice' | 'noData' | 'error';
  averagePrice?: number;
  monthName?: string;
  dataPointsCount?: number;
  month?: number;
  year?: number;
  message?: string;
}

export default function MonthlyCashSettlement() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Function to fetch data for a specific month
  const fetchMonthlyCashSettlement = async (targetDate: Date) => {
    try {
      setLoading(true);
      setError(null);
      
      // Add a cache-busting parameter
      const cacheBuster = new Date().getTime();
      
      // Extract month and year from the target date
      const month = targetDate.getMonth() + 1; // JavaScript months are 0-indexed
      const year = targetDate.getFullYear();
      
      // Fetch data from our API
      const response = await fetch(
        `/api/monthly-cash-settlement?month=${month}&year=${year}&_t=${cacheBuster}`, 
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          }
        }
      );
      
      // Process the response
      if (!response.ok) {
        if (response.status === 404) {
          setData({
            type: 'noData',
            message: `No data available for ${format(targetDate, 'MMMM yyyy')}`
          });
        } else {
          throw new Error(`Failed to fetch data: ${response.status}`);
        }
      } else {
        const responseData = await response.json();
        setData(responseData);
      }
    } catch (err) {
      console.error('Error fetching monthly cash settlement:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // Navigate to previous month
  const handlePreviousMonth = () => {
    const prevMonth = subMonths(currentMonth, 1);
    setCurrentMonth(prevMonth);
    fetchMonthlyCashSettlement(prevMonth);
  };
  
  // Navigate to next month
  const handleNextMonth = () => {
    const nextMonth = addMonths(currentMonth, 1);
    setCurrentMonth(nextMonth);
    fetchMonthlyCashSettlement(nextMonth);
  };
  
  // Load data when component mounts or when current month changes
  useEffect(() => {
    fetchMonthlyCashSettlement(currentMonth);
  }, []);
  
  // Format price function
  const formatPrice = (price?: number) => {
    if (price === undefined) return '0.00';
    return price.toFixed(2);
  };
  
  return (
    <div className="bg-white rounded-xl p-3 md:p-4 border border-gray-200 shadow-sm hover:shadow-md 
      transition-all duration-200 w-full relative overflow-hidden gpu-render group h-[162px]">
      
      {/* Background effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity 
        bg-indigo-500 -z-10"></div>
      
      <div className="relative flex flex-col h-full gap-1 md:gap-2 justify-between">
        {/* Header with month navigation */}
        <div className="flex justify-between items-center">
          <div className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full 
            font-medium inline-flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 crisp-text" />
            <span>Monthly Avg CSP</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePreviousMonth}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            
            <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(currentMonth, 'MMM yyyy')}
            </div>
            
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Next month"
              disabled={addMonths(currentMonth, 1) > new Date()}
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
        
        {/* Price Content */}
        <div className="flex-1 flex flex-col justify-center">
          {loading ? (
            <div className="py-1 md:py-2 h-[65px] flex flex-col justify-center">
              <div className="h-6 w-28 md:w-32 bg-gray-200 animate-pulse mb-2 rounded"></div>
              <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"></div>
            </div>
          ) : error || (data?.type === 'noData') ? (
            <div className="h-[65px] flex flex-col justify-center">
              <div className="flex items-center justify-center bg-red-50 border border-red-200 rounded-md p-3 mb-2">
                <p className="text-sm text-red-600 font-medium">
                  {error || data?.message || 'No data available'}
                </p>
              </div>
              <div className="text-xs text-gray-500 text-center">
                Please try a different month
              </div>
            </div>
          ) : data?.type === 'averagePrice' && data?.averagePrice !== undefined ? (
            <div className="h-[65px] flex flex-col justify-center">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xl md:text-2xl font-bold text-indigo-600">
                  ${formatPrice(data.averagePrice)}
                </span>
                <span className="text-xs text-gray-500">/MT</span>
              </div>
              
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="text-gray-700 font-medium">{data.monthName}</span>
                <span>•</span>
                <span>Based on {data.dataPointsCount} data points</span>
              </div>
            </div>
          ) : null}
        </div>
        
        {/* Footer with attribution */}
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span>Data Source:</span>
          <span className="font-medium text-indigo-600">LME Cash Settlement</span>
        </div>
      </div>
    </div>
  );
} 