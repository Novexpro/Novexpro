import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

// Define a type for the extended PrismaClient that includes our custom models
type ExtendedPrismaClient = PrismaClient & {
  lME_West_Metal_Price: {
    upsert: (params: {
      where: { date: string };
      update: { Price: number };
      create: { date: string; Price: number };
    }) => Promise<{ id: number; date: string; Price: number; createdAt: Date }>;
  };
};

const prisma = new PrismaClient() as ExtendedPrismaClient;

// Backend API response interfaces
interface BackendCashSettlementResponse {
  price: number;
  date: string;
  time: string;
  last_updated: string;
  freshness?: {
    is_today: boolean;
    data_date: string;
    current_date: string;
    last_updated: string;
  };
  warning?: string;
}

interface BackendErrorResponse {
  error: string;
  message: string;
  stale_data?: BackendCashSettlementResponse;
  data_age_hours?: number;
}

// Legacy interface for backward compatibility
interface CashSettlementData {
  cashSettlement: number;
  dateTime: string;
}

// Cache control headers to prevent browser caching
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// Add parseApiDate function at the top of the file
function parseApiDate(dateString: string): Date | null {
  try {
    // Try standard ISO date format first
    const date = new Date(dateString);
    
    // Check if date is valid
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Try to parse common date formats
    // Format: "YYYY-MM-DD HH:MM:SS"
    const dateTimeRegex = /(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/;
    const match = dateString.match(dateTimeRegex);
    
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      return new Date(
        parseInt(year),
        parseInt(month) - 1, // Month is 0-indexed in JS Date
        parseInt(day),
        hour ? parseInt(hour) : 0,
        minute ? parseInt(minute) : 0,
        second ? parseInt(second) : 0
      );
    }
    
    // If all parsing attempts fail
    console.error('Failed to parse date string:', dateString);
    return null;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

// Save LME West Metal Price to database
async function saveLmeWestMetalPrice(price: number, dateTimeString: string): Promise<void> {
  try {
    // Parse the date from the API response
    const dateObj = parseApiDate(dateTimeString);
    
    if (!dateObj || isNaN(dateObj.getTime())) {
      console.error('Invalid date from API:', dateTimeString);
      throw new Error('Invalid date format from API');
    }
    
    // Convert to ISO string for storage in the database
    const date = dateObj.toISOString();
    
    console.log(`[DB] Attempting to save cash settlement data: ${price} at ${dateTimeString}`);
    
    // Check if a record already exists for this date
    const existingRecord = await prisma.lME_West_Metal_Price.findFirst({
      where: {
        date: date
      }
    });
    
    // Check if we already have a record with the same price for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRecords = await prisma.lME_West_Metal_Price.findMany({
      where: {
        createdAt: {
          gte: today
        },
        Price: price
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // If we have a record with the same price today, don't create a duplicate
    if (todayRecords.length > 0) {
      console.log(`[DB] Duplicate record found for today with price ${price}, skipping database update`);
      console.log(`[DB] Existing record details: ID=${todayRecords[0].id}, Date=${todayRecords[0].date}, Price=${todayRecords[0].Price}`);
      return;
    }
    
    if (existingRecord) {
      console.log(`[DB] Updating existing record for date: ${date}, ID=${existingRecord.id}`);
      
      // Only update if the price is different
      if (existingRecord.Price !== price) {
        // Update the existing record
        await prisma.lME_West_Metal_Price.update({
          where: {
            id: existingRecord.id
          },
          data: {
            Price: price
          }
        });
        console.log(`[DB] Updated record with new price: ${price} (old price: ${existingRecord.Price})`);
      } else {
        console.log(`[DB] Record already has the same price (${price}), skipping update`);
      }
    } else {
      console.log(`[DB] Creating new record for date: ${date}`);
      
      // Create a new record
      const newRecord = await prisma.lME_West_Metal_Price.create({
        data: {
          Price: price,
          date: date
        }
      });
      console.log(`[DB] Created new record with ID=${newRecord.id}, price=${price}`);
    }
    
    console.log(`[DB] Successfully processed cash settlement data: ${price} at ${dateTimeString}`);
    
  } catch (error) {
    console.error('[DB] Error saving cash settlement data:', error);
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = Math.random().toString(36).substring(2, 10);
  console.log(`[API:${requestId}] Cash settlement API request received: ${req.method} ${req.url}`);
  
  // Set cache control headers to prevent browser caching
  res.setHeader('Cache-Control', noCacheHeaders['Cache-Control']);
  res.setHeader('Pragma', noCacheHeaders['Pragma']);
  res.setHeader('Expires', noCacheHeaders['Expires']);
  
  // Get the latest cash settlement data
  try {
    // Check if we should bypass the database cache
    const bypassCache = req.query.bypassCache === 'true';
    console.log(`[API:${requestId}] Request params: bypassCache=${bypassCache}`);

    // Always try to get from database first unless explicitly bypassing cache
    if (!bypassCache) {
      // Check if we're getting the latest settlement from the database first
      console.log(`[API:${requestId}] Checking database for cached data`);
      const latestSettlement = await prisma.lME_West_Metal_Price.findFirst({
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      
      // If we have the data in our database, return it directly
      if (latestSettlement) {
        console.log(`[API:${requestId}] Found cached data in database: ID=${latestSettlement.id}, Price=${latestSettlement.Price}, Date=${latestSettlement.date}`);
        
        // Check if the data is from today
        const settlementDate = new Date(latestSettlement.date);
        const today = new Date();
        const isToday = 
          settlementDate.getDate() === today.getDate() &&
          settlementDate.getMonth() === today.getMonth() &&
          settlementDate.getFullYear() === today.getFullYear();
        
        console.log(`[API:${requestId}] Cached data is from today: ${isToday}`);
        
        // If data is from today and we're not bypassing cache, return it
        if (isToday || !bypassCache) {
          console.log(`[API:${requestId}] Returning cached data from database`);
          return res.status(200).json({
            type: 'cashSettlement',
            cashSettlement: latestSettlement.Price,
            dateTime: latestSettlement.date,
            cached: true
          });
        }
        
        // If data is not from today and we're not explicitly bypassing cache,
        // we'll still try to get fresh data but fall back to this if needed
        console.log(`[API:${requestId}] Cached data is not from today, attempting to fetch fresh data`);
      } else {
        console.log(`[API:${requestId}] No cached data found in database`);
      }
    } else {
      console.log(`[API:${requestId}] Bypassing cache as requested`);
    }
    
    // If bypassing cache or no data in database, check the backend server
    const backendUrl = process.env.BACKEND_URL || 'http://148.135.138.22:3232';
    const apiUrl = `${backendUrl}/api/cash-settlement`;
    console.log(`[API:${requestId}] Fetching data from external API: ${apiUrl}`);
    
    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(apiUrl, {
        // Add cache-busting parameter to prevent server-side caching
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        signal: controller.signal
      });
      
      // Clear the timeout as request completed
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`[API:${requestId}] External API returned status: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch price data from backend: ${response.status} ${response.statusText}`);
      }
      
      const rawData = await response.json();
      console.log(`[API:${requestId}] Raw cash settlement data received:`, JSON.stringify(rawData).substring(0, 200) + (JSON.stringify(rawData).length > 200 ? '...' : ''));
      
      // Handle error responses from the updated backend
      if ('error' in rawData) {
        const errorData = rawData as BackendErrorResponse;
        console.log(`[API:${requestId}] Backend returned error: ${errorData.error} - ${errorData.message}`);
        
        // If backend has stale data, use it as fallback
        if (errorData.stale_data && errorData.stale_data.price) {
          console.log(`[API:${requestId}] Using stale data from backend: price=${errorData.stale_data.price}`);
          const dateTime = errorData.stale_data.last_updated || `${errorData.stale_data.date} ${errorData.stale_data.time}`;
          
          // Save to database
          await saveLmeWestMetalPrice(errorData.stale_data.price, dateTime);
          
          return res.status(200).json({
            type: 'cashSettlement',
            cashSettlement: errorData.stale_data.price,
            dateTime: dateTime,
            cached: false,
            warning: `Backend data is stale (${errorData.data_age_hours?.toFixed(1)} hours old)`,
            stale: true
          });
        }
        
        // If no stale data, throw error to fall back to database
        throw new Error(`Backend API error: ${errorData.error} - ${errorData.message}`);
      }
      
      // Handle successful response from updated backend
      if ('price' in rawData && 'date' in rawData) {
        const backendData = rawData as BackendCashSettlementResponse;
        const dateTime = backendData.last_updated || `${backendData.date} ${backendData.time}`;
        
        console.log(`[API:${requestId}] Processing data from updated backend: price=${backendData.price}, dateTime=${dateTime}`);
        
        // Save to database
        await saveLmeWestMetalPrice(backendData.price, dateTime);
        
        // Prepare response with additional metadata
        const response = {
          type: 'cashSettlement',
          cashSettlement: backendData.price,
          dateTime: dateTime,
          cached: false
        };
        
        // Add warning if data is not from today
        if (backendData.warning) {
          (response as any).warning = backendData.warning;
        }
        
        // Add freshness information if available
        if (backendData.freshness) {
          (response as any).freshness = backendData.freshness;
        }
        
        console.log(`[API:${requestId}] Returning fresh data to client`);
        return res.status(200).json(response);
      }
      // Legacy format support for backward compatibility
      else if ('cashSettlement' in rawData && 'dateTime' in rawData) {
        const cashData = rawData as CashSettlementData;
        console.log(`[API:${requestId}] Processing data in legacy format: price=${cashData.cashSettlement}, dateTime=${cashData.dateTime}`);
        
        // Save to database
        await saveLmeWestMetalPrice(cashData.cashSettlement, cashData.dateTime);
        
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: cashData.cashSettlement,
          dateTime: cashData.dateTime,
          cached: false
        });
      } else {
        // No valid cash settlement data available
        console.log(`[API:${requestId}] No valid cash settlement data found in API response`);
        throw new Error('No valid cash settlement data in response');
      }
    } catch (fetchError) {
      console.error(`[API:${requestId}] Error fetching from external API:`, fetchError);
      
      // Check if it's a network/timeout error vs API error
      const isNetworkError = fetchError instanceof Error && 
        (fetchError.name === 'AbortError' || 
         fetchError.message.includes('fetch') || 
         fetchError.message.includes('timeout'));
      
      if (isNetworkError) {
        console.log(`[API:${requestId}] Network error detected, falling back to database`);
      } else {
        console.log(`[API:${requestId}] API error detected, falling back to database`);
      }
      
      // If external API fails, try to get the latest data from the database as fallback
      console.log(`[API:${requestId}] Attempting to use cached data as fallback`);
      const latestSettlement = await prisma.lME_West_Metal_Price.findFirst({
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      
      if (latestSettlement) {
        console.log(`[API:${requestId}] External API failed, returning cached data from database: ID=${latestSettlement.id}, Price=${latestSettlement.Price}`);
        
        // Calculate how old the cached data is
        const dataAge = Date.now() - new Date(latestSettlement.createdAt).getTime();
        const ageHours = dataAge / (1000 * 60 * 60);
        
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: latestSettlement.Price,
          dateTime: latestSettlement.date,
          message: `Using cached data due to backend error (${ageHours.toFixed(1)} hours old)`,
          cached: true,
          fallback: true,
          dataAge: ageHours
        });
      }
      
      throw fetchError; // Re-throw if no cached data available
    }
  } catch (error) {
    console.error(`[API:${requestId}] Error fetching or storing cash settlement data:`, error);
    
    // If error occurs, try to get the latest data from the database
    try {
      console.log(`[API:${requestId}] Attempting to use cached data after error`);
      const latestSettlement = await prisma.lME_West_Metal_Price.findFirst({
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      
      if (latestSettlement) {
        console.log(`[API:${requestId}] Returning cached data after error: ID=${latestSettlement.id}, Price=${latestSettlement.Price}`);
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: latestSettlement.Price,
          dateTime: latestSettlement.date,
          message: 'Using cached data due to backend error',
          cached: true
        });
      }
    } catch (dbError) {
      console.error(`[API:${requestId}] Error retrieving data from database:`, dbError);
    }
    
    // If no database data is available, return an error status
    console.log(`[API:${requestId}] No data available, returning error response`);
    res.status(503).json({ 
      error: "Service temporarily unavailable", 
      message: "No cash settlement data available at this time" 
    });
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
    console.log(`[API:${requestId}] Request completed`);
  }
} 