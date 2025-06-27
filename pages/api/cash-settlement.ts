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

// New interface for cash settlement format
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
    
    console.log(`Saving cash settlement data: ${price} at ${dateTimeString}`);
    
    // Check if a record already exists for this date
    const existingRecord = await prisma.lME_West_Metal_Price.findFirst({
      where: {
        date: date
      }
    });
    
    if (existingRecord) {
      console.log(`Updating existing record for date: ${date}`);
      
      // Update the existing record
      await prisma.lME_West_Metal_Price.update({
        where: {
          id: existingRecord.id
        },
        data: {
          Price: price
        }
      });
    } else {
      console.log(`Creating new record for date: ${date}`);
      
      // Create a new record
      await prisma.lME_West_Metal_Price.create({
        data: {
          Price: price,
          date: date
        }
      });
    }
    
    console.log(`Saved cash settlement data: ${price} at ${dateTimeString}`);
    
    // We'll skip the LME cash settlement calculation since it's not working properly
    // and we're focusing on showing cached data
  } catch (error) {
    console.error('Error saving cash settlement data:', error);
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set cache control headers to prevent browser caching
  res.setHeader('Cache-Control', noCacheHeaders['Cache-Control']);
  res.setHeader('Pragma', noCacheHeaders['Pragma']);
  res.setHeader('Expires', noCacheHeaders['Expires']);
  
  // Get the latest cash settlement data
  try {
    // Check if we should bypass the database cache
    const bypassCache = req.query.bypassCache === 'true';

    // Always try to get from database first unless explicitly bypassing cache
    if (!bypassCache) {
      // Check if we're getting the latest settlement from the database first
      const latestSettlement = await prisma.lME_West_Metal_Price.findFirst({
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      
      // If we have the data in our database, return it directly
      if (latestSettlement) {
        console.log('Returning cached data from database');
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: latestSettlement.Price,
          dateTime: latestSettlement.date
        });
      }
    }
    
    // If bypassing cache or no data in database, check the backend server
    const backendUrl = process.env.BACKEND_URL || 'http://148.135.138.22:3232';
    const apiUrl = `${backendUrl}/api/cash-settlement`;
    console.log(`Fetching data from: ${apiUrl}`);
    
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
        console.error(`API returned status: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch price data from backend: ${response.status} ${response.statusText}`);
      }
      
      const rawData = await response.json();
      console.log('Raw cash settlement data:', rawData);
      
      // Check for the new format from the API (as seen in the search results)
      if ('date' in rawData && 'price' in rawData) {
        // New format: {"date":"2025-06-27","last_updated":"2025-06-27 12:31:29","price":2583.0,"time":"12:31:29"}
        const dateTime = rawData.last_updated || `${rawData.date} ${rawData.time}`;
        
        // Save to database
        await saveLmeWestMetalPrice(rawData.price, dateTime);
        
        // Return data in the format expected by the frontend
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: rawData.price,
          dateTime: dateTime
        });
      } 
      // Check for cash settlement data in original format
      else if ('is_cash_settlement' in rawData && rawData.is_cash_settlement === true && rawData.cash_settlement !== null) {
        // Save to database
        await saveLmeWestMetalPrice(rawData.cash_settlement, rawData.last_updated);
        
        // Return data
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: rawData.cash_settlement,
          dateTime: rawData.last_updated
        });
      } else if ('cashSettlement' in rawData && 'dateTime' in rawData) {
        // Handle original cash settlement format
        const cashData = rawData as CashSettlementData;
        
        // Save to database
        await saveLmeWestMetalPrice(cashData.cashSettlement, cashData.dateTime);
        
        // Return data
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: cashData.cashSettlement,
          dateTime: cashData.dateTime
        });
      } else {
        // No cash settlement data available
        return res.status(404).json({
          type: 'noData',
          message: 'No cash settlement data available'
        });
      }
    } catch (fetchError) {
      console.error('Error fetching from external API:', fetchError);
      
      // If external API fails, try to get the latest data from the database as fallback
      const latestSettlement = await prisma.lME_West_Metal_Price.findFirst({
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      
      if (latestSettlement) {
        console.log('External API failed, returning cached data from database');
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: latestSettlement.Price,
          dateTime: latestSettlement.date,
          message: 'Using cached data due to backend error'
        });
      }
      
      throw fetchError; // Re-throw if no cached data available
    }
  } catch (error) {
    console.error('Error fetching or storing cash settlement data:', error);
    
    // If error occurs, try to get the latest data from the database
    try {
      const latestSettlement = await prisma.lME_West_Metal_Price.findFirst({
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      
      if (latestSettlement) {
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: latestSettlement.Price,
          dateTime: latestSettlement.date,
          message: 'Using cached data due to backend error'
        });
      }
    } catch (dbError) {
      console.error('Error retrieving data from database:', dbError);
    }
    
    // If no database data is available, return an error status
    res.status(503).json({ 
      error: "Service temporarily unavailable", 
      message: "No cash settlement data available at this time" 
    });
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
} 