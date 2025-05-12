import { useState, useEffect } from 'react';

interface PriceData {
  price: number;
  site_rate_change: string;
}

interface AluminiumData {
  date: string;
  time: string;
  timestamp: string;
  prices: {
    [key: string]: PriceData;
  };
}

interface MCXPriceData {
  currentPrice: number;
  lastUpdated: string;
  change: number;
  changePercent: number;
}

// Create a shared state object to store MCX price data between components
// This simulates accessing MCXAluminium component data
if (typeof window !== 'undefined' && !window.hasOwnProperty('sharedMCXPrice')) {
  Object.defineProperty(window, 'sharedMCXPrice', {
    value: {
      currentPrice: null as number | null,
      lastUpdated: null as string | null,
      change: null as number | null,
      changePercent: null as number | null,
      source: null as string | null
    },
    writable: true
  });
}

// Helper function to parse the rate change string
function parseRateChangeString(rateChangeStr: string): { change: number; changePercent: number } {
  try {
    const changeMatch = rateChangeStr.match(/^([-+]?\d+\.?\d*)\s*\(([-+]?\d+\.?\d*)%\)$/);
    return {
      change: changeMatch ? parseFloat(changeMatch[1]) : 0,
      changePercent: changeMatch ? parseFloat(changeMatch[2]) : 0
    };
  } catch (error) {
    console.error('Error parsing rate change string:', error);
    return { change: 0, changePercent: 0 };
  }
}

export function useMCXPrice() {
  const [priceData, setPriceData] = useState<MCXPriceData>({
    currentPrice: 243.75, // Default fallback value
    lastUpdated: new Date().toISOString(),
    change: 0,
    changePercent: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let updateInterval: NodeJS.Timeout;
    let retryTimeout: NodeJS.Timeout;
    const RETRY_DELAY = 5000; // 5 seconds
    const UPDATE_INTERVAL = 30000; // 30 seconds

    const fetchData = async () => {
      if (!mounted) return;
      
      try {
        setLoading(true);
        
        // Step 1: Check if MCXAluminium component has already fetched price data
        const sharedMCXPrice = window?.sharedMCXPrice as {
          currentPrice: number | null;
          lastUpdated: string | null;
          change: number | null;
          changePercent: number | null;
          source: string | null;
        } | undefined;
        
        // If the dashboard component has data, use it
        if (sharedMCXPrice && 
            sharedMCXPrice.currentPrice !== null && 
            sharedMCXPrice.lastUpdated !== null &&
            sharedMCXPrice.change !== null &&
            sharedMCXPrice.changePercent !== null) {
          console.log('Using MCX price from dashboard component');
          setPriceData({
            currentPrice: sharedMCXPrice.currentPrice,
            lastUpdated: sharedMCXPrice.lastUpdated,
            change: sharedMCXPrice.change,
            changePercent: sharedMCXPrice.changePercent
          });
          setError(null);
          setLoading(false);
          return;
        }
        
        // Step 2: Try fetching from the API endpoint
        try {
          const response = await fetch('/api/mcx-aluminium');
          
          if (response.ok) {
            const fetchedData: AluminiumData = await response.json();
            
            // Extract the current month's price (first in the list)
            const monthNames = Object.keys(fetchedData.prices);
            if (monthNames.length > 0) {
              const currentMonth = monthNames[0];
              const priceInfo = fetchedData.prices[currentMonth];
              
              // Parse the rate change string
              const { change, changePercent } = parseRateChangeString(priceInfo.site_rate_change);
              
              const newPriceData = {
                currentPrice: priceInfo.price,
                lastUpdated: fetchedData.timestamp,
                change,
                changePercent
              };
              
              // Update shared state for other components
              if (sharedMCXPrice) {
                sharedMCXPrice.currentPrice = newPriceData.currentPrice;
                sharedMCXPrice.lastUpdated = newPriceData.lastUpdated;
                sharedMCXPrice.change = newPriceData.change;
                sharedMCXPrice.changePercent = newPriceData.changePercent;
                sharedMCXPrice.source = 'api';
              }
              
              setPriceData(newPriceData);
              setError(null);
              setLoading(false);
              console.log('MCX price fetched from API:', newPriceData);
              return;
            }
          } else {
            throw new Error('API request failed');
          }
        } catch (apiError) {
          console.error('Error fetching from MCX API:', apiError);
          // Continue to the next fallback option
        }
        
        // Step 3: Try fetching from a different endpoint (3-month data)
        try {
          const threeMonthResponse = await fetch('/api/3_month_mcx?action=view&limit=1');
          
          if (threeMonthResponse.ok) {
            const result = await threeMonthResponse.json();
            
            if (result.success && result.data?.length > 0) {
              const rawData = result.data[0];
              
              // Ensure we have valid numbers
              const currentPrice = parseFloat(rawData.month1Price);
              const change = parseFloat(rawData.month1RateVal || '0');
              const changePercent = parseFloat(rawData.month1RatePct || '0');
              
              if (!isNaN(currentPrice)) {
                const newPriceData = {
                  currentPrice,
                  lastUpdated: rawData.timestamp || new Date().toISOString(),
                  change: isNaN(change) ? 0 : change,
                  changePercent: isNaN(changePercent) ? 0 : changePercent
                };
                
                // Update shared state for other components
                if (sharedMCXPrice) {
                  sharedMCXPrice.currentPrice = newPriceData.currentPrice;
                  sharedMCXPrice.lastUpdated = newPriceData.lastUpdated;
                  sharedMCXPrice.change = newPriceData.change;
                  sharedMCXPrice.changePercent = newPriceData.changePercent;
                  sharedMCXPrice.source = 'database';
                }
                
                setPriceData(newPriceData);
                setError(null);
                setLoading(false);
                console.log('MCX price fetched from database:', newPriceData);
                return;
              }
            }
          }
        } catch (dbError) {
          console.error('Error fetching from MCX database:', dbError);
        }
        
        // Step 4: Keep using existing data if it exists, otherwise use fallback
        if (!priceData.currentPrice) {
          const fallbackData = {
            currentPrice: 243.75,
            lastUpdated: new Date().toISOString(),
            change: 0,
            changePercent: 0
          };
          
          console.log('Using fallback MCX price data');
          setPriceData(fallbackData);
        }
        
      } catch (err) {
        console.error('Error in MCX price fetching:', err);
        setError('Failed to load MCX data');
        
        // Keep using existing data or fallback
        if (!priceData.currentPrice) {
          setPriceData({
            currentPrice: 243.75,
            lastUpdated: new Date().toISOString(),
            change: 0,
            changePercent: 0
          });
        }
        
        retryTimeout = setTimeout(fetchData, RETRY_DELAY);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    updateInterval = setInterval(fetchData, UPDATE_INTERVAL);
    
    return () => {
      mounted = false;
      clearInterval(updateInterval);
      clearTimeout(retryTimeout);
    };
  }, []);

  return { priceData, loading, error };
}