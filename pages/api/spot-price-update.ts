import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
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
 * Function for direct API call (fallback)
 */
async function fetchFromDataEndpoint(): Promise<ProcessedPriceData | null> {
  try {
    console.log('Trying direct API call to /data endpoint');
    const response = await fetch('http://148.135.138.22:5007/data', {
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
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
 * Fetches metal price data from the streaming API
 */
async function fetchFromStream(): Promise<ProcessedPriceData> {
  console.log('Connecting to stream endpoint...');
  return new Promise((resolve, reject) => {
    try {
      const eventSource = new EventSourcePolyfill('http://148.135.138.22:5007/stream', {
        headers: {
          'Accept': 'text/event-stream'
        }
      });

      // Set a timeout in case the stream doesn't respond
      const timeout = setTimeout(() => {
        console.log('Stream connection timed out');
        eventSource.close();
        reject(new Error('Stream connection timed out'));
      }, 5000);

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
 * Main function to fetch price data with fallback mechanism
 */
async function fetchPriceData(): Promise<ProcessedPriceData | null> {
  try {
    // First try the streaming endpoint
    return await fetchFromStream();
  } catch (streamError) {
    console.log('Falling back to direct data endpoint');
    try {
      // If streaming fails, try the direct data endpoint
      return await fetchFromDataEndpoint();
    } catch (dataError) {
      console.error('All data fetching methods failed');
      return null;
    }
  }
}

/**
 * Calculates the spot price using the formula: threeMonthPrice + change
 */
function calculateSpotPrice(threeMonthPrice: number, change: number): number {
  const spotPrice = threeMonthPrice + change;
  console.log(`Calculated spot price: ${threeMonthPrice} + ${change} = ${spotPrice}`);
  return spotPrice;
}

/**
 * Sophisticated two-tier duplicate detection system
 * 1. Immediate Duplicate Detection (30-second window)
 * 2. Rapid Pattern Detection (5-second window)
 */

/**
 * Sophisticated two-tier duplicate detection system
 * 1. Immediate Duplicate Detection (30-second window)
 * 2. Rapid Pattern Detection (5-second window)
 */
async function checkForDuplicates(spotPrice: number, change: number, changePercent: number, currentTime: Date = new Date()) {
  // Use the provided timestamp or current server time for consistent comparison
  const now = currentTime;
  
  console.log(`Checking for duplicates with values - spotPrice: ${spotPrice}, change: ${change}, changePercent: ${changePercent}`);
  console.log(`Using timestamp for duplicate detection: ${now.toISOString()}`);
  
  // ==========================================
  // TIER 1: Immediate Duplicate Detection (30-second window)
  // ==========================================
  const exactDuplicateWindowSeconds = 30;
  const exactDuplicateWindowStart = new Date(now.getTime() - (exactDuplicateWindowSeconds * 1000));
  
  console.log(`TIER 1: Checking for exact duplicates within the last ${exactDuplicateWindowSeconds} seconds...`);
  console.log(`Time window: ${exactDuplicateWindowStart.toISOString()} to ${now.toISOString()}`);
  
  // Look for exact duplicates (same values) within the 30-second window
  const exactDuplicates = await prisma.metalPrice.findMany({
    where: {
      spotPrice: spotPrice,
      change: change,
      changePercent: changePercent,
      source: 'spot-price-update',
      createdAt: {
        gte: exactDuplicateWindowStart
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 1
  });
  
  // If an exact duplicate is found within the 30-second window
  if (exactDuplicates.length > 0) {
    const exactDuplicate = exactDuplicates[0];
    const timeDiffMs = now.getTime() - exactDuplicate.createdAt.getTime();
    const timeDiffSeconds = timeDiffMs / 1000;
    
    console.log(`TIER 1: Found exact duplicate within ${timeDiffSeconds.toFixed(2)} seconds:`, {
      id: exactDuplicate.id,
      spotPrice: Number(exactDuplicate.spotPrice),
      change: Number(exactDuplicate.change),
      changePercent: Number(exactDuplicate.changePercent),
      createdAt: exactDuplicate.createdAt.toISOString()
    });
    
    return exactDuplicate;
  }
  
  // ==========================================
  // TIER 2: Rapid Pattern Detection (5-second window)
  // ==========================================
  console.log('TIER 1: No exact duplicates found within 30 seconds');
  console.log('TIER 2: Checking for rapid pattern duplicates within 5 seconds...');
  
  // Define a shorter window for pattern duplicates (5 seconds)
  const patternWindowSeconds = 5;
  const patternWindowStart = new Date(now.getTime() - (patternWindowSeconds * 1000));
  
  console.log(`TIER 2: Time window: ${patternWindowStart.toISOString()} to ${now.toISOString()}`);
  
  // Get all records from the last 5 seconds regardless of values
  const patternRecords = await prisma.metalPrice.findMany({
    where: {
      source: 'spot-price-update',
      createdAt: {
        gte: patternWindowStart
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  
  console.log(`TIER 2: Found ${patternRecords.length} records within the ${patternWindowSeconds}-second window`);
  
  // Check if we found any records within the 5-second window
  if (patternRecords.length > 0) {
    // Check each record to see if any match our current values
    for (const record of patternRecords) {
      const timeDiffMs = now.getTime() - record.createdAt.getTime();
      const timeDiffSeconds = timeDiffMs / 1000;
      
      console.log(`TIER 2: Checking record from ${timeDiffSeconds.toFixed(2)} seconds ago:`, {
        id: record.id,
        spotPrice: Number(record.spotPrice),
        change: Number(record.change),
        changePercent: Number(record.changePercent),
        createdAt: record.createdAt.toISOString()
      });
      
      // If the values match, it's a duplicate pattern
      if (Number(record.spotPrice) === spotPrice &&
          Number(record.change) === change &&
          Number(record.changePercent) === changePercent) {
        
        console.log(`TIER 2: DUPLICATE PATTERN DETECTED - Identical values within ${patternWindowSeconds} seconds`);
        return record;
      }
    }
    
    console.log(`TIER 2: Records found within ${patternWindowSeconds} seconds, but none match current values`);
  } else {
    console.log(`TIER 2: No records found within the ${patternWindowSeconds}-second window`);
  }
  
  // No duplicates found in either tier
  console.log('No duplicates found in either tier, proceeding with new record');
  return null;
}

/**
 * API handler for calculating and updating spot price
 * This endpoint fetches data from an external API, calculates spot price using the formula: threeMonthPrice + change,
 * stores the result in the MetalPrice table, and sends it to the frontend
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
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
    // For POST requests, we can use the provided data
    // For GET requests, we'll fetch from the streaming API
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
      // For GET requests, fetch data from the streaming API
      console.log('Received GET request, fetching data from streaming API');
      
      // Fetch data from the streaming API with fallback
      const priceData = await fetchPriceData();
      
      if (!priceData) {
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch price data from all sources'
        });
      }
      
      // Extract the values
      threeMonthPrice = priceData.threeMonthPrice;
      change = priceData.change;
      changePercent = priceData.changePercent;
      timestamp = priceData.timestamp;
      timeSpan = priceData.timeSpan;
      
      console.log('Processed data from streaming API:', {
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
      // If no record found, return an error
      return res.status(500).json({
        success: false,
        message: 'Failed to get change value from database (source=metal-price)'
      });
    }

    // Parse and validate threeMonthPrice from the streaming API
    const formattedThreeMonthPrice = Number(threeMonthPrice);
    if (isNaN(formattedThreeMonthPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid threeMonthPrice value'
      });
    }
    
    // Parse and validate change from the database
    const formattedChange = Number(change);
    if (isNaN(formattedChange)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid change value from database'
      });
    }
    
    // Parse and validate changePercent from the database
    const formattedChangePercent = Number(changePercent);
    if (isNaN(formattedChangePercent)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid changePercent value from database'
      });
    }

    // Calculate spot price using the formula: threeMonthPrice (from streaming API) + change (from database)
    const calculatedSpotPrice = formattedThreeMonthPrice + formattedChange;
    console.log(`Calculated spot price: ${formattedThreeMonthPrice} (from streaming API) + ${formattedChange} (from database) = ${calculatedSpotPrice}`);
    
    // Round values to ensure consistency between frontend and database
    // This is critical to prevent discrepancies in displayed values
    const roundedSpotPrice = Math.round(calculatedSpotPrice * 100) / 100;
    const roundedChange = Math.round(formattedChange * 100) / 100;
    const roundedChangePercent = Math.round(formattedChangePercent * 100) / 100;
    const roundedThreeMonthPrice = Math.round(formattedThreeMonthPrice * 100) / 100;
    
    console.log(`Rounded values for consistency - spotPrice: ${roundedSpotPrice}, change: ${roundedChange}, changePercent: ${roundedChangePercent}, threeMonthPrice: ${roundedThreeMonthPrice}`);

    // Format the timestamp for database storage
    const formattedTimestamp = timestamp ? new Date(timestamp) : new Date();
  
    console.log(`Using API timestamp: Original UTC timestamp: ${timestamp || 'none'}, Indian timestamp: ${formattedTimestamp.toISOString()}`);
  
    // Store the current timestamp for duplicate detection
    // This ensures we use the exact same timestamp for both saving and checking duplicates
    const currentServerTime = new Date();
    console.log(`Current server time for duplicate detection: ${currentServerTime.toISOString()}`);
  
    // Check for duplicates before saving
    const existingRecord = await checkForDuplicates(roundedSpotPrice, roundedChange, roundedChangePercent, currentServerTime);
    
    // If a duplicate is found, return it instead of creating a new record
    if (existingRecord) {
      const timeDiffMs = formattedTimestamp.getTime() - existingRecord.createdAt.getTime();
      const timeDiffSeconds = timeDiffMs / 1000;
      
      // Determine which tier detected the duplicate
      const detectionTier = Math.abs(timeDiffSeconds) <= 5 ? 'TIER 2 (5-second window)' : 'TIER 1 (30-second window)';
      
      console.log(`${detectionTier} - Duplicate detected, using existing record:`, {
        id: existingRecord.id,
        spotPrice: Number(existingRecord.spotPrice),
        change: Number(existingRecord.change),
        changePercent: Number(existingRecord.changePercent),
        createdAt: existingRecord.createdAt.toISOString(),
        timeElapsed: `${timeDiffSeconds.toFixed(2)} seconds`
      });
      
      // Return the existing record with a duplicate flag
      return res.status(200).json({
        success: true,
        message: `Duplicate submission detected (${detectionTier}). Using existing record.`,
        data: {
          spotPrice: Number(existingRecord.spotPrice),
          change: Number(existingRecord.change),
          changePercent: Number(existingRecord.changePercent),
          threeMonthPrice: Number(existingRecord.spotPrice) - Number(existingRecord.change),
          lastUpdated: existingRecord.createdAt.toISOString(),
          duplicate: true
        }
      });
    }
    
    console.log('No duplicates found. Proceeding to save new record.');
    
    // Second check: Look for request pattern duplicates
    // Get the most recent record to check if this is a duplicate pattern
    const recentRecord = await prisma.metalPrice.findFirst({
      where: {
        source: 'spot-price-update'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // If we have a recent record and it's very similar to our current data
    // AND it was created very recently, it might be a duplicate pattern
    if (recentRecord) {
      const timeDiffMs = formattedTimestamp.getTime() - recentRecord.createdAt.getTime();
      const timeDiffSeconds = timeDiffMs / 1000;
      
      // If the time difference is less than 5 seconds and all values are identical,
      // this is likely a duplicate request pattern (e.g., rapid polling)
      if (timeDiffSeconds < 5 && 
          Number(recentRecord.spotPrice) === roundedSpotPrice &&
          Number(recentRecord.change) === roundedChange &&
          Number(recentRecord.changePercent) === roundedChangePercent) {
        
        console.log('Duplicate pattern detected (rapid identical requests):', {
          id: recentRecord.id,
          spotPrice: Number(recentRecord.spotPrice),
          change: Number(recentRecord.change),
          changePercent: Number(recentRecord.changePercent),
          createdAt: recentRecord.createdAt.toISOString(),
          timeElapsed: `${timeDiffSeconds} seconds`
        });
        
        return res.status(200).json({
          success: true,
          message: 'Duplicate request pattern detected. Using existing record.',
          data: {
            spotPrice: Number(recentRecord.spotPrice),
            change: Number(recentRecord.change),
            changePercent: Number(recentRecord.changePercent),
            lastUpdated: recentRecord.createdAt.toISOString(),
            duplicate: true
          }
        });
      }
      
      console.log('Recent record found but not considered a duplicate:', {
        timeDiffSeconds,
        recentSpotPrice: Number(recentRecord.spotPrice),
        currentSpotPrice: roundedSpotPrice,
        recentChange: Number(recentRecord.change),
        currentChange: roundedChange
      });
    }
    
    console.log('No duplicates found. Attempting to save to database with rounded values:', {
      spotPrice: roundedSpotPrice,
      change: roundedChange,
      changePercent: roundedChangePercent,
      createdAt: formattedTimestamp,
      source: 'spot-price-update'
    });

    // Create a new record in the MetalPrice table using rounded values and the current server time
    // This ensures consistency between what's shown on the frontend and what's stored in the database
    const newRecord = await prisma.metalPrice.create({
      data: {
        spotPrice: roundedSpotPrice,
        change: roundedChange,
        changePercent: roundedChangePercent,
        createdAt: currentServerTime, // Use the same timestamp we used for duplicate detection
        source: 'spot-price-update'
      }
    });

    console.log(`Saved new record with server timestamp: ${currentServerTime.toISOString()}`);
    
    // Record has been saved to the database
    // No need to save to in-memory cache with the new two-tier approach

    console.log('Saved calculated spot price to database and cache:', {
      id: newRecord.id,
      spotPrice: Number(newRecord.spotPrice),
      change: Number(newRecord.change),
      changePercent: Number(newRecord.changePercent),
      createdAt: newRecord.createdAt.toISOString(),
      source: newRecord.source
    });
    
    // Double-check that the record was saved correctly
    const savedRecord = await prisma.metalPrice.findUnique({
      where: { id: newRecord.id }
    });
    
    console.log('Verified saved record from database:', {
      id: savedRecord?.id,
      spotPrice: savedRecord ? Number(savedRecord.spotPrice) : null,
      change: savedRecord ? Number(savedRecord.change) : null,
      changePercent: savedRecord ? Number(savedRecord.changePercent) : null,
      createdAt: savedRecord ? savedRecord.createdAt.toISOString() : null,
      source: savedRecord?.source
    });

    // Return success response with the rounded values
    // This ensures the frontend receives the exact same values that were stored in the database
    return res.status(201).json({
      success: true,
      message: 'Spot price calculated and saved successfully',
      data: {
        spotPrice: roundedSpotPrice,  // Use the rounded value directly instead of re-parsing from the database
        change: roundedChange,         // Use the rounded value directly
        changePercent: roundedChangePercent, // Use the rounded value directly
        threeMonthPrice: roundedThreeMonthPrice, // Include the three-month price
        lastUpdated: newRecord.createdAt.toISOString(),
        duplicate: false
      }
    });
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
