import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Response interface for properly typed API responses
interface ApiResponse {
  type: 'spotPrice' | 'averagePrice' | 'noData' | 'cashSettlement';
  spotPrice?: number;
  change?: number;
  changePercent?: number;
  lastUpdated?: string;
  fresh?: boolean;
  source?: string;
  dataPointsCount?: number;
  error?: string;
  message?: string;
  lastCashSettlementPrice?: number | null;
  averagePrice?: number; // Added for average price responses
}

// New interface for average price data
interface AveragePriceData {
  averagePrice: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  dataPointsCount: number;
  lastCashSettlementPrice?: number | null;
}

// Properly typed cache for API responses
interface CacheData {
  data: (ApiResponse & { metal?: string }) | null;
  timestamp: number;
  ttl: number;
}

// Cache for API responses to reduce database load
let responseCache: CacheData = {
  data: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000, // 5 minutes cache TTL
};

// Additional interface for cash settlement data
interface CashSettlementData {
  value: number;
  dateTime: string;
}

// In-memory storage for cash settlement data
let cachedCashSettlement: CashSettlementData | null = null;

// Interface for external API response data
interface ExternalApiData {
  spot_price?: number | null;
  price_change?: number | null;
  change_percentage?: number | null;
  last_updated?: string;
  cash_settlement?: number | null;
  is_cash_settlement?: boolean;
  type?: string; // Add type field
}

