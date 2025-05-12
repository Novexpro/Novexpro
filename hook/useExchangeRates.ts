import { useState, useEffect } from 'react';

interface ExchangeRates {
  RBI: number;
  SBI: number;
  lastUpdated: string;
}

// Create a shared state object to store rates between components
// This simulates accessing RatesDisplay component data
if (typeof window !== 'undefined' && !window.hasOwnProperty('sharedRates')) {
  Object.defineProperty(window, 'sharedRates', {
    value: {
      RBI: null as number | null,
      SBI: null as number | null,
      lastUpdated: null as string | null
    },
    writable: true
  });
}

export function useExchangeRates() {
  const [ratesData, setRatesData] = useState<ExchangeRates>({
    RBI: 84.4063, // Default fallback value
    SBI: 84.6500, // Default fallback value
    lastUpdated: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let updateInterval: NodeJS.Timeout;
    let retryTimeout: NodeJS.Timeout;
    const RETRY_DELAY = 5000; // 5 seconds

    const fetchExchangeRates = async () => {
      if (!mounted) return;
      
      try {
        // Step 1: Check if RatesDisplay has already fetched rates
        const sharedRates = window?.sharedRates as { 
          RBI: number | null, 
          SBI: number | null, 
          lastUpdated: string | null 
        } | undefined;
        
        let rbiRate = ratesData.RBI; // Default to current value
        let sbiRate = ratesData.SBI; // Default to current value
        let dataSource = 'default';
        
        // If RatesDisplay has rates data, use it
        if (sharedRates && sharedRates.RBI !== null && sharedRates.SBI !== null) {
          console.log('Using rates from RatesDisplay component');
          rbiRate = sharedRates.RBI;
          sbiRate = sharedRates.SBI;
          dataSource = 'ratesDisplay';
        } else {
          // Step 2: Try fetching from APIs if RatesDisplay data isn't available
          
          // Fetch SBI TT Rate
          try {
            const sbiResponse = await fetch('/api/sbitt');
            
            if (sbiResponse.ok) {
              const sbiData = await sbiResponse.json();
              if (sbiData.success && sbiData.data && sbiData.data.length > 0) {
                const parsedRate = parseFloat(sbiData.data[0].sbi_tt_sell);
                
                if (!isNaN(parsedRate) && parsedRate > 0) {
                  sbiRate = parsedRate;
                  
                  // Store in shared state for other components
                  if (sharedRates) {
                    sharedRates.SBI = sbiRate;
                    if (sharedRates.lastUpdated === null) {
                      sharedRates.lastUpdated = new Date().toISOString();
                    }
                  }
                  
                  dataSource = 'api';
                }
              }
            }
          } catch (sbiError) {
            console.error('Error fetching SBI rate:', sbiError);
            // Continue with current/fallback value
          }
          
          // Fetch RBI Rate
          try {
            const rbiResponse = await fetch('/api/rbi');
            
            if (rbiResponse.ok) {
              const rbiData = await rbiResponse.json();
              if (rbiData.success && rbiData.data && rbiData.data.length > 0) {
                const parsedRate = parseFloat(rbiData.data[0].rate);
                
                if (!isNaN(parsedRate) && parsedRate > 0) {
                  rbiRate = parsedRate;
                  
                  // Store in shared state for other components
                  if (sharedRates) {
                    sharedRates.RBI = rbiRate;
                    if (sharedRates.lastUpdated === null) {
                      sharedRates.lastUpdated = new Date().toISOString();
                    }
                  }
                  
                  dataSource = 'api';
                }
              }
            }
          } catch (rbiError) {
            console.error('Error fetching RBI rate:', rbiError);
            // Continue with current/fallback value
          }
        }
        
        // Only update state if we have valid rates
        if (rbiRate > 0 && sbiRate > 0) {
          setRatesData({
            RBI: rbiRate,
            SBI: sbiRate,
            lastUpdated: new Date().toISOString()
          });
        }
        
        console.log(`Exchange rates loaded from ${dataSource}. RBI: ${rbiRate}, SBI: ${sbiRate}`);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error fetching exchange rates:', err);
        setError('Failed to fetch live exchange rates');
        setLoading(false);
        
        // Keep using the default or last known values if they're valid
        if (ratesData.RBI <= 0 || ratesData.SBI <= 0) {
          setRatesData({
            RBI: 84.4063, // Default fallback value
            SBI: 84.6500, // Default fallback value
            lastUpdated: new Date().toISOString()
          });
        }
        
        retryTimeout = setTimeout(fetchExchangeRates, RETRY_DELAY);
      }
    };

    fetchExchangeRates();
    updateInterval = setInterval(fetchExchangeRates, 60000); // Update every minute

    return () => {
      mounted = false;
      clearInterval(updateInterval);
      clearTimeout(retryTimeout);
    };
  }, []);

  return { ratesData, loading, error };
} 