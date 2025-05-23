import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Response interface for properly typed API responses
interface ApiResponse {
  type: 'spotPrice' | 'noData';
  spotPrice?: number;
  change?: number;
  changePercent?: number;
  lastUpdated?: string;
  fresh?: boolean;
  source?: string;
  error?: string;
  message?: string;
}

// Average price functionality has been moved to the dedicated average-price.ts API

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

// This section previously contained cash settlement data interfaces and cache
// Removed as part of separating cash settlement logic to its own API

// Interface for external API response data
interface ExternalApiData {
  spot_price?: number | null;
  price_change?: number;
  change_percentage?: number;
  last_updated?: string;
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
    
      // Try to parse the response as JSON
      let data: ExternalApiData;
      try {
        const responseText = await response.text();
        console.log('Raw response from external API:', responseText.substring(0, 500)); // Log first 500 chars
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        throw new Error(`Failed to parse API response as JSON: ${parseError}`);
      }
      
      console.log('Successfully fetched external API data:', JSON.stringify(data));
      
      // Check if we have valid data
      if (data && data.spot_price !== null && data.spot_price !== undefined) {
        console.log('Using valid spot price data from API:', data.spot_price);
        return data;
      }
      
      // If no valid data, return the data as is without using mock data
      if (!data || (data.spot_price === null && data.price_change === null)) {
        console.log('NOTICE: External API returned invalid/empty data');
        return data || {};
      }
      
      return data;
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
    
    // Return empty object when API fails instead of mock data
    console.log('NOTICE: API failure, returning empty data');
    return {};
  }
}

// Interface for processed API data
interface ProcessedApiData {
  spotPrice: number | null;
  change: number | null;
  changePercent: number | null;
  lastUpdated: string | null;
}

// Service function to process external API data into our format
function processExternalData(externalData: ExternalApiData): ProcessedApiData {
  console.log('Processing external data:', JSON.stringify(externalData));
  
  // Safety check - if we got null/undefined, use an empty object without default values
  if (!externalData) {
    console.error('Received null/undefined external data');
    externalData = {};
  }
  
  // We no longer need to check for cash settlement data as it's handled by a separate API
  
  // Use spot price directly from API without fallback values
  let spotPrice = externalData.spot_price !== null && externalData.spot_price !== undefined
    ? Number(externalData.spot_price)
    : null;
  console.log(`Spot price from API: ${spotPrice}`);
  
  // Extract change data without fallbacks
  const change = externalData.price_change !== undefined && externalData.price_change !== null 
    ? Number(externalData.price_change) 
    : null;
  
  console.log(`Using change value: ${change} (${typeof externalData.price_change}, raw value: ${externalData.price_change})`);
  
  // No longer applying any formula to modify the original data
  console.log(`Using original spotPrice: ${spotPrice} and change: ${change}`);
  
  const changePercent = externalData.change_percentage !== undefined && externalData.change_percentage !== null
    ? Number(externalData.change_percentage) 
    : null;
  
  // Use the date directly from the API without fallback
  const lastUpdated = externalData.last_updated || null;
  
  console.log(`Processed data: spotPrice=${spotPrice}, change=${change}, changePercent=${changePercent}, lastUpdated=${lastUpdated}`);
  
  return {
    spotPrice,
    change,
    changePercent,
    lastUpdated
  };
}

// Type definition for database record with support for Prisma Decimal type
interface DbRecord {
  id: string;
  spotPrice: unknown; // Using unknown instead of any for Prisma Decimal
  change: unknown;    // Using unknown instead of any for Prisma Decimal
  changePercent: unknown; // Using unknown instead of any for Prisma Decimal
  createdAt: Date;
  source: string | null;
}