// Service function to fetch data from external API
async function fetchExternalPriceData(): Promise<ExternalApiData> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://148.135.138.22:3232';
    const apiEndpoint = `${backendUrl}/api/price-data`;
    
    console.log(`Attempting to fetch data from external API: ${apiEndpoint}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      console.log('Initiating fetch request to external API...');
      const response = await fetch(apiEndpoint, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      console.log(`External API response status: ${response.status}`);
    
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`External API returned status ${response.status}: ${errorText}`);
        throw new Error(`External API returned status ${response.status}: ${errorText}`);
      }
    
      let data: ExternalApiData;
      try {
        const responseText = await response.text();
        console.log('Raw response from external API:', responseText.substring(0, 500));
        data = JSON.parse(responseText);
        
        // Log the data type and values
        console.log('API response data:', {
          type: data.type,
          spot_price: data.spot_price,
          price_change: data.price_change,
          change_percentage: data.change_percentage,
          last_updated: data.last_updated
        });
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        throw new Error(`Failed to parse API response as JSON: ${parseError}`);
      }
      
      // Check if this is cash settlement data based on type
      if (data.type === 'cash_settlement') {
        console.log('Detected cash settlement data from type field');
        return {
          ...data,
          is_cash_settlement: true
        };
      }
      
      // If no type but we have cash settlement value
      if (data.cash_settlement !== null && data.cash_settlement !== undefined) {
        console.log('Using cash settlement data from API:', data.cash_settlement);
        return {
          ...data,
          is_cash_settlement: true,
          spot_price: data.cash_settlement
        };
      }
      
      // If we have spot price data
      if (data.spot_price !== null && data.spot_price !== undefined) {
        return data;
      }
      
      // If we have no valid data, use mock data for testing
      console.log('NOTICE: External API returned invalid/empty data, using MOCK data for testing');
      return {
        spot_price: 2439,
        price_change: -9,
        change_percentage: -0.3676,
        last_updated: new Date().toISOString(),
        is_cash_settlement: false
      };
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error in inner fetch:", error);
      throw error;
    }
  } catch (error) {
    console.error('Error fetching from external API:', error);
    
    // Make a direct fetch to test the exact API response
    console.log('Attempting direct fetch to diagnose issue...');
    try {
      const backendUrl = 'http://148.135.138.22:3232';
      const resp = await fetch(`${backendUrl}/api/price-data`, {
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' }
      });
      const textResponse = await resp.text();
      console.log('Direct API fetch response:', textResponse);
    } catch(directError) {
      console.error('Even direct fetch failed:', directError);
    }
    
    // Return mock data for testing when API fails
    console.log('NOTICE: Using MOCK data due to API failure');
    return {
      spot_price: 2439,
      price_change: -9,
      change_percentage: -0.3676,
      last_updated: new Date().toISOString(),
      is_cash_settlement: false
    };
  }
}

// Interface for processed API data
interface ProcessedApiData {
  spotPrice: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  isCashSettlement: boolean;
}

// Service function to process external API data into our format
function processExternalData(externalData: ExternalApiData): ProcessedApiData {
  console.log('Processing external data:', JSON.stringify(externalData));
  
  // Safety check - if we got null/undefined, create an empty object
  if (!externalData) {
    console.error('Received null/undefined external data, using default values');
    externalData = {
      spot_price: 0,
      price_change: 0,
      change_percentage: 0,
      last_updated: new Date().toISOString()
    };
  }
  
  // Check if this is cash settlement data - now also checking the type field
  const isCashSettlement = Boolean(
    externalData.is_cash_settlement || 
    externalData.type === 'cash_settlement' ||
    (externalData.cash_settlement !== null && externalData.cash_settlement !== undefined)
  );
  
  // Determine the spot price based on data type
  let spotPrice = 0;
  if (isCashSettlement) {
    // For cash settlement, use the spot_price value directly
    spotPrice = Number(externalData.spot_price);
    console.log(`Using cash settlement value as spot price: ${spotPrice}`);
  } else if (externalData.spot_price !== null && externalData.spot_price !== undefined) {
    // For regular spot price data
    spotPrice = Number(externalData.spot_price);
    console.log(`Using regular spot price: ${spotPrice}`);
  }
      
  if (spotPrice === 0) {
    console.error('No valid price data found in API response');
    spotPrice = 2500; // Default fallback
    console.log('Using default spot price value:', spotPrice);
  }
  
  // Extract change data with fallbacks
  const change = externalData.price_change !== undefined && externalData.price_change !== null 
    ? Number(externalData.price_change) 
    : 0;
  
  console.log(`Using change value: ${change} (${typeof externalData.price_change}, raw value: ${externalData.price_change})`);
  
  // Only apply change formula for non-cash settlement data
  if (!isCashSettlement && change !== 0) {
    spotPrice = spotPrice + change;
    console.log(`Applied formula spotPrice + change: ${spotPrice - change} + ${change} = ${spotPrice}`);
  }
  
  const changePercent = externalData.change_percentage !== undefined && externalData.change_percentage !== null
    ? Number(externalData.change_percentage) 
    : 0;
  
  // Ensure we have a valid date
  const lastUpdated = externalData.last_updated && externalData.last_updated.trim() !== '' 
    ? externalData.last_updated 
    : new Date().toISOString();
  
  console.log(`Processed data: spotPrice=${spotPrice}, change=${change}, changePercent=${changePercent}, lastUpdated=${lastUpdated}, isCashSettlement=${isCashSettlement}`);
  
  return {
    spotPrice,
    change,
    changePercent,
    lastUpdated,
    isCashSettlement
  };
}

// Function to get latest price with auto-refresh when stale
async function getLatestPriceWithRefresh(forceRefresh: boolean = false): Promise<ApiResponse> {
  console.log(`getLatestPriceWithRefresh called, forceRefresh=${forceRefresh}`);
  
  try {
    // Check cache first, even when forceRefresh is true to avoid unnecessary API calls
    if (responseCache.data && Date.now() - responseCache.timestamp < responseCache.ttl) {
      console.log('Returning cached data (cache is still valid)');
      // Ensure change value is not undefined or null
      if (responseCache.data.change === undefined || responseCache.data.change === null) {
        responseCache.data.change = 0;
        console.log('Fixed cached data to include default change value');
      }
      return responseCache.data;
    }
    
    // Check database first, even for force refresh, to avoid unnecessary writes
    const latestPrice = await prisma.metalPrice.findFirst({
      where: { 
        source: 'metal-price'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Database query result: ${latestPrice ? `Found record with change=${latestPrice.change}` : 'No records found'}`);
    
    // If force refresh is requested, try to fetch new data from external API
    if (forceRefresh) {
      console.log('Force refresh requested, fetching from external API');
      try {
        // Get fresh data from external API
        const externalData = await fetchExternalPriceData();
        
        console.log('External data received:', JSON.stringify(externalData));
        
        // Check if we received cash settlement data
        if (externalData.cash_settlement !== null && externalData.cash_settlement !== undefined) {
          console.log('Received cash settlement data:', externalData.cash_settlement);
          
          // Save cash settlement data to database
          const price = Number(externalData.cash_settlement);
          const dateTime = externalData.last_updated || new Date().toISOString();
          
          try {
            await saveCashSettlementToDatabase(price, dateTime);
            console.log('Successfully saved cash settlement data to database');
            
            // Return cash settlement response
            return {
              type: 'cashSettlement',
              lastCashSettlementPrice: price,
              lastUpdated: dateTime,
              fresh: true,
              source: 'external-api',
              change: 0, // Add default change value
              message: 'Cash settlement data saved to database'
            };
          } catch (cashSaveError) {
            console.error('Error saving cash settlement data:', cashSaveError);
            // Continue with regular processing
          }
        }
        
        // Check if we got valid data (not the empty fallback)
        if (!externalData || 
            (externalData.spot_price === null && externalData.price_change === null && 
             externalData.cash_settlement === null)) {
          console.log('External API returned fallback/empty data, falling back to database');
          throw new Error('External API unavailable');
        }
        
        // Process the data
        const { spotPrice, change, changePercent, lastUpdated, isCashSettlement } = processExternalData(externalData);
        
        console.log(`Processed data: spotPrice=${spotPrice}, change=${change}, changePercent=${changePercent}, isCashSettlement=${isCashSettlement}`);
        
        // If this is cash settlement data, handle it differently
        if (isCashSettlement && externalData.cash_settlement !== null && externalData.cash_settlement !== undefined) {
          const cashPrice = Number(externalData.cash_settlement);
          
          try {
            // Try to save to the cash settlement table
            const savedCash = await saveCashSettlementToDatabase(
              cashPrice,
              lastUpdated
            );
            
            console.log('Saved cash settlement data to database');
            
            // Return cash settlement data
            return {
              type: 'cashSettlement',
              lastCashSettlementPrice: cashPrice,
              lastUpdated: savedCash.date,
              fresh: true,
              source: 'external-api',
              change: 0 // Add default change value
            };
          } catch (cashError) {
            console.error('Failed to save cash settlement data:', cashError);
            // Continue with regular processing
          }
        }
        
        // Check if this data is different from what we already have in the database
        if (latestPrice && Math.abs(Number(latestPrice.change) - change) < 0.001) {
          console.log(`Change value (${change}) is identical to latest database record (${latestPrice.change}), skipping database write`);
          
          // Return the data we already have but with fresh flag
          return {
            type: 'spotPrice',
            spotPrice: Number(spotPrice),
            change: Number(latestPrice.change) || 0, // Ensure non-null change value
            changePercent: Number(changePercent) || 0,
            lastUpdated: latestPrice.createdAt.toISOString(),
            fresh: true,
            source: 'database-cached'
          };
        }
        
        // Always save to database, even with zero spotPrice, since we only care about the change value
        // Format the date properly
        const formattedDate = new Date();
        
        // USE TRY-CATCH TO ISOLATE DATABASE ERRORS
        let savedRecord = null;
        try {
          console.log(`Explicitly saving to database: change=${change}, date=${formattedDate}`);
          console.log(`NOTE: ONLY the change value (${change}) will be saved, spotPrice and changePercent will be set to 0.0`);
          
          // Save the data with actual values
          savedRecord = await prisma.metalPrice.create({
            data: {
              spotPrice: 0.0,
              change: change,
              changePercent: 0.0,
              source: 'metal-price',
              createdAt: formattedDate
            }
          });
          
          console.log('Successfully saved new price data to database with ID:', savedRecord.id);
          console.log(`Saved record values: change=${savedRecord.change}, spotPrice=${savedRecord.spotPrice}, changePercent=${savedRecord.changePercent}`);
        } catch (saveErr) {
          console.error('ERROR SAVING TO DATABASE - DETAILED ERROR:', saveErr);
          // Don't rethrow, continue with the data we have
        }
        
        // Return the fresh data immediately, including the original spotPrice for display
        const result: ApiResponse = {
          type: 'spotPrice',
          spotPrice: Number(spotPrice),
          change: Number(change) || 0, // Ensure non-null change value
          changePercent: Number(changePercent) || 0,
          lastUpdated: formattedDate.toISOString(),
          fresh: true,
          source: 'external'
        };
        
        // Add info about saving to database
        if (savedRecord) {
          result.message = `Data saved to database with ID: ${savedRecord.id}`;
        } else {
          result.message = 'API data retrieved but NOT saved to database due to error';
        }
        
        return result;
      } catch (apiError) {
        console.error('External API error during force refresh:', apiError);
        // Continue to database query below
      }
    }
    
    // Use the latestPrice we already queried above
    console.log(`Database check result: ${latestPrice ? 'Found data' : 'No data'}`);
    
    // If no data in database, handle gracefully
    if (!latestPrice) {
      console.log('No data in database, returning graceful no-data response');
      return {
        type: 'noData',
        error: 'No price data available',
        message: 'No price data could be retrieved from database or external API',
        source: 'database',
        change: 0 // Add default change value
      };
    }
    
    // Return database data
    console.log(`Returning database data: spotPrice=${latestPrice.spotPrice}, change=${latestPrice.change}, date=${latestPrice.createdAt}`);
    return {
      type: 'spotPrice',
      spotPrice: Number(latestPrice.spotPrice),
      change: Number(latestPrice.change) || 0, // Ensure non-null change value
      changePercent: Number(latestPrice.changePercent) || 0,
      lastUpdated: latestPrice.createdAt.toISOString(),
      source: 'database'
    };
  } catch (error) {
    console.error('Error getting price data:', error);
    throw error;
  }
}

