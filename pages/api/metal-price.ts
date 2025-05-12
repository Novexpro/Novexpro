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
  updatedAt: Date;
}

// In-memory storage for cash settlement data
let cachedCashSettlement: CashSettlementData | null = null;

// Interface for external API response data
interface ExternalApiData {
  spot_price?: number | null;
  price_change?: number;
  change_percentage?: number;
  last_updated?: string;
  cash_settlement?: number | null;
  is_cash_settlement?: boolean;
}

// Service function to fetch data from external API
async function fetchExternalPriceData(): Promise<ExternalApiData> {
  try {
    // Use the correct external API URL
    const backendUrl = process.env.BACKEND_URL || 'http://148.135.138.22:3232';
    const apiEndpoint = `${backendUrl}/api/price-data`;
    
    console.log(`Attempting to fetch data from external API: ${apiEndpoint}`);
    
    // Add timeout to avoid hanging requests - increased to 8 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    try {
      const response = await fetch(apiEndpoint, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
    
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`External API returned status ${response.status}: ${errorText}`);
        throw new Error(`External API returned status ${response.status}: ${errorText}`);
      }
    
      const data: ExternalApiData = await response.json();
      console.log('Successfully fetched external API data:', JSON.stringify(data));
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error in inner fetch:", error);
      throw error;
    }
  } catch (error) {
    console.error('Error fetching from external API:', error);
    // Return empty data object to allow fallback to database
    return {
      spot_price: 0,
      price_change: 0,
      change_percentage: 0,
      last_updated: new Date().toISOString(),
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
  
  // Validate spot price
  let spotPrice = externalData.spot_price !== null && externalData.spot_price !== undefined
    ? Number(externalData.spot_price)
    : (externalData.cash_settlement !== null && externalData.cash_settlement !== undefined
      ? Number(externalData.cash_settlement)
      : 0);
      
  if (spotPrice === 0) {
    console.error('No valid price data found in API response');
  }
  
  // Extract change data with fallbacks
  const change = externalData.price_change !== undefined ? Number(externalData.price_change) : 0;
  
  // Apply formula: spotPrice = spotPrice + change
  spotPrice = spotPrice + change;
  console.log(`Applied formula spotPrice + change: ${spotPrice - change} + ${change} = ${spotPrice}`);
  
  // Detect if this is cash settlement data
  const isCashSettlement = Boolean(
    externalData.is_cash_settlement || 
    (externalData.cash_settlement !== null && externalData.cash_settlement !== undefined)
  );
  
  const changePercent = externalData.change_percentage !== undefined ? Number(externalData.change_percentage) : 0;
  
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

// Type definition for database record with support for Prisma Decimal type
interface DbRecord {
  id: string;
  metal: string;
  spotPrice: unknown; // Using unknown instead of any for Prisma Decimal
  change: unknown;    // Using unknown instead of any for Prisma Decimal
  changePercent: unknown; // Using unknown instead of any for Prisma Decimal
  lastUpdated: Date;
  createdAt: Date;
}

// Function to save price data to database with improved error handling and duplicate prevention
async function savePriceToDatabase(
  metal: string,
  spotPrice: number,
  change: number,
  changePercent: number,
  lastUpdated: Date
): Promise<DbRecord> {
  try {
    // Calculate a time range (5 minutes before and after) to check for similar records
    const fiveMinutesMs = 5 * 60 * 1000;
    const timeRangeStart = new Date(lastUpdated.getTime() - fiveMinutesMs);
    const timeRangeEnd = new Date(lastUpdated.getTime() + fiveMinutesMs);
    
    // More comprehensive duplicate check - look for any records in a time range with same change value
    const existingRecords = await prisma.metalPrice.findMany({
      where: {
        metal,
        lastUpdated: {
          gte: timeRangeStart,
          lte: timeRangeEnd
        },
        change: {
          equals: change
        }
      },
      orderBy: {
        lastUpdated: 'desc'
      },
      take: 1
    });
    
    if (existingRecords.length > 0) {
      console.log(`Found duplicate record within 5-minute window with same change value (${change}), skipping save`);
      return existingRecords[0];
    }
    
    // Get the most recent record to compare values
    const mostRecentRecord = await prisma.metalPrice.findFirst({
      where: { metal },
      orderBy: {
        lastUpdated: 'desc'
      }
    });
    
    // If we have a recent record with the exact same change value, don't save a duplicate
    if (mostRecentRecord && Number(mostRecentRecord.change) === change) {
      console.log(`Most recent change value is identical (${change}), no need to save duplicate record`);
      
      // If the record is older than 6 hours, update the timestamp instead of creating new record
      const sixHoursMs = 6 * 60 * 60 * 1000;
      const now = new Date();
      if (now.getTime() - mostRecentRecord.lastUpdated.getTime() > sixHoursMs) {
        // Update the timestamp only if change hasn't changed but it's been a while
        const updatedRecord = await prisma.metalPrice.update({
          where: { id: mostRecentRecord.id },
          data: { lastUpdated: now }
        });
        console.log(`Updated timestamp of existing record with same change (${change})`);
        return updatedRecord;
      }
      
      return mostRecentRecord; // Return existing record
    }
    
    // Rate limiting - check if we've added a record in the last minute
    if (mostRecentRecord) {
      const oneMinuteMs = 60 * 1000;
      const now = new Date();
      const timeDiff = now.getTime() - mostRecentRecord.lastUpdated.getTime();
      
      if (timeDiff < oneMinuteMs) {
        console.log(`Rate limiting: Not saving new record. Last record was ${Math.round(timeDiff / 1000)} seconds ago.`);
        return mostRecentRecord;
      }
    }
    
    // Store only the change value in the database
    // Set spotPrice and changePercent to 0.0 as requested
    console.log(`Saving record to database with change value ${change}, spotPrice and changePercent set to 0.0`);
    const record = await prisma.metalPrice.create({
      data: {
        metal,
        spotPrice: 0.0,             // Set to 0.0 as requested
        change: change,             // Keep actual change value
        changePercent: 0.0,         // Set to 0.0 as requested
        lastUpdated
      }
    });
    
    return record;
  } catch (error) {
    console.error('Error saving price to database:', error);
    throw error;
  }
}

// Function to get latest price with auto-refresh when stale
async function getLatestPriceWithRefresh(metal: string, forceRefresh: boolean = false): Promise<ApiResponse> {
  console.log(`getLatestPriceWithRefresh called for ${metal}, forceRefresh=${forceRefresh}`);
  
  try {
    // If force refresh is requested, always try to fetch new data first
    if (forceRefresh) {
      console.log('Force refresh requested, fetching from external API first');
      try {
        // Get fresh data from external API
        const externalData = await fetchExternalPriceData();
        
        console.log('External data received:', JSON.stringify(externalData));
        
        // Check if we got valid data (not the empty fallback)
        if (!externalData || 
            (externalData.spot_price === 0 && externalData.price_change === 0 && 
             externalData.cash_settlement === undefined)) {
          console.log('External API returned fallback/empty data, falling back to database');
          throw new Error('External API unavailable');
        }
        
        // Process the data
        const { spotPrice, change, changePercent, lastUpdated } = processExternalData(externalData);
        
        console.log(`Processed data: spotPrice=${spotPrice}, change=${change}, changePercent=${changePercent}`);
        
        // Only save to database if we have valid data (non-zero spotPrice)
        if (spotPrice > 0) {
        // Always save to database when forcing refresh, regardless of settings
        const formattedDate = new Date(lastUpdated || new Date());
        
        try {
          console.log(`Explicitly saving to database: metal=${metal}, price=${spotPrice}, date=${formattedDate}`);
          await savePriceToDatabase(metal, spotPrice, change, changePercent, formattedDate);
          console.log('Successfully saved new price data to database');
        } catch (saveErr) {
          console.error('Error saving to database:', saveErr);
          // Continue even if save fails
        }
        
        // Return the fresh data immediately
        return {
          type: 'spotPrice',
          spotPrice: Number(spotPrice),
          change: Number(change),
          changePercent: Number(changePercent),
          lastUpdated: formattedDate.toISOString(),
          fresh: true,
          source: 'external'
        };
        } else {
          console.log('External API returned invalid data (zero price), falling back to database');
          throw new Error('External API returned invalid data');
        }
      } catch (apiError) {
        console.error('External API error during force refresh:', apiError);
        // Continue to database query below
      }
    }
    
    // Get from database
    const latestPrice = await prisma.metalPrice.findFirst({
      where: { metal },
      orderBy: [
        { lastUpdated: 'desc' },
        { createdAt: 'desc' }
      ]
    });
    
    console.log(`Database check result: ${latestPrice ? 'Found data' : 'No data'}`);
    
    // If no data in database, handle gracefully
      if (!latestPrice) {
      console.log('No data in database, returning graceful no-data response');
          return {
        type: 'noData',
        error: 'No price data available',
        message: 'No price data could be retrieved from database or external API',
        source: 'database'
      };
    }
    
    // Return database data
      console.log(`Returning database data: spotPrice=${latestPrice.spotPrice}, date=${latestPrice.lastUpdated}`);
      return {
        type: 'spotPrice',
        spotPrice: Number(latestPrice.spotPrice),
        change: Number(latestPrice.change),
        changePercent: Number(latestPrice.changePercent),
        lastUpdated: latestPrice.lastUpdated.toISOString(),
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
async function cleanupOldRecords(metal: string, keepCount = 1000) {
  try {
    // Get total count for this metal
    const totalCount = await prisma.metalPrice.count({
      where: { metal }
    });
    
    // Only perform cleanup if we have more records than we want to keep
    if (totalCount <= keepCount) {
      return;
    }
    
    console.log(`Cleaning up ${metal} price records (keeping ${keepCount} of ${totalCount})`);
    
    // Get IDs of records to keep
    const recordsToKeep = await prisma.metalPrice.findMany({
      where: { metal },
      orderBy: [
        { lastUpdated: 'desc' },
        { createdAt: 'desc' }
      ],
      take: keepCount,
      select: { id: true }
    });
    
    const keepIds = recordsToKeep.map(record => record.id);
    
    // Delete records not in the keep list
    const deleteResult = await prisma.metalPrice.deleteMany({
      where: {
        metal,
        id: { notIn: keepIds }
      }
    });
    
    console.log(`Deleted ${deleteResult.count} old ${metal} price records`);
  } catch (error) {
    console.error('Error during cleanup process:', error);
  }
}

// Function to deduplicate records - more aggressive approach
async function removeDuplicateRecords(metal: string) {
  try {
    // Get all timestamps for this metal
    const records = await prisma.metalPrice.findMany({
      where: { metal },
      select: {
        id: true,
        lastUpdated: true,
        spotPrice: true,
        change: true,
        changePercent: true,
        createdAt: true
      },
      orderBy: [
        { lastUpdated: 'asc' },
        { createdAt: 'asc' }
      ]
    });
    
    // Track timestamps and values we've seen
    const seen = new Map();
    const duplicateIds = [];
    
    for (const record of records) {
      // Create a composite key of timestamp and price
      const timestamp = record.lastUpdated.toISOString();
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
      
      console.log(`Deleted ${deleteResult.count} duplicate ${metal} price records`);
    }
  } catch (error) {
    console.error('Error removing duplicate records:', error);
  }
}

// Function to calculate daily average price for today
async function calculateDailyAverage(metal: string): Promise<AveragePriceData | null> {
  try {
    // Get today's date at start of day in UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find all records for today
    const todayRecords = await prisma.metalPrice.findMany({
      where: {
        metal,
        lastUpdated: {
          gte: today
        }
      },
      orderBy: {
        lastUpdated: 'asc'
      }
    });

    // Get the most recent cash settlement from LME_West_Metal_Price
    const latestCashSettlement = await prisma.lME_West_Metal_Price.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });

    // If we have a cash settlement price, include it in the result
    const lastCashSettlementPrice = latestCashSettlement ? Number(latestCashSettlement.Price) : null;

    // If no records found for today but we have a cash settlement, return fallback data
    if (todayRecords.length === 0) {
      if (lastCashSettlementPrice) {
        console.log('No records found for average calculation, using CSP as fallback');
        return {
          averagePrice: lastCashSettlementPrice,
          change: 0,
          changePercent: 0,
          lastUpdated: new Date().toISOString(),
          dataPointsCount: 0,
          lastCashSettlementPrice
        };
      }
      console.log('No records found for average calculation and no CSP available, returning null');
      return null;
    }

    // Calculate average price from database records
    const totalPrice = todayRecords.reduce((sum, record) => sum + Number(record.spotPrice), 0);
    const averagePrice = totalPrice / todayRecords.length;

    // Get the first and most recent price to calculate change
    const firstPrice = Number(todayRecords[0].spotPrice);
    const latestRecord = todayRecords[todayRecords.length - 1];
    const latestPrice = Number(latestRecord.spotPrice);
    
    // Calculate change and change percent from first price of the day
    const change = latestPrice - firstPrice;
    const changePercent = (change / firstPrice) * 100;

    // If we have a cash settlement price, calculate change and changePercent based on it
    if (lastCashSettlementPrice) {
      // Calculate change as average price minus last cash settlement price
      const cspChange = averagePrice - lastCashSettlementPrice;
      // Calculate percent change
      const cspChangePercent = (cspChange / lastCashSettlementPrice) * 100;
      
      return {
        averagePrice,
        change: cspChange, // Use the change from last CSP
        changePercent: cspChangePercent, // Use the percent change from last CSP
        lastUpdated: latestRecord.lastUpdated.toISOString(),
        dataPointsCount: todayRecords.length,
        lastCashSettlementPrice
      };
    }

    return {
      averagePrice,
      change,
      changePercent,
      lastUpdated: latestRecord.lastUpdated.toISOString(),
      dataPointsCount: todayRecords.length,
      lastCashSettlementPrice
    };
  } catch (error) {
    console.error('Error calculating daily average:', error);
    return null;
  }
}

// New function to save cash settlement data to database
async function saveCashSettlementToDatabase(
  price: number, 
  dateTime: string
): Promise<{ id: number; date: string; Price: number; createdAt: Date }> {
  try {
    // Use the full ISO date string with time component
    let formattedDateTime: string;
    try {
      // Parse the date string into a Date object
      const date = new Date(dateTime);
      if (isNaN(date.getTime())) {
        console.warn('Invalid date provided:', dateTime);
        // Fallback to current date and time if the provided date is invalid
        formattedDateTime = new Date().toISOString();
      } else {
        formattedDateTime = date.toISOString();
      }
    } catch (error) {
      console.error('Error parsing date:', error);
      // Fallback to current date and time in case of any error
      formattedDateTime = new Date().toISOString();
    }
    
    console.log(`Saving price ${price} for date ${formattedDateTime}`);
    
    // Extract just the date part for the lookup (YYYY-MM-DD)
    const datePart = formattedDateTime.split('T')[0];
    
    // Check if a record for this date already exists
    const existingRecord = await prisma.lME_West_Metal_Price.findUnique({
      where: { date: datePart }
    });
    
    if (existingRecord) {
      // Update existing record
      return await prisma.lME_West_Metal_Price.update({
        where: { date: datePart },
        data: { 
          Price: price,
          date: formattedDateTime // Store the full ISO date with time
        }
      });
    } else {
      // Create a new record
      return await prisma.lME_West_Metal_Price.create({
        data: {
          date: formattedDateTime, // Store the full ISO date with time
          Price: price
        }
      });
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
      const existingRecord = await prisma.lME_West_Metal_Price.findUnique({
        where: { date }
      });
      
      if (existingRecord) {
        // If it exists, update it
        const updatedRecord = await prisma.lME_West_Metal_Price.update({
          where: { date },
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
        updatedAt: new Date()
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
          
          // Check if we have cash settlement data from external API
          if (externalData.cash_settlement !== null && externalData.cash_settlement !== undefined) {
            // We have data from external API, save it to database with current timestamp
            const price = Number(externalData.cash_settlement);
            const dateTime = new Date().toISOString(); // Use current time for freshness
            
            // Save to database
            const savedRecord = await saveCashSettlementToDatabase(price, dateTime);
            console.log('Saved new cash settlement data to database:', savedRecord);
            
            // Return the data we just saved
            return res.status(200).json({
              type: 'cashSettlement',
              cashSettlement: price,
              dateTime: savedRecord.date, // Use the stored date from the saved record
              source: 'LME',
              success: true,
              fromExternalApi: true,
              fresh: true
            });
          }
        } catch (apiError) {
          console.error('Failed to fetch from external API:', apiError);
          // Continue to database fallback
        }
      }

      // First try to get data from the database for today
      // We need to find records where the date part matches today
      const todaySettlements = await prisma.lME_West_Metal_Price.findMany({
        where: { 
          date: {
            startsWith: formattedDate
          }
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
          dateTime: todaySettlement.date, // Using the full ISO date
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
        if (externalData.cash_settlement !== null && externalData.cash_settlement !== undefined) {
          // We have data from external API, save it to database
          const price = Number(externalData.cash_settlement);
          const dateTime = new Date().toISOString(); // Use current time for freshness
          
          // Save to database
          const savedRecord = await saveCashSettlementToDatabase(price, dateTime);
          console.log('Saved new cash settlement data to database:', savedRecord);
          
          // Return the data we just saved
          return res.status(200).json({
            type: 'cashSettlement',
            cashSettlement: price,
            dateTime: savedRecord.date, // Use the stored date from the saved record
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
    // This is a simplified check - implement proper authentication in production
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
      
      const { spotPrice, change, lastUpdated } = req.body;
      
      // We only validate that we have either spotPrice or change, as we only need change
      if ((!spotPrice && !change) || (change === undefined)) {
        return res.status(400).json({ error: 'Bad request', message: 'change value is required' });
      }
      
      // Format date from string or use current date
      const formattedDate = lastUpdated ? new Date(lastUpdated) : new Date();
      
      // Extract the change value only
      const changeValue = Number(change || 0);
      
      console.log(`Processing update with change value: ${changeValue} (storing only change, setting spotPrice and changePercent to 0.0)`);
      
      // Check if this data already exists to prevent duplicates
      const existingRecord = await prisma.metalPrice.findFirst({
        where: {
          metal: metalParam,
          lastUpdated: formattedDate
        }
      });
      
      if (existingRecord) {
        console.log('Record with same timestamp already exists, updating change value only');
        
        // Update the existing record's change value
        const updatedRecord = await prisma.metalPrice.update({
          where: { id: existingRecord.id },
          data: {
            change: changeValue,
            // Keep spotPrice and changePercent as 0.0
            spotPrice: 0.0,
            changePercent: 0.0,
            lastUpdated: formattedDate
          }
        });
        
        return res.status(200).json({ 
          success: true, 
          message: 'Updated existing record with new change value',
          record: {
            id: updatedRecord.id,
            metal: updatedRecord.metal,
            // Response includes all values
            spotPrice: Number(updatedRecord.spotPrice),
            change: Number(updatedRecord.change),
            changePercent: Number(updatedRecord.changePercent),
            lastUpdated: updatedRecord.lastUpdated.toISOString()
          }
        });
      }
      
      // Save new record to database with only change value
      const newRecord = await prisma.metalPrice.create({
        data: {
          metal: metalParam,
          // Set spotPrice and changePercent to 0.0
          spotPrice: 0.0,
          change: changeValue,
          changePercent: 0.0,
          lastUpdated: formattedDate
        }
      });
      
      console.log(`Added new price record with change value: ${changeValue}, date: ${formattedDate}`);
      
      return res.status(201).json({
        success: true,
        message: 'Change value added to database',
        record: {
          id: newRecord.id,
          metal: newRecord.metal,
          spotPrice: Number(newRecord.spotPrice),
          change: Number(newRecord.change),
          changePercent: Number(newRecord.changePercent),
          lastUpdated: newRecord.lastUpdated.toISOString(),
          createdAt: newRecord.createdAt.toISOString()
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
      // Convert metal parameter to string, handling arrays
      const metalParam = req.query.metal ? 
        (Array.isArray(req.query.metal) ? req.query.metal[0] : req.query.metal as string) : 
        'aluminum';
      
      await removeDuplicateRecords(metalParam);
      await cleanupOldRecords(metalParam, 100);
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
  const { history, metal = 'aluminum', limit = 30, returnAverage = false } = req.query;
  
  if (history === 'true') {
    // Handle history request
    try {
      // Convert metal parameter to string, handling arrays
      const metalParam = Array.isArray(metal) ? metal[0] : metal as string;
      
      // Get historical price data for the specified metal
      const priceHistory = await prisma.metalPrice.findMany({
        where: {
          metal: metalParam
        },
        orderBy: [
          { lastUpdated: 'desc' },
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
        metal: record.metal,
        spotPrice: Number(record.spotPrice),
        change: Number(record.change),
        changePercent: Number(record.changePercent),
        lastUpdated: record.lastUpdated.toISOString(),
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
      // Convert metal parameter to string, handling arrays
      const metalParam = Array.isArray(req.query.metal) ? req.query.metal[0] : (req.query.metal as string || 'aluminum');
      
      console.log(`Handling forceMetalPrice=true request for ${metalParam}`);
      
      // Always force refresh when explicitly requested with forceMetalPrice=true
      // This ensures we get the latest data from the external API
      const bypassCache = true;
      
      console.log(`Fetching latest price for ${metalParam}, bypassCache=${bypassCache}`);
        const priceData = await getLatestPriceWithRefresh(metalParam, bypassCache);
      
      console.log('Price data retrieved:', JSON.stringify(priceData));
        
        // Update cache
        responseCache = {
          data: { ...priceData, metal: metalParam },
        timestamp: Date.now(),
          ttl: responseCache.ttl
        };
        
        return res.status(200).json(priceData);
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
      // Convert metal parameter to string, handling arrays
      const metalParam = Array.isArray(metal) ? metal[0] : metal as string;
      
      const averageData = await calculateDailyAverage(metalParam);
      
      if (averageData) {
        // Successfully calculated average
        return res.status(200).json({
          type: 'averagePrice',
          spotPrice: averageData.averagePrice,
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
              averagePrice: cashPrice, // Use CSP as fallback average
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
    
    // Convert metal parameter to string, handling arrays
    const metalParam = Array.isArray(metal) ? metal[0] : metal as string;
    
    try {
      // Use the same function but don't force refresh
      const priceData = await getLatestPriceWithRefresh(metalParam, false);
      return res.status(200).json(priceData);
    } catch (error) {
      console.error('Error retrieving price data:', error);
      
      // No data in database, return error
      return res.status(404).json({
        type: 'noData',
        error: 'No data available in database',
        message: 'No price data found in database'
      });
    }
  } catch (error) {
    console.error('Error fetching price data from database:', error);
    
    // Return an error status
    res.status(500).json({ 
      error: "Internal server error", 
      message: "Failed to retrieve price data from database" 
    });
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}
