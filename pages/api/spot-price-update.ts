import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EventSourcePolyfill, MessageEvent } from 'event-source-polyfill';

const prisma = new PrismaClient();

// Response interface for properly typed API responses
interface ApiResponse {
  success: boolean;
  message: string;
  data?: {
    spotPrice: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
    duplicate?: boolean;
    threeMonthPrice?: number;
  };
  error?: string;
}

// Interface for streaming API response data
interface StreamData {
  success: boolean;
  data: {
    Value: string;
    'Rate of Change': string;
    Timestamp: string;
    'Time span': string;
    error?: string | null;
  };
}

// Interface for processed price data
interface ProcessedPriceData {
  threeMonthPrice: number;
  change: number;
  changePercent: number;
  timestamp: string;
  timeSpan: string;
}

// Interface for database record (matching Prisma return type)
interface PrismaMetalPriceRecord {
  id: string;
  spotPrice: Decimal; // Prisma Decimal type
  change: Decimal; // Prisma Decimal type
  changePercent: Decimal; // Prisma Decimal type
  createdAt: Date;
  source: string | null;
}

// Interface for processed database record
interface MetalPriceRecord {
  id: string;
  spotPrice: number;
  change: number;
  changePercent: number;
  createdAt: Date;
  source: string;
}

// In-memory cache to prevent rapid duplicate requests at the API level
const requestCache = new Map<string, { timestamp: number; data: ApiResponse }>();
const CACHE_DURATION_MS = 2000; // 2 seconds cache for API requests

/**
 * Creates IST Date object for proper database storage
 */
function createISTDate(): Date {
  const now = new Date();
  
  // Manual calculation (most reliable method)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istTime = new Date(now.getTime() + istOffset);
  
  console.log(`UTC Time: ${now.toISOString()}`);
  console.log(`IST Time: ${istTime.toISOString()}`);
  
  return istTime;
}

/**
 * Helper function to parse rate change string from the streaming API
 */
function parseRateChange(rateChangeStr: string): { rateChange: number; rateChangePercent: number } {
  console.log('Parsing rate change string:', rateChangeStr);
  
  // Try first format: "-5.45 ((-0.23%))"
  let match = rateChangeStr.match(/^([-+]?\d+\.?\d*)\s*\(\(([-+]?\d+\.?\d*)%\)\)$/);
  
  if (!match) {
    // Try alternate format: "-5.45 (-0.23%)"
    match = rateChangeStr.match(/^([-+]?\d+\.?\d*)\s*\(([-+]?\d+\.?\d*)%\)$/);
  }
  
  if (!match) {
    console.log('Failed to parse rate change string:', rateChangeStr);
    // Extract just the first number if possible
    const firstNumber = parseFloat(rateChangeStr.split(' ')[0]);
    if (!isNaN(firstNumber)) {
      return { rateChange: firstNumber, rateChangePercent: 0 };
    }
    return { rateChange: 0, rateChangePercent: 0 };
  }
  
  const rateChange = parseFloat(match[1]);
  const rateChangePercent = parseFloat(match[2]);
  
  return { rateChange, rateChangePercent };
}

/**
 * Fetches metal price data from the streaming API
 */