// Cache control headers to prevent browser caching
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// Function to clean up old records, keeping only the most recent ones
async function cleanupOldRecords(keepCount = 1000) {
  try {
    const totalCount = await prisma.metalPrice.count();
    if (totalCount <= keepCount) {
      return;
    }
    
    console.log(`Cleaning up price records (keeping ${keepCount} of ${totalCount})`);
    
    // Get IDs of records to keep
    const recordsToKeep = await prisma.metalPrice.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: keepCount,
      select: { id: true }
    });
    
    const keepIds = recordsToKeep.map(record => record.id);
    
    // Delete records not in the keep list
    const deleteResult = await prisma.metalPrice.deleteMany({
      where: {
        id: { notIn: keepIds }
      }
    });
    
    console.log(`Deleted ${deleteResult.count} old price records`);
  } catch (error) {
    console.error('Error during cleanup process:', error);
  }
}

// Function to deduplicate records - more aggressive approach
async function removeDuplicateRecords() {
  try {
    const records = await prisma.metalPrice.findMany({
      select: {
        id: true,
        createdAt: true,
        spotPrice: true,
        change: true,
        changePercent: true,
        source: true
      },
      orderBy: [
        { createdAt: 'asc' },
        { spotPrice: 'asc' }
      ]
    });
    
    // Track timestamps and values we've seen
    const seen = new Map();
    const duplicateIds = [];
    
    for (const record of records) {
      // Create a composite key of timestamp and price
      const timestamp = record.createdAt.toISOString();
      const key = `${timestamp}_${record.spotPrice}`;
      
      if (seen.has(key)) {
        // This is a duplicate, mark for deletion
        duplicateIds.push(record.id);
      } else {
        // First time seeing this timestamp+price combination
        seen.set(key, true);
      }
    }
    
    if (duplicateIds.length > 0) {
      // Delete all duplicates
      const deleteResult = await prisma.metalPrice.deleteMany({
        where: {
          id: { in: duplicateIds }
        }
      });
      
      console.log(`Deleted ${deleteResult.count} duplicate price records`);
    }
  } catch (error) {
    console.error('Error removing duplicate records:', error);
  }
}

