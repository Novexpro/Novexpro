'use client';

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';

interface SpotPriceData {
  spotPrice: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
}

interface MetalPriceContextType {
  lastFetchTime: number;
  sharedSpotPrice: SpotPriceData;
  updateSharedSpotPrice: (data: SpotPriceData) => void;
  triggerRefresh: () => void;
  registerRefreshListener: (callback: () => void) => () => void;
  forceSync: (source: string) => void;
}

const defaultSpotPrice: SpotPriceData = {
  spotPrice: 0,
  change: 0,
  changePercent: 0,
  lastUpdated: new Date().toISOString()
};

// Local storage key for persisting data
const STORAGE_KEY = 'metal_price_shared_data';

const MetalPriceContext = createContext<MetalPriceContextType | undefined>(undefined);

export function MetalPriceProvider({ children }: { children: ReactNode }) {
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
  const [refreshListeners, setRefreshListeners] = useState<(() => void)[]>([]);
  const [sharedSpotPrice, setSharedSpotPrice] = useState<SpotPriceData>(() => {
    // Try to load initial data from localStorage on client-side
    if (typeof window !== 'undefined') {
      try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
          return JSON.parse(savedData);
        }
      } catch (error) {
        console.error('Failed to load data from localStorage:', error);
      }
    }
    return defaultSpotPrice;
  });

  // Function to update the shared spot price data
  const updateSharedSpotPrice = useCallback((data: SpotPriceData) => {
    console.log('Updating shared spot price data:', data);
    setSharedSpotPrice(data);
    
    // Save to localStorage for persistence between page navigations
    if (typeof window !== 'undefined' && data.spotPrice > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    }
  }, []);

  // Function to trigger a refresh across all registered components
  const triggerRefresh = useCallback(() => {
    // Update the timestamp
    setLastFetchTime(Date.now());
    
    // Call all registered refresh callbacks
    refreshListeners.forEach(callback => callback());
    
    console.log(`Triggered price refresh for ${refreshListeners.length} components`);
  }, [refreshListeners]);

  // Function to register a refresh callback
  const registerRefreshListener = useCallback((callback: () => void) => {
    setRefreshListeners(prev => [...prev, callback]);
    
    // Return function to unregister the callback
    return () => {
      setRefreshListeners(prev => prev.filter(cb => cb !== callback));
    };
  }, []);
  
  // Force all components to sync with current data
  const forceSync = useCallback((source: string) => {
    console.log(`Force sync triggered by ${source}, current data:`, sharedSpotPrice);
    
    // Only sync if we have valid data
    if (sharedSpotPrice && sharedSpotPrice.spotPrice > 0) {
      console.log(`ForceSync: Broadcasting valid spot price data: ${sharedSpotPrice.spotPrice.toFixed(2)}`);
      
      // Dispatch a global event for all components to sync
      if (typeof window !== 'undefined') {
        try {
          const syncEvent = new CustomEvent('spot-price-force-sync', { 
            detail: { 
              spotPriceData: sharedSpotPrice,
              source 
            } 
          });
          window.dispatchEvent(syncEvent);
          console.log(`ForceSync: Event dispatched successfully from ${source}`);
        } catch (error) {
          console.error('ForceSync: Error dispatching event:', error);
        }
      }
    } else {
      console.warn(`ForceSync: No valid data to sync from ${source}, spotPrice=${sharedSpotPrice?.spotPrice}`);
    }
  }, [sharedSpotPrice]);
  
  // Listen for storage events (when localStorage is updated in another tab)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const newData = JSON.parse(event.newValue);
          setSharedSpotPrice(newData);
        } catch (error) {
          console.error('Failed to parse storage data:', error);
        }
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
  }, []);

  return (
    <MetalPriceContext.Provider 
      value={{ 
        lastFetchTime,
        sharedSpotPrice,
        updateSharedSpotPrice,
        triggerRefresh,
        registerRefreshListener,
        forceSync
      }}
    >
      {children}
    </MetalPriceContext.Provider>
  );
}

export function useMetalPrice() {
  const context = useContext(MetalPriceContext);
  if (context === undefined) {
    throw new Error('useMetalPrice must be used within a MetalPriceProvider');
  }
  return context;
} 