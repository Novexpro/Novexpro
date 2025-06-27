'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, DollarSign, Calendar, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import styles from './todayLSP.module.css';

// Define the types
interface TodayLSPProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettlementData {
  price: string;
  date: string;
  time: string;
  isLatest: boolean;
}

interface ApiResponse {
  type: 'cashSettlement' | 'noData';
  cashSettlement?: number;
  dateTime?: string;
  lastUpdated?: string;
  message?: string;
  error?: string;
  success?: boolean;
}

export default function TodayLSP({ 
  isOpen, 
  onClose
}: TodayLSPProps) {
  const [settlementData, setSettlementData] = useState<SettlementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [noDataAvailable, setNoDataAvailable] = useState(false);

  // Format date as "Month Day, Year" (e.g., "April 28, 2025")
  const formatDate = useCallback((date: Date): string => {
    try {
      // Validate the date first
      if (!date || isNaN(date.getTime())) {
        console.error('Invalid date object:', date);
        return 'N/A';
      }
      
      const month = date.toLocaleString('en-US', { month: 'long' });
      const day = date.getDate();
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  }, []);
  
  // Format time as "HH:MM:SS" (e.g., "15:49:27")
  const formatTime = useCallback((date: Date): string => {
    try {
      // Validate the date first
      if (!date || isNaN(date.getTime())) {
        console.error('Invalid date object for time formatting:', date);
        return 'N/A';
      }
      
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'N/A';
    }
  }, []);

  // Parse and validate date from API response
  const parseApiDate = useCallback((dateTimeValue: string): Date | null => {
    try {
      const dateObj = new Date(dateTimeValue);
      
      // Validate the date
      if (isNaN(dateObj.getTime())) {
        console.error('Invalid date from API:', dateTimeValue);
        return null;
      }
      
      return dateObj;
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  }, []);

  // Check if date is today
  const isToday = useCallback((date: Date): boolean => {
    try {
      const today = new Date();
      return date.getDate() === today.getDate() && 
             date.getMonth() === today.getMonth() && 
             date.getFullYear() === today.getFullYear();
    } catch (error) {
      console.error('Error checking if date is today:', error);
      return false;
    }
  }, []);

  // Fetch data from the API with option to force refresh
  const fetchTodaySettlementData = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);
      setSettlementData(null);
      setDebugInfo(null);
      setNoDataAvailable(false);
      
      // Fetch directly from the dedicated wLME API
      const timestamp = Date.now();
      const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
      const url = forceRefresh 
        ? `/api/wLME?_t=${timestamp}&date=${today}&forceToday=true&bypassCache=true` 
        : `/api/wLME?_t=${timestamp}&date=${today}&forceToday=true`;
      
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      let data: ApiResponse;
      
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        throw new Error('Invalid response format from server');
      }
      
      // Store the raw response for debugging (safely)
      try {
        setDebugInfo(JSON.stringify(data, null, 2));
      } catch (stringifyError) {
        console.error('Error stringifying debug info:', stringifyError);
        setDebugInfo('Unable to display debug info');
      }
      
      console.log('Raw API response:', data);
      
      // If API returned a 404 or explicit noData type, show no data message
      if (response.status === 404 || data.type === 'noData') {
        console.log('No data available for today');
        setNoDataAvailable(true);
        
        // Get today's date for display
        const today = new Date();
        const formattedDate = formatDate(today);
        
        // Set a custom message if one was provided by the API
        try {
          setDebugInfo(JSON.stringify({
            ...data,
            currentDate: formattedDate
          }, null, 2));
        } catch (error) {
          console.error('Error setting debug info:', error);
        }
        return;
      }
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      // Check for cash settlement data
      if (!data || (data.type === 'cashSettlement' && (data.cashSettlement === undefined || data.cashSettlement === null))) {
        throw new Error('Cash settlement data not found in API response');
      }
      
      // Extract the cash settlement value based on the API response format
      const cashSettlementValue = data.type === 'cashSettlement' && data.cashSettlement !== undefined
        ? Number(data.cashSettlement)
        : 0;
        
      if (isNaN(cashSettlementValue) || !isFinite(cashSettlementValue)) {
        throw new Error('Invalid cash settlement value');
      }
      
      // Safely parse the date - handle various date formats
      let dateObj: Date | null = null;
      
      // The wLME API uses dateTime for the timestamp
      const dateTimeValue = data.dateTime || data.lastUpdated;
      
      if (dateTimeValue) {
        dateObj = parseApiDate(dateTimeValue);
      }
      
      // Fallback to current date if parsing failed
      if (!dateObj) {
        console.warn('Using current date as fallback');
        dateObj = new Date();
      }
      
      // Check if the date is today
      if (!isToday(dateObj)) {
        console.log('Data is not from today, showing no data message');
        setNoDataAvailable(true);
        return;
      }
      
      // Format the data
      setSettlementData({
        price: `$${cashSettlementValue.toFixed(2)}`,
        date: formatDate(dateObj),
        time: formatTime(dateObj),
        isLatest: true
      });
      
      console.log('Cash settlement data loaded:', {
        price: cashSettlementValue,
        dateTime: dateObj.toISOString()
      });
      
    } catch (error) {
      console.error('Error fetching settlement data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load cash settlement data';
      setError(errorMessage);
      setSettlementData(null);
    } finally {
      setIsLoading(false);
    }
  }, [formatDate, formatTime, parseApiDate, isToday]);

  // Fetch the latest LME cash settlement data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTodaySettlementData();
    }
  }, [isOpen, fetchTodaySettlementData]);

  // Add ESC key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleEscape);
      
      return () => {
        window.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  // Handle clicking outside the modal
  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if the click is directly on the overlay element
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle refresh button clicks
  const handleRefresh = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    fetchTodaySettlementData();
  }, [fetchTodaySettlementData]);

  const handleForceRefresh = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    fetchTodaySettlementData(true);
  }, [fetchTodaySettlementData]);

  // Parse debug info safely
  const getDebugCurrentDate = useCallback((): string | null => {
    try {
      if (debugInfo) {
        const parsed = JSON.parse(debugInfo);
        return parsed.currentDate || null;
      }
    } catch (error) {
      console.error('Error parsing debug info:', error);
    }
    return null;
  }, [debugInfo]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalContent}>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#6923F7]">Today&apos;s LME Cash Settlement</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors bg-gray-50 hover:bg-gray-100 p-1.5 rounded-full flex-shrink-0 ml-2"
            aria-label="Close"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          // Loading state
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-10 h-10 border-4 border-[#E7DBFF] border-t-[#6923F7] rounded-full animate-spin mb-3"></div>
            <p className="text-gray-600">Loading settlement data...</p>
          </div>
        ) : noDataAvailable ? (
          // No data state
          <div className="flex flex-col items-center justify-center py-6 text-center px-4">
            <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">Waiting for Today's Data</h3>
            <p className="text-gray-600 mb-3">
              {(() => {
                const currentDate = getDebugCurrentDate();
                return currentDate 
                  ? `Cash settlement for ${currentDate} is not yet available.`
                  : `Today's settlement data is pending. Please check back later.`;
              })()}
            </p>
            <div className="flex space-x-2">
              <button 
                onClick={handleRefresh}
                className="px-3 py-1.5 bg-[#E7DBFF] text-[#6923F7] rounded-md hover:bg-[#DBC7FF] transition-colors text-sm font-medium"
                type="button"
              >
                Refresh
              </button>
              <button 
                onClick={handleForceRefresh}
                className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium"
                type="button"
              >
                Force Refresh
              </button>
            </div>
          </div>
        ) : error ? (
          // Error state
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
            <p className="text-gray-600 font-medium">{error}</p>
            {debugInfo && (
              <div className="mt-2 mb-3 p-2 bg-gray-50 rounded-md text-left max-h-[150px] overflow-auto w-full">
                <p className="text-xs text-gray-500 mb-1">API Response:</p>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">
                  {debugInfo}
                </pre>
              </div>
            )}
            <div className="flex space-x-2 mt-2">
              <button 
                onClick={handleRefresh}
                className="px-3 py-1.5 bg-[#E7DBFF] text-[#6923F7] rounded-md hover:bg-[#DBC7FF] transition-colors text-sm font-medium"
                type="button"
              >
                Try Again
              </button>
              <button 
                onClick={handleForceRefresh}
                className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium"
                type="button"
              >
                Force Refresh
              </button>
            </div>
          </div>
        ) : settlementData ? (
          // Data display
          <div className="space-y-5">
            <div className="flex items-center space-x-4">
              <div className="bg-[#E7DBFF] p-3 rounded-lg flex items-center justify-center w-11 h-11">
                <DollarSign className="text-[#6923F7] h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">SETTLEMENT PRICE</p>
                <p className="text-xl font-bold text-gray-800">{settlementData.price}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="bg-[#E7DBFF] p-3 rounded-lg flex items-center justify-center w-11 h-11">
                <Calendar className="text-[#6923F7] h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">DATE</p>
                <p className="text-xl font-bold text-gray-800">{settlementData.date}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="bg-[#E7DBFF] p-3 rounded-lg flex items-center justify-center w-11 h-11">
                <Clock className="text-[#6923F7] h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-medium">TIME</p>
                <p className="text-xl font-bold text-gray-800">{settlementData.time}</p>
              </div>
            </div>
          </div>
        ) : (
          // Fallback in case data is null but we don't have an error
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
            <p className="text-gray-600 font-medium">No settlement data available</p>
            {debugInfo && (
              <div className="mt-2 mb-3 p-2 bg-gray-50 rounded-md text-left max-h-[150px] overflow-auto w-full">
                <p className="text-xs text-gray-500 mb-1">API Response:</p>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">
                  {debugInfo}
                </pre>
              </div>
            )}
            <div className="flex space-x-2 mt-2">
              <button 
                onClick={handleRefresh}
                className="px-3 py-1.5 bg-[#E7DBFF] text-[#6923F7] rounded-md hover:bg-[#DBC7FF] transition-colors text-sm font-medium"
                type="button"
              >
                Try Again
              </button>
              <button 
                onClick={handleForceRefresh}
                className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium"
                type="button"
              >
                Force Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
