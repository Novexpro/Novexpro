"use client";

import React, { memo, useEffect, useState, useRef, useCallback } from 'react';
import LiveSpotCard from '../Dashboard/LiveSpotCard';
import MCXAluminium from '../Dashboard/MCXAluminium';
import MonthlyCashSettlement from '../Dashboard/MonthlyCashSettlement';
import { useMetalPrice } from '../../context/MetalPriceContext';
import { Clock, RefreshCw } from 'lucide-react';

// Wrapper component that adds context awareness to existing components
const SynchronizedLiveSpotCard = memo(() => {
  const { triggerRefresh, registerRefreshListener, sharedSpotPrice, updateSharedSpotPrice, forceSync } = useMetalPrice();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [spotPriceData, setSpotPriceData] = useState({
    spotPrice: 0,
    change: 0,
    changePercent: 0,
    lastUpdated: new Date().toISOString()
  });
  const initialFetchRef = useRef(false);
  const initialSyncDoneRef = useRef(false);
  
  // Add an effect to listen for force sync events
  useEffect(() => {
    interface SpotPriceData {
      spotPrice: number;
      change: number;
      changePercent: number;
      lastUpdated: string;
    }
    
    interface ForceSyncEvent extends CustomEvent {
      detail: {
        spotPriceData: SpotPriceData;
        source: string;
      };
    }
    
    const handleForceSync = (event: ForceSyncEvent) => {
      console.log('TopCards: Received force-sync event:', event.detail);
      
      // Always update with the shared data, regardless of who sent it
      if (event.detail && event.detail.spotPriceData) {
        setSpotPriceData(event.detail.spotPriceData);
        setIsLoading(false);
        setIsRefreshing(false);
        initialFetchRef.current = true;
      }
    };
    
    // Add event listener
    window.addEventListener('spot-price-force-sync', handleForceSync as EventListener);
    
    // Clean up
    return () => {
      window.removeEventListener('spot-price-force-sync', handleForceSync as EventListener);
    };
  }, []);
  
  // Listen for spot price sync events from other components
  useEffect(() => {
    // Create interface for the custom event
    interface SpotPriceData {
      spotPrice: number;
      change: number;
      changePercent: number;
      lastUpdated: string;
    }
    
    interface SpotPriceSyncEvent extends CustomEvent {
      detail: {
        spotPriceData: SpotPriceData;
      };
    }
    
    const handleSpotPriceSync = (event: SpotPriceSyncEvent) => {
      console.log('TopCards: Received spot-price-sync event:', event.detail);
      if (event.detail && event.detail.spotPriceData) {
        setSpotPriceData(event.detail.spotPriceData);
        setIsLoading(false);
        initialFetchRef.current = true;
        setIsRefreshing(false);
      }
    };
    
    // Listen for pre-refresh events to show loading state
    const handlePreRefresh = () => {
      console.log('TopCards: Received pre-spot-refresh event');
      setIsRefreshing(true);
    };
    
    // Add event listeners
    window.addEventListener('spot-price-sync', handleSpotPriceSync as EventListener);
    window.addEventListener('pre-spot-refresh', handlePreRefresh);
    
    // Clean up
    return () => {
      window.removeEventListener('spot-price-sync', handleSpotPriceSync as EventListener);
      window.removeEventListener('pre-spot-refresh', handlePreRefresh);
    };
  }, []);
  
  // Update local state when shared data changes
  useEffect(() => {
    if (sharedSpotPrice && sharedSpotPrice.spotPrice > 0) {
      console.log('SynchronizedLiveSpotCard: Using shared spot price data:', sharedSpotPrice);
      setSpotPriceData(sharedSpotPrice);
      setIsLoading(false);
      initialFetchRef.current = true;
    }
  }, [sharedSpotPrice]);
  
  // Request a sync once on component mount
  useEffect(() => {
    if (!initialSyncDoneRef.current) {
      // Mark sync as done to avoid multiple requests
      initialSyncDoneRef.current = true;
      
      // Request data from dashboard component
      console.log('TopCards: Requesting initial data sync');
      
      // First try with direct sync
      if (typeof window !== 'undefined') {
        // Create a one-time event to request data
        const requestEvent = new CustomEvent('spot-price-request-data', {
          detail: { source: 'TopCards' }
        });
        window.dispatchEvent(requestEvent);
        
        // Trigger refresh as backup
        setTimeout(() => {
          if (!initialFetchRef.current) {
            triggerRefresh();
          }
        }, 500);
      }
    }
  }, [triggerRefresh]);
  
  // Register for refresh notifications
  useEffect(() => {
    const unregister = registerRefreshListener(() => {
      console.log("SynchronizedLiveSpotCard received refresh signal");
      setIsRefreshing(true);
      
      // Let other components know we're refreshing
      window.dispatchEvent(new Event('pre-spot-refresh'));
      
      // Request fresh data explicitly
      const requestEvent = new CustomEvent('spot-price-request-data', {
        detail: { source: 'TopCards' }
      });
      window.dispatchEvent(requestEvent);
      
      // Auto-reset refreshing state after 2 seconds if no data arrives
      const timer = setTimeout(() => {
        setIsRefreshing(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    });
    
    // Cleanup function
    return () => {
      unregister();
    };
  }, [registerRefreshListener]);

  // Handle manual refresh
  const handleManualRefresh = () => {
    // Set refreshing state to show loading indicator
    setIsRefreshing(true);
    
    // Trigger global refresh for all price components
    triggerRefresh();
    
    // Emit a pre-refresh event so other components can prepare
    window.dispatchEvent(new Event('pre-spot-refresh'));
    
    // Request data from LMEAluminium specifically
    const requestEvent = new CustomEvent('spot-price-request-data', {
      detail: { source: 'TopCards' }
    });
    window.dispatchEvent(requestEvent);
    
    // Auto-reset refreshing state after 2 seconds if no data arrives
    setTimeout(() => {
      setIsRefreshing(false);
    }, 2000);
  };

  const { spotPrice, change, changePercent, lastUpdated } = spotPriceData;
  const isIncrease = change >= 0;

  // Create a component with the same appearance as LiveSpotCard but using the spot price data
  return (
    <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-md hover:shadow-lg transition-all duration-200 price-card">
      <div className="flex items-start justify-between relative z-10 mb-2">
        <div className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full flex items-center gap-1.5 font-medium">
          <Clock className="w-3.5 h-3.5" />
          <span>Spot Price</span>
        </div>
        
        {/* Add refresh button */}
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
          aria-label="Refresh spot price"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {isLoading ? (
        // Loading skeleton
        <div className="flex-1 flex flex-col justify-center animate-pulse">
          <div className="h-8 w-32 bg-gray-200 rounded mb-2"></div>
          <div className="h-5 w-24 bg-gray-200 rounded mb-3"></div>
          <div className="h-3 w-20 bg-gray-200 rounded"></div>
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-baseline gap-1">
              <span className="font-mono font-bold text-3xl text-indigo-600">
                ${spotPrice.toFixed(2)}
              </span>
              <span className="text-sm text-gray-500">/MT</span>
            </div>

            <div className={`flex items-center gap-1.5 mt-1 ${isIncrease ? "text-green-600" : "text-red-600"}`}>
              <div className={`p-0.5 rounded-full ${isIncrease ? "bg-green-100" : "bg-red-100"}`}>
                {isIncrease ? (
                  <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 7 7 17M17 7h-5m5 0v5" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m7 17 10-10M7 17h5m-5 0v-5" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium">
                {isIncrease ? "+" : ""}{change.toFixed(2)} ({changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-2">
            {lastUpdated && typeof lastUpdated === 'string' ? 
              new Date(lastUpdated).toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
              }).replace(/ /g, ' ') 
            : 'No date available'}
          </div>
        </>
      )}
    </div>
  );
});

// We don't need to create wrapper components for MCXAluminium and MonthlyCashSettlement
// since we've already updated them to use the MetalPriceContext directly

const TopCards = () => {
  return (
    <div className="max-w-[1366px] mx-auto px-4 pt-3 md:pt-4">
      <section className="relative bg-gradient-to-br from-indigo-50/95 via-blue-50/95 to-sky-50/95 backdrop-blur-sm rounded-xl p-4 md:p-6 
        border border-indigo-100/50 shadow-[0_8px_16px_rgba(99,102,241,0.06)] hover:shadow-[0_12px_24px_rgba(99,102,241,0.08)] 
        transition-all duration-300 overflow-hidden">
        
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.05)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(56,189,248,0.05)_0%,transparent_50%)]" />

        <div className="flex justify-between items-baseline mb-3 md:mb-4">
          <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 
            bg-clip-text text-transparent">
            Live Market Data
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          <div className="w-full md:col-span-3">
            <SynchronizedLiveSpotCard />
          </div>
          <div className="w-full md:col-span-3">
            <div className="monthly-cash-wrapper">
              <MonthlyCashSettlement />
            </div>
          </div>
          <div className="w-full md:col-span-6">
            {/* Custom styling wrapper for MCXAluminium to control height and width */}
            <div className="mcx-top-card-wrapper">
              <MCXAluminium />
            </div>
            {/* Add custom CSS to modify the MCXAluminium card */}
            <style jsx global>{`
              /* Target the MCXAluminium card when inside the top-card wrapper */
              .mcx-top-card-wrapper > div {
                min-height: auto !important; /* Auto height for mobile */
                max-height: none !important; /* Remove max height constraint */
                height: auto !important;
                width: 100% !important;
                overflow: visible !important; /* Allow content to be visible */
                padding: 0.75rem !important; /* Reduce overall padding */
                position: relative !important;
              }
              
              /* Fix flickering issue in LiveSpotCard */
              .price-card {
                will-change: transform !important;
                transform: translateZ(0) !important;
                backface-visibility: hidden !important;
                perspective: 1000px !important;
                /* Prevent content shift */
                min-height: 162px !important;
                max-height: 162px !important;
                overflow: hidden !important;
              }
              
              /* Prevent layout shifts by fixing height of content areas */
              .price-card .flex-1 {
                height: 65px !important;
                min-height: 65px !important;
                max-height: 65px !important;
                position: relative !important;
              }
              
              /* Prevent transitions on initial load */
              .price-card:not(:hover) {
                transition: none !important;
              }
              
              /* Fix flickering in MCX component */
              .mcx-top-card-wrapper > div, 
              .monthly-cash-wrapper > div {
                will-change: transform !important;
                transform: translateZ(0) !important;
                backface-visibility: hidden !important;
                perspective: 1000px !important;
              }
              
              /* Fix loading state height */
              .mcx-top-card-wrapper .bg-white.rounded-lg.p-4.border.border-gray-200.shadow-sm.min-h-\\[190px\\],
              .mcx-top-card-wrapper .bg-white.rounded-xl.p-3.border.border-gray-100.shadow-\\[0_4px_12px_rgba\\(0\\,0\\,0\\,0\\.05\\)\\].hover\\:shadow-lg.transition-all.duration-200.min-h-\\[190px\\].relative {
                min-height: 162px !important;
                max-height: none !important;
                height: auto !important;
                overflow: hidden !important;
              }
              
              /* Make the header more compact */
              .mcx-top-card-wrapper > div > div:first-child {
                margin-bottom: 0.25rem !important;
              }
              
              /* Hide the Clock component if it's still present in HTML */
              .mcx-top-card-wrapper > div div:has(.w-3.h-3[class*="lucide-clock"]) {
                display: none !important;
              }
              
              /* Show all month prices on mobile */
              .mcx-top-card-wrapper .hidden.sm\\:flex {
                display: flex !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow-x: auto !important;
                gap: 0.75rem !important;
                position: relative !important;
                justify-content: space-between !important;
              }
              
              /* CUSTOM DIVIDER IMPLEMENTATION */
              /* Hide all default dividers */
              .mcx-top-card-wrapper .hidden.sm\\:flex > div:not(:last-child)::after,
              .mcx-top-card-wrapper div[class*="w-0.5"],
              .mcx-top-card-wrapper div.flex-1.flex.items-center > div.h-12 {
                display: none !important;
              }

              /* Add solid bold dividers in-between month prices */
              .mcx-top-card-wrapper .hidden.sm\\:flex > div {
                position: relative !important;
              }
              
              .mcx-top-card-wrapper .hidden.sm\\:flex > div:not(:last-child) {
                border-right: 2px solid #4B5563 !important;
                margin-right: 15px !important;
                padding-right: 15px !important;
              }
              
              /* Make month blocks more compact */
              .mcx-top-card-wrapper .hidden.sm\\:flex > div {
                min-width: 85px !important;
                text-align: center !important;
              }
              
              /* Responsive font sizes for prices */
              .mcx-top-card-wrapper .font-mono {
                font-size: 1.25rem !important;
                line-height: 1.2 !important;
              }
              
              /* Ensure mobile contract visualization */
              .mcx-top-card-wrapper .flex.sm\\:hidden {
                display: flex !important;
                overflow-x: auto !important;
                padding-bottom: 0.5rem !important;
                margin-bottom: 0.5rem !important;
              }
              
              /* Make sure contango bar is visible */
              .mcx-top-card-wrapper .rounded-lg.shadow-sm.p-1\\.5.bg-white.border.border-gray-200 {
                display: block !important;
                margin-top: 0.5rem !important;
              }
              
              /* Properly style the contango section - RESTORE COLORS */
              .mcx-top-card-wrapper .p-1\\.5 .transition-all.py-2 {
                background: inherit !important;
              }
              
              /* Set text color for contango section */
              .mcx-top-card-wrapper .p-1\\.5 .transition-all.py-2 p {
                color: inherit !important;
              }
              
              /* Restore contango colors */
              .mcx-top-card-wrapper p.text-green-800 {
                color: rgb(22, 101, 52) !important;
              }
              
              .mcx-top-card-wrapper p.text-red-800 {
                color: rgb(153, 27, 27) !important;
              }
              
              .mcx-top-card-wrapper .bg-gradient-to-r.from-green-100.to-green-50 {
                background: linear-gradient(to right, rgb(220, 252, 231), rgb(240, 253, 244)) !important;
              }
              
              .mcx-top-card-wrapper .bg-gradient-to-r.from-red-100.to-red-50 {
                background: linear-gradient(to right, rgb(254, 226, 226), rgb(254, 242, 242)) !important;
              }
              
              /* Target the contango bar specifically as in MCXAluminium component */
              .mcx-top-card-wrapper .mt-auto {
                background: transparent !important;
              }
              
              /* Apply the proper contango/backwardation styling */
              .mcx-top-card-wrapper .text-center.py-1.px-2.mt-auto.rounded {
                display: block !important;
                width: 100% !important;
                text-align: center !important;
              }
              
              /* Fix centered content within contango bar */
              .mcx-top-card-wrapper .text-center.py-1.px-2.mt-auto.rounded .flex.items-center.justify-center.gap-1\\.5.text-xs {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
                font-size: 0.7rem !important;
                gap: 0.3rem !important;
                max-width: 100% !important;
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
              }
              
              /* Make the icons smaller in contango section */
              .mcx-top-card-wrapper .text-center.py-1.px-2.mt-auto.rounded svg {
                width: 0.7rem !important;
                height: 0.7rem !important;
              }
              
              /* Green contango styling */
              .mcx-top-card-wrapper .text-center.py-1.px-2.mt-auto.rounded.bg-green-100 {
                background-color: rgb(220, 252, 231) !important; /* bg-green-100 */
                border: 1px solid rgb(187, 247, 208) !important; /* border-green-200 */
                color: rgb(22, 101, 52) !important; /* text-green-800 */
              }
              
              /* Red backwardation styling */
              .mcx-top-card-wrapper .text-center.py-1.px-2.mt-auto.rounded.bg-red-100 {
                background-color: rgb(254, 226, 226) !important; /* bg-red-100 */
                border: 1px solid rgb(254, 202, 202) !important; /* border-red-200 */
                color: rgb(153, 27, 27) !important; /* text-red-800 */
              }
              
              /* Fix Live button styling to match Dashboard */
              .mcx-top-card-wrapper button.flex.items-center.gap-1.px-2.py-0\\.5.rounded-full.text-xs.font-medium {
                background: linear-gradient(to right, #3b82f6, #4f46e5) !important;
                color: white !important;
                padding: 0.25rem 0.75rem !important;
                border: none !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 0.25rem !important;
                font-weight: 500 !important;
                border-radius: 9999px !important;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) !important;
              }
              
              /* Mobile view adjustments for Live button */
              @media (max-width: 639px) {
                /* Position the Live button better in mobile view */
                .mcx-top-card-wrapper > div > div:first-child {
                  display: flex !important;
                  justify-content: space-between !important;
                  align-items: center !important;
                  width: 100% !important;
                  margin-bottom: 0.5rem !important;
                  padding: 0 0.25rem !important;
                }
                
                /* Fix header title and make it bigger */
                .mcx-top-card-wrapper > div > div:first-child > h2 {
                  font-size: 0.875rem !important;
                  font-weight: 600 !important;
                  margin: 0 !important;
                  white-space: nowrap !important;
                  overflow: hidden !important;
                  text-overflow: ellipsis !important;
                  max-width: 60% !important;
                }
                
                /* Position buttons container */
                .mcx-top-card-wrapper > div > div:first-child > div:last-child {
                  display: flex !important;
                  gap: 0.5rem !important;
                  align-items: center !important;
                  justify-content: flex-end !important;
                }
                
                /* Make the button more compact in mobile view */
                .mcx-top-card-wrapper button.flex.items-center.gap-1.px-2.py-0\\.5.rounded-full.text-xs.font-medium {
                  padding: 0.25rem 0.5rem !important;
                  font-size: 0.65rem !important;
                  height: 1.5rem !important;
                  min-width: 3rem !important;
                  justify-content: center !important;
                  margin-left: auto !important;
                }
                
                /* Hide text label on smallest screens */
                .mcx-top-card-wrapper button.flex.items-center span:not(:first-child) {
                  display: none !important;
                }
                
                /* Make indicator slightly smaller */
                .mcx-top-card-wrapper .w-1\\.5.h-1\\.5.bg-green-500.rounded-full {
                  width: 0.3rem !important;
                  height: 0.3rem !important;
                }
                
                /* Adjust layout of the card itself */
                .mcx-top-card-wrapper .bg-white.rounded-lg.p-4.border.border-gray-200.shadow-sm.min-h-\\[190px\\],
                .mcx-top-card-wrapper .bg-white.rounded-xl.p-3.border.border-gray-100.shadow-\\[0_4px_12px_rgba\\(0\\,0\\,0\\,0\\.05\\)\\].hover\\:shadow-lg.transition-all.duration-200.min-h-\\[190px\\].relative {
                  padding-top: 0.25rem !important;
                }
              }
              
              /* Live indicator pulse */
              .mcx-top-card-wrapper .w-1\\.5.h-1\\.5.bg-green-500.rounded-full {
                width: 0.375rem !important;
                height: 0.375rem !important;
                background-color: #22c55e !important;
                border-radius: 9999px !important;
                position: relative !important;
              }
              
              .mcx-top-card-wrapper .w-1\\.5.h-1\\.5.bg-green-500.rounded-full::after {
                content: '' !important;
                position: absolute !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: 50% !important;
                background-color: #22c55e !important;
                opacity: 0.5 !important;
                animation: pulse 1.5s cubic-bezier(0, 0, 0.2, 1) infinite !important;
              }
              
              @keyframes pulse {
                0% {
                  transform: scale(1);
                  opacity: 0.5;
                }
                70% {
                  transform: scale(2);
                  opacity: 0;
                }
                100% {
                  transform: scale(2.5);
                  opacity: 0;
                }
              }
              
              @media (min-width: 640px) {
                .mcx-top-card-wrapper .font-mono {
                  font-size: 1.5rem !important;
                  line-height: 1.25 !important;
                }
                
                .mcx-top-card-wrapper > div {
                  min-height: 162px !important;
                  max-height: none !important;
                  padding: 0.5rem 1rem !important;
                  overflow: hidden !important;
                }
                
                /* Position contango section for laptop view */
                .mcx-top-card-wrapper .mt-auto {
                  position: relative !important;
                  bottom: auto !important;
                  left: auto !important;
                  right: auto !important;
                  transform: none !important;
                  margin-top: 0 !important;
                  z-index: 5 !important;
                  background: transparent !important;
                  backdrop-filter: none !important;
                }
              }

              /* Restore original contango section layout */
              .mcx-top-card-wrapper .py-1\\.5 {
                display: block !important;
                height: 0.25rem !important; /* Reduced height from 0.375rem */
              }
              
              /* Style the contango section */
              .mcx-top-card-wrapper .text-center.py-1.px-2.mt-auto.rounded {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
                margin: 0 auto !important;
                padding: 1px 0px !important; /* Removed horizontal padding completely */
                height: 22px !important;
                min-height: 22px !important;
                line-height: 1 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
              }

              /* Make contango section responsive */
              .mcx-top-card-wrapper {
                position: relative !important;
                overflow-x: hidden !important; /* Prevent horizontal scrollbar */
              }
              
              .mcx-top-card-wrapper .mt-auto {
                position: absolute !important;
                bottom: 0.5rem !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                width: 95% !important; /* Increased width percentage */
                max-width: 95% !important; /* Increased maximum width */
                z-index: 10 !important;
              }

              /* Handle high zoom levels */
              @media (max-width: 768px), (min-resolution: 1.25dppx) {
                .mcx-top-card-wrapper .mt-auto {
                  width: 95% !important;
                  max-width: 95% !important;
                  min-width: unset !important;
                }
                
                /* Ensure text doesn't overflow */
                .mcx-top-card-wrapper .text-center.py-1.px-2.mt-auto.rounded .flex.items-center.justify-center.gap-1\\.5.text-xs {
                  max-width: 100% !important;
                  white-space: nowrap !important;
                  overflow: hidden !important;
                  text-overflow: ellipsis !important;
                }
              }
              
              /* Responsive adjustments for small screens */
              @media (max-width: 480px) {
                .mcx-top-card-wrapper .mt-auto {
                  width: 95% !important;
                  max-width: 95% !important;
                }
              }
              
              /* Ensure consistent positioning across screen sizes */
              @media (min-width: 640px) {
                .mcx-top-card-wrapper .mt-auto {
                  bottom: 0.75rem !important;
                  width: 95% !important;
                  max-width: 95% !important;
                }
              }
              
              /* Hide the expand button (the last button in the header) */
              .mcx-top-card-wrapper > div > div:first-child > div:last-child > button:last-child {
                display: none !important;
              }
              
              /* Adjust title size for mobile */
              .mcx-top-card-wrapper > div > div:first-child h2 {
                font-size: 0.875rem !important;
              }
              
              @media (min-width: 640px) {
                .mcx-top-card-wrapper > div > div:first-child h2 {
                  font-size: 1rem !important;
                }
              }
              
              /* Hide anything that might be taking too much space */
              .mcx-top-card-wrapper div.border-t {
                display: none !important; /* Hide the Market Insight section */
              }
              
              /* Style loading effects to match MonthPrice component */
              
              /* For LiveSpotCard loading skeleton */
              .price-card .animate-pulse {
                animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
              }
              
              /* For MCXAluminium component loading skeleton */
              .mcx-top-card-wrapper .animate-pulse {
                animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important;
              }
              
              /* Make pulse animation more subtle like in MonthPrice */
              @keyframes pulse-subtle {
                0%, 100% {
                  opacity: 1;
                }
                50% {
                  opacity: 0.7;
                }
              }
              
              /* Style the loading elements */
              .price-card .bg-gray-200, 
              .mcx-top-card-wrapper .bg-gray-200 {
                background-color: #f3f4f6 !important;
                border-radius: 0.25rem !important;
              }
              
              /* Make MCXAluminium loading match MonthPrice */
              .mcx-top-card-wrapper [class*="bg-gray-200"] {
                background-color: #f3f4f6 !important;
                border-radius: 0.25rem !important;
              }
              
              /* Monthly Cash Settlement styling */
              .monthly-cash-wrapper > div {
                height: 162px !important;
                min-height: 162px !important;
                max-height: 162px !important;
                overflow: visible !important;
              }
              
              /* Make Monthly Cash Settlement responsive */
              .monthly-cash-wrapper .text-indigo-800.text-xs {
                white-space: nowrap !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                max-width: 100% !important;
              }
              
              /* Responsive adjustments for Monthly Cash Settlement */
              @media (max-width: 768px) {
                .monthly-cash-wrapper .text-indigo-800.text-xs {
                  font-size: 0.65rem !important;
                  line-height: 1 !important;
                  padding: 0.15rem 0.5rem !important;
                }
                
                .monthly-cash-wrapper .font-mono {
                  font-size: 1.25rem !important;
                }
                
                .monthly-cash-wrapper .text-xs {
                  font-size: 0.65rem !important;
                  line-height: 1.2 !important;
                }
                
                .monthly-cash-wrapper .p-3 {
                  padding: 0.5rem !important;
                }
              }
            `}</style>
          </div>
        </div>
      </section>
    </div>
  );
};

// Setting display names for components
SynchronizedLiveSpotCard.displayName = 'SynchronizedLiveSpotCard';

export default memo(TopCards);