// Function to calculate daily average price for today
async function calculateDailyAverage(): Promise<AveragePriceData | null> {
  try {
    // Get the most recent cash settlement from LME_West_Metal_Price
    const latestCashSettlement = await prisma.lME_West_Metal_Price.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get the last cash settlement price for reference
    const lastCashSettlementPrice = latestCashSettlement ? Number(latestCashSettlement.Price) : null;

    // If no cash settlement available or price is null, use a fallback approach with today's date
    if (!latestCashSettlement || lastCashSettlementPrice === null) {
      console.log('No cash settlement found, using current day as fallback reset point');
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Find all records for today as fallback
      const todayRecords = await prisma.metalPrice.findMany({
        where: {
          createdAt: {
            gte: today
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      
      if (todayRecords.length === 0) {
        console.log('No records found for average calculation and no CSP available, returning null');
        return null;
      }
      
      // Calculate average of spot prices (or changes when applicable)
      const totalSpotPrice = todayRecords.reduce((sum, record) => {
        // If the record has a non-zero spotPrice, use it
        if (Number(record.spotPrice) > 0) {
          return sum + Number(record.spotPrice);
        }
        // Otherwise, calculate a spot price based on previous average + change
        else if (Number(record.change) !== 0) {
          // We can't meaningfully calculate a spot price just from change in this fallback case
          return sum;
        }
        return sum;
      }, 0);
      
      // Calculate average change for informational purposes
      const totalChange = todayRecords.reduce((sum, record) => sum + Number(record.change), 0);
      const averageChange = totalChange / todayRecords.length;
      
      // Get the last record to use its timestamp
      const latestRecord = todayRecords[todayRecords.length - 1];
      
      // If we couldn't calculate a meaningful average, return change info only
      if (totalSpotPrice === 0) {
        return {
          averagePrice: 0,
          change: averageChange,
          changePercent: 0,
          lastUpdated: latestRecord.createdAt.toISOString(),
          dataPointsCount: todayRecords.length,
          lastCashSettlementPrice: null
        };
      }
      
      const averageSpotPrice = totalSpotPrice / todayRecords.length;
      
      return {
        averagePrice: averageSpotPrice,
        change: averageChange,
        changePercent: 0, // Cannot calculate meaningful percent without reference point
        lastUpdated: latestRecord.createdAt.toISOString(),
        dataPointsCount: todayRecords.length,
        lastCashSettlementPrice: null
      };
    }
    
    // Get the creation date of the latest cash settlement to use as reset point
    const cashSettlementCreatedAt = latestCashSettlement.createdAt;
    console.log(`Using cash settlement from ${cashSettlementCreatedAt.toISOString()} as reset point`);
    
    // Find all records since the latest cash settlement was created
    const recordsSinceCashSettlement = await prisma.metalPrice.findMany({
      where: {
        createdAt: {
          gte: cashSettlementCreatedAt
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    console.log(`Found ${recordsSinceCashSettlement.length} records since last cash settlement`);

    // If no records found since the last cash settlement, we can't calculate an average
    if (recordsSinceCashSettlement.length === 0) {
      console.log('No records found since last cash settlement, cannot calculate average');
      return {
        averagePrice: 0,
        change: 0,
        changePercent: 0,
        lastUpdated: cashSettlementCreatedAt.toISOString(),
        dataPointsCount: 0,
        lastCashSettlementPrice
      };
    }

    // Calculate the average of spot prices since the last cash settlement
    // This is the main calculation - we don't add to the cash settlement price
    let validRecordsCount = 0;
    const totalSpotPrice = recordsSinceCashSettlement.reduce((sum, record) => {
      const spotPrice = Number(record.spotPrice);
      // Only include non-zero spot prices
      if (spotPrice > 0) {
        validRecordsCount++;
        return sum + spotPrice;
      }
      return sum;
    }, 0);
    
    // Calculate average change for informational purposes
    const totalChange = recordsSinceCashSettlement.reduce((sum, record) => sum + Number(record.change), 0);
    const averageChange = totalChange / recordsSinceCashSettlement.length;

    // Get the last record to use its timestamp
    const latestRecord = recordsSinceCashSettlement[recordsSinceCashSettlement.length - 1];

    // If no valid spot prices were found, we can't calculate a meaningful average
    if (validRecordsCount === 0) {
      console.log('No valid spot prices found since last cash settlement');
      return {
        averagePrice: 0,
        change: averageChange,
        changePercent: 0,
        lastUpdated: latestRecord.createdAt.toISOString(), 
        dataPointsCount: recordsSinceCashSettlement.length,
        lastCashSettlementPrice
      };
    }
    
    const averageSpotPrice = totalSpotPrice / validRecordsCount;
    
    console.log(`Calculated average price: ${averageSpotPrice} from ${validRecordsCount} valid records`);
    console.log(`Average change since last cash settlement: ${averageChange}`);
    
    return {
      averagePrice: averageSpotPrice,
      change: averageChange,
      changePercent: lastCashSettlementPrice ? (averageChange / lastCashSettlementPrice) * 100 : 0,
      lastUpdated: latestRecord.createdAt.toISOString(),
      dataPointsCount: recordsSinceCashSettlement.length,
      lastCashSettlementPrice
    };
  } catch (error) {
    console.error('Error calculating average price:', error);
    return null;
  }
}

// New function to save cash settlement data to database
async function saveCashSettlementToDatabase(
  price: number, 
  dateTime: string
): Promise<{ id: number; date: string; Price: number; createdAt: Date }> {
  try {
    if (isNaN(price) || price <= 0) {
      console.error('Invalid price provided for cash settlement:', price);
      throw new Error(`Invalid price value: ${price}`);
    }
    
    console.log(`Attempting to save cash settlement price: ${price}, dateTime: ${dateTime}`);
    
    // Parse and format the date
    let formattedDate: string;
    try {
      // Parse the date string into a Date object
      const date = new Date(dateTime);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date provided:', dateTime);
        // Fallback to current date if the provided date is invalid
        formattedDate = new Date().toISOString().split('T')[0];
      } else {
        // Format as YYYY-MM-DD
        formattedDate = date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.error('Error parsing date:', error);
      // Fallback to current date in case of any error
      formattedDate = new Date().toISOString().split('T')[0];
    }
    
    console.log(`Saving price ${price} for date ${formattedDate}`);
    
    // Check if a record for this date already exists
    const existingRecord = await prisma.lME_West_Metal_Price.findFirst({
      where: { date: formattedDate }
    });
    
    try {
      if (existingRecord) {
        // Update existing record
        console.log(`Updating existing record for date ${formattedDate} with price ${price}`);
        const updatedRecord = await prisma.lME_West_Metal_Price.update({
          where: { id: existingRecord.id },
          data: { 
            Price: price
          }
        });
        console.log('Successfully updated cash settlement record:', updatedRecord);
        return updatedRecord;
      } else {
        // Create a new record
        console.log(`Creating new record for date ${formattedDate} with price ${price}`);
        const newRecord = await prisma.lME_West_Metal_Price.create({
          data: {
            date: formattedDate,
            Price: price
          }
        });
        console.log('Successfully created new cash settlement record:', newRecord);
        return newRecord;
      }
    } catch (dbError) {
      console.error('Database error while saving cash settlement:', dbError);
      throw new Error(`Database error: ${dbError}`);
    }
  } catch (error) {
    console.error('Error saving cash settlement to database:', error);
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(`API request received: ${req.method} ${req.url}`);
  console.log('Query parameters:', req.query);
  
  // Set cache control headers to prevent browser caching
  res.setHeader('Cache-Control', noCacheHeaders['Cache-Control']);
  res.setHeader('Pragma', noCacheHeaders['Pragma']);
  res.setHeader('Expires', noCacheHeaders['Expires']);
  
  // Automatic cleanup - run occasionally based on probability to avoid too many operations
  // But make sure it runs periodically to keep the database size in check
  try {
    // Get the current timestamp
    const now = Date.now();
    
    // Declare interface for global with lastCleanupTime property
    interface CustomGlobal {
      lastCleanupTime?: number;
    }
    
    // Type cast global to our custom interface
    const globalWithCleanup = global as unknown as CustomGlobal;
    
    // Store the last cleanup time in a global variable (will reset on server restart)
    if (!globalWithCleanup.lastCleanupTime) {
      globalWithCleanup.lastCleanupTime = 0;
    }
    
    // Only clean up if it's been at least 6 hours since last cleanup
    // and with a 10% probability to avoid too many operations
    const sixHoursMs = 6 * 60 * 60 * 1000;
    if (now - globalWithCleanup.lastCleanupTime > sixHoursMs && Math.random() < 0.1) {
      console.log('Running automatic database cleanup...');
      
      // Run cleanup for aluminum (most common metal)
      await removeDuplicateRecords();
      await cleanupOldRecords(200); // Keep only 200 recent records
      
      // Update last cleanup time
      globalWithCleanup.lastCleanupTime = now;
      console.log('Automatic cleanup completed');
    }
  } catch (cleanupError) {
    console.error('Error in automatic cleanup:', cleanupError);
    // Don't fail the request due to cleanup error
  }
  
  // Endpoint to add a new cash settlement price record
  if (req.query.addCashSettlement === 'true') {
    // Only allow POST requests for database updates
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed', message: 'Only POST requests are allowed for database updates' });
    }
    
    // IMPORTANT: Add authentication here
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_UPDATE_KEY) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Valid API key required for database updates' });
    }
    
    try {
      const { price, date } = req.body;
      
      if (!price || !date) {
        return res.status(400).json({ error: 'Bad request', message: 'price and date are required fields' });
      }
      
      // Check if a record for this date already exists
      const existingRecord = await prisma.lME_West_Metal_Price.findFirst({
        where: { date }
      });
      
      if (existingRecord) {
        // If it exists, update it
        const updatedRecord = await prisma.lME_West_Metal_Price.update({
          where: { id: existingRecord.id },
          data: { Price: Number(price) }
        });
        
        return res.status(200).json({
          success: true,
          message: 'Cash settlement price updated',
          data: updatedRecord
        });
      } else {
        // Create a new record
        const newRecord = await prisma.lME_West_Metal_Price.create({
          data: {
            date,
            Price: Number(price)
          }
        });
        
        return res.status(201).json({
          success: true,
          message: 'Cash settlement price added',
          data: newRecord
        });
      }
    } catch (error) {
      console.error('Error adding cash settlement data:', error);
      return res.status(500).json({ error: 'Internal server error', message: 'Failed to add cash settlement data' });
    } finally {
      await prisma.$disconnect();
      return;
    }
  }
  
  // Check if this is a request to update cash settlement data (legacy endpoint kept for compatibility)
  if (req.query.updateCashSettlement === 'true') {
    // Only allow POST requests for updates
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed', message: 'Only POST requests are allowed for updates' });
    }
    
    // IMPORTANT: Add authentication here
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_UPDATE_KEY) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Valid API key required for updates' });
    }
    
    try {
      const { cashSettlement, dateTime } = req.body;
      
      if (cashSettlement === undefined || cashSettlement === null) {
        return res.status(400).json({ error: 'Bad request', message: 'cashSettlement is required' });
      }
      
      // Update cached cash settlement data
      cachedCashSettlement = {
        value: Number(cashSettlement),
        dateTime: dateTime || new Date().toISOString(),
      };
      
      return res.status(200).json({
        success: true,
        message: 'Cash settlement data updated',
        data: cachedCashSettlement
      });
    } catch (error) {
      console.error('Error updating cash settlement data:', error);
      return res.status(500).json({ error: 'Internal server error', message: 'Failed to update cash settlement data' });
    }
  }
  
  // Special dedicated endpoint for fetching cash settlement data
  if (req.query.fetchCashSettlement === 'true') {
    try {
      console.log('Direct cash settlement fetch requested');
      
      // Always fetch fresh data from external API
      const externalData = await fetchExternalPriceData();
      console.log('External API response for cash settlement test:', externalData);
      
      // Check if we have cash settlement data
      if (externalData.cash_settlement !== null && externalData.cash_settlement !== undefined) {
        const price = Number(externalData.cash_settlement);
        const dateTime = externalData.last_updated || new Date().toISOString();
        
        // Validate the price
        if (isNaN(price) || price <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid cash settlement price received from API',
            raw_data: externalData
          });
        }
        
        try {
          // Save to database
          const savedRecord = await saveCashSettlementToDatabase(price, dateTime);
          console.log('Successfully saved cash settlement data in test endpoint:', savedRecord);
          
          return res.status(200).json({
            success: true,
            message: 'Cash settlement data fetched and saved successfully',
            data: {
              price: price,
              date: savedRecord.date,
              id: savedRecord.id,
              createdAt: savedRecord.createdAt
            },
            rawApiResponse: externalData
          });
        } catch (dbError) {
          console.error('Error saving cash settlement data to database:', dbError);
          return res.status(500).json({
            success: false,
            message: 'Error saving cash settlement data to database',
            error: String(dbError)
          });
        }
      } else {
        return res.status(404).json({
          success: false,
          message: 'No cash settlement data available from external API',
          raw_data: externalData
        });
      }
    } catch (error) {
      console.error('Error in direct cash settlement fetch:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching cash settlement data from external API',
        error: String(error)
      });
    } finally {
      await prisma.$disconnect();
      return;
    }
  }
  
  // Special case for Today's LME Cash Settlement data
  if (req.query.getCashSettlement === 'true') {
    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0];

      // Check for a force refresh parameter
      const forceRefresh = req.query._forceRefresh === 'true';
      console.log('Cash settlement request received, forceRefresh:', forceRefresh);

      // If we're forcing a refresh or have a timestamp, always try to fetch new data from external API first
      if (forceRefresh || req.query._t) {
        try {
          console.log('Attempting to fetch fresh data from external API');
          const externalData = await fetchExternalPriceData();
          
          console.log('External API response for cash settlement:', externalData);
          
          // Check if we have cash settlement data from external API
          if (externalData.type === 'cash_settlement' && externalData.spot_price !== null) {
            // We have data from external API, save it to database
            const price = Number(externalData.spot_price);
            const dateTime = externalData.last_updated || new Date().toISOString();
            
            console.log(`Saving cash settlement value: ${price}, dateTime: ${dateTime}`);
            
            // Save to database
            const savedRecord = await saveCashSettlementToDatabase(price, dateTime);
            console.log('Saved new cash settlement data to database:', savedRecord);
            
            // Return the data we just saved
            return res.status(200).json({
              type: 'cashSettlement',
              cashSettlement: price,
              dateTime: savedRecord.date,
              source: 'LME',
              success: true,
              fromExternalApi: true,
              fresh: true
            });
          } else {
            console.warn('External API did not return valid cash settlement data');
          }
        } catch (apiError) {
          console.error('Failed to fetch from external API:', apiError);
          // Continue to database fallback
        }
      }

      // First try to get data from the database for today
      const todaySettlements = await prisma.lME_West_Metal_Price.findMany({
        where: { 
          date: formattedDate
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      });

      // If data for today exists, return it
      if (todaySettlements && todaySettlements.length > 0) {
        const todaySettlement = todaySettlements[0];
        console.log('Returning today\'s settlement data from database:', todaySettlement);
        
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: todaySettlement.Price,
          dateTime: todaySettlement.date,
          source: 'LME',
          success: true,
          fromDatabase: true
        });
      }

      // If no data for today, try to fetch from external API as a fallback
      try {
        console.log('No data in database, attempting to fetch from external API');
        const externalData = await fetchExternalPriceData();
        
        // Check if we have cash settlement data from external API
        if (externalData.type === 'cash_settlement' && externalData.spot_price !== null) {
          // We have data from external API, save it to database
          const price = Number(externalData.spot_price);
          const dateTime = externalData.last_updated || new Date().toISOString();
          
          // Save to database
          const savedRecord = await saveCashSettlementToDatabase(price, dateTime);
          console.log('Saved new cash settlement data to database:', savedRecord);
          
          // Return the data we just saved
          return res.status(200).json({
            type: 'cashSettlement',
            cashSettlement: price,
            dateTime: savedRecord.date,
            source: 'LME',
            success: true,
            fromExternalApi: true
          });
        }
      } catch (apiError) {
        console.error('Failed to fetch from external API:', apiError);
        // Continue to fallback options
      }

      // If we reach here, there's no data for today - return a "no data" response
      return res.status(404).json({
        type: 'noData',
        success: false,
        message: 'No cash settlement data available for today'
      });
      
    } catch (error) {
      console.error('Error fetching cash settlement data:', error);
      return res.status(500).json({
        type: 'noData',
        error: 'Server error',
        message: 'Failed to fetch cash settlement data',
        success: false
      });
    } finally {
      await prisma.$disconnect();
    }
  }
  
  // Check if this is a database update request - only allow POST method
  if (req.query.updateDatabase === 'true') {
    // Only allow POST requests for database updates
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed', message: 'Only POST requests are allowed for database updates' });
    }
    
    // IMPORTANT: Add authentication here
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.API_UPDATE_KEY) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Valid API key required for database updates' });
    }
    
    try {
      // Get metal from body or query param, with proper type handling
      let metalParam = req.body.metal || 'aluminum';
      if (!metalParam && req.query.metal) {
        metalParam = Array.isArray(req.query.metal) ? req.query.metal[0] : req.query.metal as string;
      }
      
      const { spotPrice, change, createdAt } = req.body;
      
      // We only validate that we have either spotPrice or change, as we only need change
      if ((!spotPrice && !change) || (change === undefined)) {
        return res.status(400).json({ error: 'Bad request', message: 'change value is required' });
      }
      
      // Format date from string or use current date
      const formattedDate = createdAt ? new Date(createdAt) : new Date();
      
      // Extract the change value only
      const changeValue = Number(change || 0);
      
      console.log(`Processing update with change value: ${changeValue} (spotPrice and changePercent will be set to 0.0)`);
      
      // Check if this data already exists to prevent duplicates
      const existingRecord = await prisma.metalPrice.findFirst({
        where: {
          source: 'metal-price', // Only check records from this source
          createdAt: formattedDate
        }
      });
      
      if (existingRecord) {
        console.log('Record with same timestamp already exists, updating change value only');
        
        // Update the existing record's change value, forcing others to 0.0
        const updatedRecord = await prisma.metalPrice.update({
          where: { id: existingRecord.id },
          data: {
            change: changeValue,
            spotPrice: 0.0,           // Force to 0.0
            changePercent: 0.0,       // Force to 0.0
            createdAt: formattedDate,
            source: 'metal-price'     // Ensure source is set correctly
          }
        });
        
        console.log(`Updated record values: change=${updatedRecord.change}, source=${updatedRecord.source}`);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Updated existing record with new change value',
          record: {
            id: updatedRecord.id,
            spotPrice: 0.0,
            change: Number(updatedRecord.change),
            changePercent: 0.0,
            lastUpdated: updatedRecord.createdAt.toISOString(),
            source: updatedRecord.source || 'metal-price'
          }
        });
      }
      
      // Save new record to database with only change value
      const newRecord = await prisma.metalPrice.create({
        data: {
          spotPrice: 0.0,           // Force to 0.0
          change: changeValue,      // Store actual change value
          changePercent: 0.0,       // Force to 0.0
          createdAt: formattedDate,
          source: 'metal-price'     // Set source for this record
        }
      });
      
      console.log(`Added new record with change value: ${changeValue}, date: ${formattedDate}`);
      console.log(`New record values: change=${newRecord.change}, source=${newRecord.source}`);
      
      return res.status(201).json({
        success: true,
        message: 'Change value added to database',
        record: {
          id: newRecord.id,
          spotPrice: 0.0,
          change: Number(newRecord.change),
          changePercent: 0.0,
          lastUpdated: newRecord.createdAt.toISOString(),
          createdAt: newRecord.createdAt.toISOString(),
          source: newRecord.source || 'metal-price'
        }
      });
    } catch (error) {
      console.error('Error updating database:', error);
      return res.status(500).json({ error: 'Internal server error', message: 'Failed to update database' });
    } finally {
      await prisma.$disconnect();
      return;
    }
  }
  
  // Check if this is a cleanup request
  if (req.query.forcecleanup === 'true') {
    try {
      await removeDuplicateRecords();
      await cleanupOldRecords(100);
      return res.status(200).json({ success: true, message: 'Cleanup completed' });
    } catch (error) {
      console.error('Forced cleanup error:', error);
      return res.status(500).json({ error: 'Cleanup failed' });
    } finally {
      await prisma.$disconnect();
      return;
    }
  }
  
  // Check if this is a history request
  const { history, limit = 30, returnAverage = false } = req.query;
  
  if (history === 'true') {
    // Handle history request
    try {
      // Get historical price data for the specified metal
      const priceHistory = await prisma.metalPrice.findMany({
        where: {
          source: 'metal-price'
        },
        orderBy: [
          { createdAt: 'desc' },
          { createdAt: 'desc' }
        ],
        take: Number(limit)
      });
      
      // Return error if no history data
      if (priceHistory.length === 0) {
        return res.status(404).json({
          type: 'noData',
          error: 'No price history available in database',
          message: 'No price history data found'
        });
      }
      
      // Transform decimal values to numbers for JSON response
      const formattedHistory = priceHistory.map(record => ({
        id: record.id,
        spotPrice: Number(record.spotPrice),
        change: Number(record.change),
        changePercent: Number(record.changePercent),
        lastUpdated: record.createdAt.toISOString(),
        createdAt: record.createdAt.toISOString()
      }));
      
      res.status(200).json(formattedHistory);
    } catch (error) {
      console.error('Error retrieving price history:', error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to retrieve price history" 
      });
    } finally {
      await prisma.$disconnect();
      return;
    }
  }

  // If forceMetalPrice is true, directly return data from the MetalPrice table
  if (req.query.forceMetalPrice === 'true') {
    try {
      // Always force refresh when explicitly requested with forceMetalPrice=true
      // This ensures we get the latest data from the external API
      const bypassCache = true;
      
      console.log(`Fetching latest price, bypassCache=${bypassCache}`);
      
      try {
        const priceData = await getLatestPriceWithRefresh(bypassCache);
        
        console.log('Price data retrieved:', JSON.stringify(priceData));
        
        // Ensure we have a valid change value, even if it's zero
        if (priceData.change === undefined || priceData.change === null) {
          console.log('No change value in price data, setting to 0');
          priceData.change = 0;
        }
          
        // Update cache
        responseCache = {
          data: { ...priceData, metal: 'aluminum' },
          timestamp: Date.now(),
          ttl: responseCache.ttl
        };
          
        return res.status(200).json(priceData);
      } catch (refreshError) {
        console.error('Failed to get data with refresh, falling back to database only:', refreshError);
        
        // Fallback to most recent database record if refresh failed
        const latestRecord = await prisma.metalPrice.findFirst({
          where: { 
            source: 'metal-price'
          },
          orderBy: {
            createdAt: 'desc'
          }
        });
        
        if (latestRecord) {
          console.log('Returning fallback record from database');
          const fallbackData: ApiResponse = {
            type: 'spotPrice',
            spotPrice: Number(latestRecord.spotPrice),
            change: Number(latestRecord.change) || 0, // Ensure change value is not null
            changePercent: Number(latestRecord.changePercent) || 0,
            lastUpdated: latestRecord.createdAt.toISOString(),
            source: 'database-fallback',
            message: 'Using fallback database record due to external API failure'
          };
          
          return res.status(200).json(fallbackData);
        } else {
          // Last resort - return a default response with known values
          console.log('No database records found, returning default change data');
          return res.status(200).json({
            type: 'spotPrice',
            spotPrice: 0,
            change: -10, // Default reasonable change value
            changePercent: -0.5,
            lastUpdated: new Date().toISOString(),
            source: 'default-fallback',
            message: 'Using default values as no data available'
          });
        }
      }
    } catch (error) {
      console.error('Error handling forceMetalPrice request:', error);
      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to retrieve metal price data"
      });
    } finally {
      await prisma.$disconnect();
      return;
    }
  }
  
  // If returnAverage is true, calculate and return the daily average
  if (returnAverage === 'true') {
    try {
      const averageData = await calculateDailyAverage();
      
      if (averageData) {
        // Successfully calculated average
        return res.status(200).json({
          type: 'averagePrice',
          spotPrice: averageData.averagePrice,
          averagePrice: averageData.averagePrice, // Add averagePrice field for frontend
          change: averageData.change,
          changePercent: averageData.changePercent,
          lastUpdated: averageData.lastUpdated,
          dataPointsCount: averageData.dataPointsCount,
          lastCashSettlementPrice: averageData.lastCashSettlementPrice
        });
      } else {
        // If we couldn't calculate an average, try to at least get the last CSP
        try {
          const latestCashSettlement = await prisma.lME_West_Metal_Price.findFirst({
            orderBy: {
              createdAt: 'desc'
            }
          });
          
          if (latestCashSettlement) {
            // We have a cash settlement but no average - return a basic response
            const cashPrice = Number(latestCashSettlement.Price);
            return res.status(200).json({
              type: 'averagePrice',
              spotPrice: cashPrice,
              averagePrice: cashPrice, // Add averagePrice field for frontend
              change: 0,
              changePercent: 0,
              lastUpdated: new Date().toISOString(),
              dataPointsCount: 1,
              lastCashSettlementPrice: cashPrice,
              message: 'Using last cash settlement as fallback'
            });
          }
        } catch (cspError) {
          console.error('Error fetching cash settlement fallback:', cspError);
        }
        
        // No average data or CSP available, return error
        console.log('No average data available in database');
        return res.status(404).json({
          type: 'noData',
          error: 'No average data available in database',
          message: 'No daily price records found to calculate average'
        });
      }
    } catch (error) {
      console.error('Error fetching average price data:', error);
      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to calculate average price"
      });
    } finally {
      await prisma.$disconnect();
      return;
    }
  }
  
  // For regular spot price request, get only from database
  try {
    console.log('Fetching spot price data from database');
    
    // Use the same function but don't force refresh
    const priceData = await getLatestPriceWithRefresh(false);
    return res.status(200).json(priceData);
  } catch (error) {
    console.error('Error retrieving price data:', error);
    
    // No data in database, return error
    return res.status(404).json({
      type: 'noData',
      error: 'No data available in database',
      message: 'No price data found in database'
    });
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}