// Function to save price data to database with improved error handling and less restrictive duplicate prevention
async function savePriceToDatabase(
  spotPrice: number | null,
  change: number | null,
  changePercent: number | null,
  createdAt: Date
): Promise<DbRecord> {
  try {
    console.log(`SAVING TO DATABASE - Change: ${change}, Date: ${createdAt}`);
    console.log(`Storing original API values for spotPrice, change, and changePercent`);
    
    // Log the database connection status
    try {
      await prisma.$connect();
      console.log("Database connection established successfully");
    } catch (connErr) {
      console.error("Database connection error:", connErr);
      throw new Error(`Database connection failed: ${connErr}`);
    }
    
    // Modified duplicate check - only check for exact duplicates in the last 5 minutes
    // This is less restrictive than before to ensure data gets stored
    const fiveMinutesMs = 5 * 60 * 1000;
    const timeRangeStart = new Date(createdAt.getTime() - fiveMinutesMs);
    
    console.log("Checking for exact duplicate records in the last 5 minutes...");
    
    // Only check for exact duplicates with the same timestamp and change value
    let exactDuplicate: DbRecord | null = null;
    try {
      exactDuplicate = await prisma.metalPrice.findFirst({
        where: {
          source: 'metal-price',
          createdAt: {
            gte: timeRangeStart
          },
          change: change !== null ? {
            equals: change
          } : {}
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      console.log(exactDuplicate ? "Found exact duplicate record" : "No exact duplicate found");
    } catch (findErr) {
      console.error("Error checking for duplicates:", findErr);
      // Continue execution - we'll treat this as no duplicates found
    }
    
    // Only skip if we found an exact duplicate with the same timestamp (within seconds)
    if (exactDuplicate) {
      const duplicateTime = exactDuplicate.createdAt.getTime();
      const currentTime = createdAt.getTime();
      const timeDiffSeconds = Math.abs(duplicateTime - currentTime) / 1000;
      
      // If the duplicate is within 10 seconds of the current record, skip it
      if (timeDiffSeconds < 10) {
        console.log(`Found exact duplicate record with same change value (${change}) created ${timeDiffSeconds} seconds ago, skipping save`);
        return exactDuplicate;
      }
    }
    
    // Get the most recent record for logging purposes only
    let mostRecentRecord = null;
    try {
      mostRecentRecord = await prisma.metalPrice.findFirst({
        where: { 
          source: 'metal-price'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      console.log(mostRecentRecord 
        ? `Found most recent record with change value: ${mostRecentRecord.change}` 
        : "No previous records found");
    } catch (findRecentErr) {
      console.error("Error finding most recent record:", findRecentErr);
      // Continue execution - we'll treat this as no recent record found
    }
    
    // REMOVED: The check for identical change value in most recent record
    // REMOVED: The 10-minute rate limiting check
    // These were preventing new records from being saved
    
    // Store the original values from the API in the database
    console.log(`Saving record to database with original values: spotPrice=${spotPrice}, change=${change}, changePercent=${changePercent}`);
    
    let record;
    try {
      // Create the new record
      record = await prisma.metalPrice.create({
        data: {
          spotPrice: spotPrice !== null ? new Prisma.Decimal(spotPrice) : new Prisma.Decimal(0),      // Store original spotPrice or 0 if null
          change: change !== null ? new Prisma.Decimal(change) : new Prisma.Decimal(0),            // Store original change value or 0 if null
          changePercent: changePercent !== null ? new Prisma.Decimal(changePercent) : new Prisma.Decimal(0), // Store original changePercent or 0 if null
          source: 'metal-price'       // Mark the source of this record
        }
      });
      
      console.log(`New record created with ID: ${record.id}, change: ${record.change}, spotPrice: ${record.spotPrice}, changePercent: ${record.changePercent}, source: ${record.source}`);
    } catch (createErr) {
      console.error("ERROR CREATING RECORD:", createErr);
      throw createErr; // Re-throw to be caught by the caller
    }
    
    return record;
  } catch (error) {
    console.error('Error saving price to database - TOP LEVEL:', error);
    throw error;
  }
}

// Function to get latest price with auto-refresh when stale
async function getLatestPriceWithRefresh(forceRefresh: boolean = false): Promise<ApiResponse> {
  console.log(`getLatestPriceWithRefresh called, forceRefresh=${forceRefresh}`);
  
  try {
    // Check if we have a cached response and it's still valid
    // Set cache TTL to 2 minutes to balance between frequent updates and preventing duplicates
    responseCache.ttl = 2 * 60 * 1000; // 2 minute cache TTL
    
    if (!forceRefresh && responseCache.data && (Date.now() - responseCache.timestamp < responseCache.ttl)) {
      console.log(`Using cached response from ${new Date(responseCache.timestamp).toISOString()}`);
      return responseCache.data as ApiResponse;
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
        // Cash settlement logic has been moved to the dedicated cash-settlement.ts API
        
        // Check if we got valid data (not the empty fallback)
        if (!externalData || 
            (externalData.spot_price === null && externalData.price_change === null)) {
          console.log('External API returned fallback/empty data, falling back to database');
          throw new Error('External API unavailable');
        }
        
        // Process the data
        const { spotPrice, change, changePercent, lastUpdated } = processExternalData(externalData);
        
        console.log(`Processed data: spotPrice=${spotPrice}, change=${change}, changePercent=${changePercent}, lastUpdated=${lastUpdated}`);
        
        // Cash settlement data is now handled by the dedicated cash-settlement.ts API
        
        // Check if this data is different from what we already have in the database
        // Only prevent duplicates if the record was created very recently (within 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        
        if (latestPrice && 
            change !== null && 
            Math.abs(Number(latestPrice.change) - change) < 0.001 && 
            latestPrice.createdAt > twoMinutesAgo) {
          console.log(`Change value (${change}) is identical to latest database record (${latestPrice.change}) created within last 2 minutes, skipping database write`);
          
          // Return the data we already have but with fresh flag
          return {
            type: 'spotPrice',
            spotPrice: spotPrice !== null ? Number(spotPrice) : undefined,
            change: Number(latestPrice.change) || 0, // Ensure non-null change value
            changePercent: Number(changePercent) || 0,
            lastUpdated: latestPrice.createdAt.toISOString(),
            fresh: true,
            source: 'database-cached'
          };
        }
        
        console.log(`Proceeding with database write for change value: ${change}`);
        
        // Always save to database, even with zero spotPrice, since we only care about the change value
        // Format the date properly
        const formattedDate = new Date();
        
        // USE TRY-CATCH TO ISOLATE DATABASE ERRORS
        let savedRecord = null;
        
        // Create the result object before trying to save to database
        const result: ApiResponse = {
          type: 'spotPrice',
          spotPrice: spotPrice !== null ? Number(spotPrice) : undefined,
          change: change !== null ? Number(change) : undefined,
          changePercent: changePercent !== null ? Number(changePercent) : undefined,
          lastUpdated: formattedDate.toISOString(),
          fresh: true,
          source: 'external'
        };
        
        try {
          console.log(`Explicitly saving to database: spotPrice=${spotPrice}, change=${change}, changePercent=${changePercent}, date=${formattedDate}`);
          console.log(`Storing original API values in the database`);
          
          // Save the original values from the API
          savedRecord = await savePriceToDatabase(spotPrice, change, changePercent, formattedDate);
          
          console.log('Successfully saved new price data to database with ID:', savedRecord.id);
          console.log(`Saved record values: change=${savedRecord.change}, spotPrice=${savedRecord.spotPrice}, changePercent=${savedRecord.changePercent}`);
          
          // Add info about saving to database
          result.message = `Data saved to database with ID: ${savedRecord.id}`;
        } catch (saveErr) {
          console.error('ERROR SAVING TO DATABASE:', saveErr);
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

// Function to delete MetalPrice data older than 2 days
async function deleteOlderThanTwoDays() {
  try {
    // Calculate the date 2 days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    console.log(`Deleting MetalPrice records older than ${twoDaysAgo.toISOString()}`);
    
    // Delete records older than 2 days
    const deleteResult = await prisma.metalPrice.deleteMany({
      where: {
        createdAt: {
          lt: twoDaysAgo
        }
      }
    });
    
    console.log(`Deleted ${deleteResult.count} records older than 2 days`);
    return deleteResult.count;
  } catch (error) {
    console.error('Error deleting records older than 2 days:', error);
    return 0;
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

// Average price calculation has been moved to the dedicated average-price.ts API

// Cash settlement functions have been moved to the dedicated cash-settlement.ts API

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
  
  // Automatic cleanup has been removed - cleanup is now manual only
  // To manually clean up data, use the API endpoint with ?forcecleanup=true&olderThanTwoDays=true
  
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
      const { spotPrice, change, changePercent, createdAt } = req.body;
      
      // Validate required values
      if (change === undefined || change === null) {
        console.error('Missing change value in request body');
        return res.status(400).json({ 
          error: 'Bad request', 
          message: 'change value is required' 
        });
      }

      // Parse and validate values
      const spotPriceValue = spotPrice !== undefined && spotPrice !== null ? Number(spotPrice) : null;
      const changeValue = Number(change);
      const changePercentValue = changePercent !== undefined && changePercent !== null ? Number(changePercent) : null;
      
      if (isNaN(changeValue) || (spotPriceValue !== null && isNaN(spotPriceValue)) || (changePercentValue !== null && isNaN(changePercentValue))) {
        console.error('Invalid values provided:', { spotPrice, change, changePercent });
        return res.status(400).json({ 
          error: 'Bad request', 
          message: 'Invalid values provided' 
        });
      }

      console.log(`Processing values: spotPrice=${spotPriceValue}, change=${changeValue}, changePercent=${changePercentValue}`);

      // Format date from string or use current date
      const formattedDate = createdAt ? new Date(createdAt) : new Date();

      // Save new record to database with all original values
      const newRecord = await prisma.metalPrice.create({
        data: {
          spotPrice: spotPriceValue !== null ? new Prisma.Decimal(spotPriceValue) : new Prisma.Decimal(0),
          change: new Prisma.Decimal(changeValue),
          changePercent: changePercentValue !== null ? new Prisma.Decimal(changePercentValue) : new Prisma.Decimal(0),
          createdAt: formattedDate,
          source: 'metal-price'
        }
      });
      
      console.log(`Added new record with original values: spotPrice=${spotPriceValue}, change=${changeValue}, changePercent=${changePercentValue}, date=${formattedDate}`);
      console.log(`New record values: spotPrice=${newRecord.spotPrice}, change=${newRecord.change}, changePercent=${newRecord.changePercent}, source=${newRecord.source}`);
      
      return res.status(201).json({
        success: true,
        message: 'Change value added to database',
        record: {
          id: newRecord.id,
          spotPrice: Number(newRecord.spotPrice),
          change: Number(newRecord.change),
          changePercent: Number(newRecord.changePercent),
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
      // Skip duplicate removal as requested
      // await removeDuplicateRecords();
      
      // If specifically requested to delete older than 2 days
      if (req.query.olderThanTwoDays === 'true') {
        const deletedCount = await deleteOlderThanTwoDays();
        return res.status(200).json({ 
          success: true, 
          message: `Cleanup completed. Deleted ${deletedCount} records older than 2 days.`,
          deletedCount
        });
      }
      
      // Otherwise run the regular cleanup
      const keepCount = req.query.keepCount ? parseInt(req.query.keepCount as string) : 100;
      await cleanupOldRecords(keepCount);
      return res.status(200).json({ 
        success: true, 
        message: `Cleanup completed. Keeping ${keepCount} most recent records.`
      });
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

  // If returnAverage is true, redirect to the dedicated average-price API
  if (returnAverage === 'true') {
    console.log('Redirecting to dedicated average-price API');
    
    // Return a redirect response to the average-price API
    res.setHeader('Location', `/api/average-price?_t=${Date.now()}`);
    return res.status(307).json({
      type: 'noData',
      message: 'Average price calculation has been moved to /api/average-price'
    });
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