async function fetchFromStream(): Promise<ProcessedPriceData> {
  console.log('Connecting to stream endpoint...');
  return new Promise((resolve, reject) => {
    try {
      const eventSource = new EventSourcePolyfill('http://148.135.138.22:5004/stream', {
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        },
        heartbeatTimeout: 15000 // Increase heartbeat timeout
      });

      // Set a timeout in case the stream doesn't respond
      const timeout = setTimeout(() => {
        console.log('Stream connection timed out');
        eventSource.close();
        reject(new Error('Stream connection timed out'));
      }, 15000); // Increased timeout to 15 seconds

      eventSource.onopen = () => {
        console.log('Stream connection opened');
      };

      eventSource.onmessage = (event: MessageEvent) => {
        console.log('Received message from stream:', event.data);
        clearTimeout(timeout);
        eventSource.close();
        
        try {
          const data = JSON.parse(event.data) as StreamData;
          
          if (!data.success || !data.data) {
            console.error('Invalid data format from stream API:', data);
            reject(new Error('Invalid data format from stream API'));
            return;
          }
          
          const rawData = data.data;
          const rateChangeData = parseRateChange(rawData['Rate of Change']);
          
          // Process the streaming data
          const processedData: ProcessedPriceData = {
            threeMonthPrice: parseFloat(rawData.Value.replace(/,/g, '')),
            change: rateChangeData.rateChange,
            changePercent: rateChangeData.rateChangePercent,
            timestamp: rawData.Timestamp,
            timeSpan: rawData['Time span']
          };
          
          console.log('Processed data from stream:', processedData);
          resolve(processedData);
        } catch (error) {
          console.error('Error processing stream data:', error);
          eventSource.close();
          reject(error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Stream connection error:', error);
        clearTimeout(timeout);
        eventSource.close();
        reject(error);
      };
    } catch (error) {
      console.error('Error setting up stream connection:', error);
      reject(error);
    }
  });
}

/**
 * Fetches metal price data directly from the data endpoint
 */
async function fetchDirectData(): Promise<ProcessedPriceData | null> {
  console.log('Fetching directly from data endpoint...');
  try {
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch('http://148.135.138.22:5004/data', {
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      signal: controller.signal
    });
    
    // Clear the timeout as request completed
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Data endpoint returned status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Data from direct API call:', data);
    
    if (!data.success || !data.data) {
      throw new Error('Invalid data format from data endpoint');
    }
    
    const rawData = data.data;
    const rateChangeData = parseRateChange(rawData['Rate of Change']);
    
    // Process the data
    const processedData: ProcessedPriceData = {
      threeMonthPrice: parseFloat(rawData.Value.replace(/,/g, '')),
      change: rateChangeData.rateChange,
      changePercent: rateChangeData.rateChangePercent,
      timestamp: rawData.Timestamp,
      timeSpan: rawData['Time span']
    };
    
    console.log('Processed data from data endpoint:', processedData);
    return processedData;
  } catch (error) {
    console.error('Error fetching from data endpoint:', error);
    return null;
  }
}

/**
 * Main function to fetch price data
 */
async function fetchPriceData(): Promise<ProcessedPriceData | null> {
  try {
    // Try direct data endpoint first
    console.log('Using direct data endpoint');
    const directData = await fetchDirectData();
    if (directData) {
      return directData;
    }
    
    // Fall back to stream if direct fails
    console.log('Direct fetch failed, trying stream endpoint as fallback');
    return await fetchFromStream();
  } catch (error) {
    console.error('All data fetching methods failed:', error);
    return null;
  }
}

/**
 * Simplified duplicate detection - only checks the most recent record
 * This prevents consecutive identical entries but allows the same data to be stored again later
 */
async function checkConsecutiveDuplicate(
  spotPrice: number, 
  change: number, 
  changePercent: number
): Promise<{ isDuplicate: boolean; existingRecord?: PrismaMetalPriceRecord }> {
  
  console.log(`Checking for consecutive duplicate - spotPrice: ${spotPrice}, change: ${change}, changePercent: ${changePercent}`);
  
  // Only check the most recent record with source='spot-price-update'
  const mostRecentRecord = await prisma.metalPrice.findFirst({
    where: {
      source: 'spot-price-update'
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  if (!mostRecentRecord) {
    console.log('No previous records found - this will be the first record');
    return { isDuplicate: false };
  }
  
  // Check if the most recent record has identical values
  const recentSpotPrice = Number(mostRecentRecord.spotPrice);
  const recentChange = Number(mostRecentRecord.change);
  const recentChangePercent = Number(mostRecentRecord.changePercent);
  
  console.log('Most recent record:', {
    id: mostRecentRecord.id,
    spotPrice: recentSpotPrice,
    change: recentChange,
    changePercent: recentChangePercent,
    createdAt: mostRecentRecord.createdAt.toISOString()
  });
  
  // Check if values are identical (with small tolerance for floating point precision)
  const spotPriceMatch = Math.abs(recentSpotPrice - spotPrice) < 0.01;
  const changeMatch = Math.abs(recentChange - change) < 0.01;
  const changePercentMatch = Math.abs(recentChangePercent - changePercent) < 0.01;
  
  const isIdentical = spotPriceMatch && changeMatch && changePercentMatch;
  
  if (isIdentical) {
    const timeDiffMs = new Date().getTime() - mostRecentRecord.createdAt.getTime();
    const timeDiffMinutes = timeDiffMs / 60000;
    
    console.log(`Most recent record has identical values (${timeDiffMinutes.toFixed(2)} minutes ago) - treating as consecutive duplicate`);
    return { isDuplicate: true, existingRecord: mostRecentRecord as PrismaMetalPriceRecord };
  }
  
  console.log('Most recent record has different values - not a consecutive duplicate');
  return { isDuplicate: false };
}

/**
 * Create new record with atomic transaction and consecutive duplicate prevention
 * Fixed to store IST time in createdAt column
 */
async function createRecordWithTransaction(
  spotPrice: number,
  change: number,
  changePercent: number
): Promise<{ isNew: boolean; record: MetalPriceRecord }> {
  return await prisma.$transaction(async (tx) => {
    console.log('Starting transaction to create/check record');
    
    // Check for consecutive duplicates within the transaction
    const { isDuplicate, existingRecord } = await checkConsecutiveDuplicate(
      spotPrice, 
      change, 
      changePercent
    );
    
    if (isDuplicate && existingRecord) {
      console.log('Consecutive duplicate detected, returning existing record');
      return { 
        isNew: false, 
        record: {
          id: existingRecord.id,
          spotPrice: Number(existingRecord.spotPrice),
          change: Number(existingRecord.change),
          changePercent: Number(existingRecord.changePercent),
          createdAt: existingRecord.createdAt,
          source: existingRecord.source || 'spot-price-update'
        }
      };
    }
    
    console.log('No consecutive duplicate found - creating new record with IST time');
    
    // Get IST time for database storage
    const istTime = createISTDate();
    
    console.log('Creating new record with IST timestamp:', {
      spotPrice,
      change,
      changePercent,
      createdAt: istTime.toISOString()
    });
    
    // Create the new record with IST timestamp
    const newRecord = await tx.metalPrice.create({
      data: {
        spotPrice: spotPrice,
        change: change,
        changePercent: changePercent,
        createdAt: istTime, // Use IST time instead of new Date()
        source: 'spot-price-update'
      }
    });
    
    console.log('New record created with IST time:', {
      id: newRecord.id,
      spotPrice: Number(newRecord.spotPrice),
      change: Number(newRecord.change),
      changePercent: Number(newRecord.changePercent),
      createdAt: newRecord.createdAt.toISOString(),
      source: newRecord.source
    });
    
    return { 
      isNew: true, 
      record: {
        id: newRecord.id,
        spotPrice: Number(newRecord.spotPrice),
        change: Number(newRecord.change),
        changePercent: Number(newRecord.changePercent),
        createdAt: newRecord.createdAt,
        source: newRecord.source || 'spot-price-update'
      }
    };
  });
}

/**
 * API handler for calculating and updating spot price
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Get IST time for logging
  const istTime = createISTDate();
  console.log(`API request received: ${req.method} ${req.url} at IST: ${istTime.toISOString()}`);
  
  // Set cache control headers to prevent browser caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Allow both GET and POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Only GET and POST requests are supported.' 
    });
  }

  try {
    // Create a request signature for caching
    const requestSignature = `${req.method}_${JSON.stringify(req.body || {})}_${req.query.toString()}`;
    const now = Date.now();
    
    // Check in-memory cache for recent identical requests
    const cachedRequest = requestCache.get(requestSignature);
    if (cachedRequest && (now - cachedRequest.timestamp) < CACHE_DURATION_MS) {
      console.log('Returning cached response for duplicate request');
      return res.status(200).json({
        ...cachedRequest.data,
        message: 'Cached response - duplicate request detected'
      });
    }

    // For POST requests, we can use the provided data
    // For GET requests, we'll fetch from the API
    let threeMonthPrice: number | null = null;
    let change: number | null = null;
    let changePercent: number | null = null;
    let timestamp: string | null = null;
    let timeSpan: string | null = null;
    let forceUpdate = false;
    
    if (req.method === 'POST') {
      // Extract data from request body for POST requests
      const requestData = req.body;
      threeMonthPrice = requestData.threeMonthPrice;
      timestamp = requestData.timestamp;
      change = requestData.change;
      changePercent = requestData.changePercent;
      timeSpan = requestData.timeSpan || 'current';
      forceUpdate = requestData.forceUpdate || false;
      
      console.log('Received POST request with data:', {
        threeMonthPrice,
        timestamp,
        change,
        changePercent,
        timeSpan,
        forceUpdate
      });
    } else {
      // For GET requests, fetch data from the API with fallback
      console.log('Received GET request, fetching data from API with fallback mechanism');
      
      // Fetch data from the API with fallback
      const priceData = await fetchPriceData();
      
      if (!priceData) {
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch price data from all available sources'
        });
      }
      
      // Extract the values
      threeMonthPrice = priceData.threeMonthPrice;
      change = priceData.change;
      changePercent = priceData.changePercent;
      timestamp = priceData.timestamp;
      timeSpan = priceData.timeSpan;
      
      console.log('Processed data from API:', {
        threeMonthPrice,
        change,
        changePercent,
        timestamp,
        timeSpan
      });
    }

    // If we couldn't get the threeMonthPrice, return an error
    if (threeMonthPrice === null) {
      return res.status(400).json({
        success: false,
        message: 'Failed to get required three month price data'
      });
    }
    
    // Get the most recent change value from the database with source='metal-price'
    try {
      const latestMetalPriceRecord = await prisma.metalPrice.findFirst({
        where: {
          source: 'metal-price'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      // If we found a record, use its change and changePercent values
      if (latestMetalPriceRecord) {
        // Override the change and changePercent values from the external API
        change = Number(latestMetalPriceRecord.change);
        changePercent = Number(latestMetalPriceRecord.changePercent);
        
        console.log('Using change and changePercent values from the database (source=metal-price):', {
          change,
          changePercent,
          recordId: latestMetalPriceRecord.id,
          recordCreatedAt: latestMetalPriceRecord.createdAt
        });
      } else {
        // If no record found with source='metal-price', try to get one with any source
        const anyLatestRecord = await prisma.metalPrice.findFirst({
          orderBy: {
            createdAt: 'desc'
          }
        });
        
        if (anyLatestRecord) {
          // Use values from any latest record
          change = Number(anyLatestRecord.change);
          changePercent = Number(anyLatestRecord.changePercent);
          
          console.log('No records with source=metal-price found. Using values from latest record with source=' + anyLatestRecord.source, {
            change,
            changePercent,
            recordId: anyLatestRecord.id,
            recordCreatedAt: anyLatestRecord.createdAt
          });
        } else if (change !== null && changePercent !== null) {
          // If no records at all in the database but we have values from the API, use those
          console.log('No records found in database. Using values from API:', {
            change,
            changePercent
          });
        } else {
          // If no values available at all, use default values
          change = 0;
          changePercent = 0;
          console.log('No change values available. Using default values:', {
            change,
            changePercent
          });
        }
      }
    } catch (error) {
      console.error('Error fetching change values from database:', error);
      
      // If there's an error with the database query, use the values from the API if available
      if (change === null || changePercent === null) {
        change = 0;
        changePercent = 0;
        console.log('Database error. Using default values:', {
          change,
          changePercent
        });
      } else {
        console.log('Database error. Using values from API:', {
          change,
          changePercent
        });
      }
    }

    // Parse and validate all values
    const formattedThreeMonthPrice = Number(threeMonthPrice);
    const formattedChange = Number(change);
    const formattedChangePercent = Number(changePercent);
    
    if (isNaN(formattedThreeMonthPrice) || isNaN(formattedChange) || isNaN(formattedChangePercent)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid numeric values provided'
      });
    }

    // Calculate spot price using the formula: threeMonthPrice (from API) + change (from database)
    const calculatedSpotPrice = formattedThreeMonthPrice + formattedChange;
    console.log(`Calculated spot price: ${formattedThreeMonthPrice} (from API) + ${formattedChange} (from database) = ${calculatedSpotPrice}`);
    
    // Round values to ensure consistency
    const roundedSpotPrice = Math.round(calculatedSpotPrice * 100) / 100;
    const roundedChange = Math.round(formattedChange * 100) / 100;
    const roundedChangePercent = Math.round(formattedChangePercent * 100) / 100;
    const roundedThreeMonthPrice = Math.round(formattedThreeMonthPrice * 100) / 100;
    
    console.log(`Rounded values - spotPrice: ${roundedSpotPrice}, change: ${roundedChange}, changePercent: ${roundedChangePercent}, threeMonthPrice: ${roundedThreeMonthPrice}`);

    // Check for consecutive duplicates and create record atomically with IST time
    const { isNew, record } = await createRecordWithTransaction(
      roundedSpotPrice,
      roundedChange,
      roundedChangePercent
    );
    
    const responseData: ApiResponse = {
      success: true,
      message: isNew ? 'Spot price calculated and saved successfully with IST timestamp' : 'Consecutive duplicate detected, using existing record',
      data: {
        spotPrice: Number(record.spotPrice),
        change: Number(record.change),
        changePercent: Number(record.changePercent),
        threeMonthPrice: roundedThreeMonthPrice,
        lastUpdated: record.createdAt.toISOString(),
        duplicate: !isNew
      }
    };
    
    // Cache the response
    requestCache.set(requestSignature, {
      timestamp: now,
      data: responseData
    });
    
    // Clean up old cache entries
    for (const [key, value] of requestCache.entries()) {
      if (now - value.timestamp > CACHE_DURATION_MS) {
        requestCache.delete(key);
      }
    }
    
    console.log(`${isNew ? 'Created new record with IST time' : 'Used existing record'}:`, {
      id: record.id,
      spotPrice: Number(record.spotPrice),
      change: Number(record.change),
      changePercent: Number(record.changePercent),
      createdAt: record.createdAt.toISOString(),
      source: record.source
    });

    return res.status(isNew ? 201 : 200).json(responseData);
    
  } catch (error) {
    console.error('Error calculating or saving spot price:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate or save spot price',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
}
