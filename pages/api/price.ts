import { NextApiRequest, NextApiResponse } from 'next';
import { EventSourcePolyfill, MessageEvent } from 'event-source-polyfill';
import { PrismaClient } from '@prisma/client';

interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
  timeSpan: string;
}

// Cache the last successful response
let cachedData: PriceData | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5000; // 5 seconds

// Initialize Prisma client once (better practice)
const prisma = new PrismaClient();

// Helper function to parse rate change string
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

// Helper function to convert timestamp to IST
function convertToIST(timestampStr: string): Date {
  console.log('Converting timestamp to IST:', timestampStr);
  
  // Try parsing the timestamp
  let date = new Date(timestampStr);
  
  // If invalid date, try current time
  if (isNaN(date.getTime())) {
    console.log('Invalid timestamp, using current time');
    date = new Date();
  }
  
  // Convert to IST (UTC + 5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istDate = new Date(date.getTime() + istOffset);
  
  console.log('Original timestamp:', date.toISOString());
  console.log('IST timestamp:', istDate.toISOString());
  
  return istDate;
}

// Function for direct API call (fallback)
async function fetchFromDataEndpoint(): Promise<PriceData> {
  console.log('Trying direct API call to /data endpoint');
  const response = await fetch('http://148.135.138.22:5007/data', {
    headers: {
      'Accept': 'application/json',
    },
    timeout: 10000, // 10 second timeout
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  console.log('Data from direct API call:', data);

  if (!data.success || !data.data) {
    throw new Error('Invalid data format from direct API');
  }

  const rawData = data.data;
  const rateChangeData = parseRateChange(rawData['Rate of Change']);

  return {
    price: parseFloat(rawData.Value.replace(/,/g, '')),
    change: rateChangeData.rateChange,
    changePercent: rateChangeData.rateChangePercent,
    timestamp: rawData.Timestamp,
    timeSpan: rawData['Time span']
  };
}

// Function to fetch data from stream
async function fetchFromStream(): Promise<PriceData> {
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
      }, 8000); // Increased timeout

      eventSource.onopen = () => {
        console.log('Stream connection opened');
      };

      eventSource.onmessage = (event: MessageEvent) => {
        console.log('Received message from stream:', event.data);
        clearTimeout(timeout);
        eventSource.close();
        
        try {
          const data = JSON.parse(event.data);
          
          if (!data.success || !data.data) {
            console.error('Invalid data format from stream API:', data);
            reject(new Error('Invalid data format from stream API'));
            return;
          }
          
          const rawData = data.data;
          const rateChangeData = parseRateChange(rawData['Rate of Change']);
          
          // Process the streaming data
          const processedData: PriceData = {
            price: parseFloat(rawData.Value.replace(/,/g, '')),
            change: rateChangeData.rateChange,
            changePercent: rateChangeData.rateChangePercent,
            timestamp: rawData.Timestamp,
            timeSpan: rawData['Time span']
          };
          
          console.log('Processed data:', processedData);
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

// Function to store data in database with proper error handling
async function storeDataInDatabase(priceData: PriceData): Promise<boolean> {
  try {
    console.log('Attempting to store data in database...');
    
    // Convert timestamp to IST
    const istTimestamp = convertToIST(priceData.timestamp);
    
    console.log('Checking for existing records...');
    
    // Check if a record with the same timestamp already exists (with a 1-minute window)
    const existingRecord = await prisma.lME_3Month.findFirst({
      where: {
        timestamp: {
          gte: new Date(istTimestamp.getTime() - 1 * 60 * 1000), // 1 minute before
          lte: new Date(istTimestamp.getTime() + 1 * 60 * 1000), // 1 minute after
        },
        value: {
          gte: priceData.price - 0.01, // Allow small price differences
          lte: priceData.price + 0.01,
        }
      },
    });
    
    if (existingRecord) {
      console.log('Duplicate record found, skipping database insert:', {
        existingId: existingRecord.id,
        existingTimestamp: existingRecord.timestamp,
        existingValue: existingRecord.value
      });
      return false;
    }
    
    console.log('Creating new database record with data:', {
      rateOfChange: String(priceData.change),
      percentage: priceData.changePercent,
      timeSpan: priceData.timeSpan,
      timestamp: istTimestamp,
      value: priceData.price
    });
    
    // Create a new record
    const newRecord = await prisma.lME_3Month.create({
      data: {
        rateOfChange: String(priceData.change),
        percentage: priceData.changePercent,
        timeSpan: priceData.timeSpan,
        timestamp: istTimestamp,
        value: priceData.price
      }
    });
    
    console.log('Data successfully stored in LME_3Month table:', {
      id: newRecord.id,
      timestamp: newRecord.timestamp,
      value: newRecord.value
    });
    
    return true;
  } catch (dbError) {
    console.error('Database error details:', {
      message: dbError.message,
      code: dbError.code,
      meta: dbError.meta,
      stack: dbError.stack
    });
    
    // Check for specific Prisma errors
    if (dbError.code === 'P2002') {
      console.log('Unique constraint violation - record already exists');
    } else if (dbError.code === 'P2025') {
      console.log('Record not found error');
    } else if (dbError.code === 'P1001') {
      console.log('Database connection error');
    }
    
    throw dbError;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API request received for /api/price at:', new Date().toISOString());
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check if we have cached data that's still valid
    const now = Date.now();
    if (cachedData && (now - lastFetchTime) < CACHE_DURATION) {
      console.log('Returning cached data');
      return res.status(200).json(cachedData);
    }

    let priceData: PriceData;
    
    // First try to get data from the stream
    try {
      priceData = await fetchFromStream();
      console.log('Successfully fetched data from stream');
    } catch (streamError) {
      console.error('Stream error:', streamError);
      // If stream fails, try the direct data endpoint
      console.log('Falling back to direct data endpoint');
      priceData = await fetchFromDataEndpoint();
    }
    
    // Store in database for analytics and history
    let dbStoreSuccess = false;
    try {
      dbStoreSuccess = await storeDataInDatabase(priceData);
    } catch (dbError) {
      console.error('Failed to store data in database, but continuing with API response');
      // Don't throw error - continue with API response even if DB storage fails
    }

    // Update cache
    cachedData = priceData;
    lastFetchTime = now;

    // Return the processed data with database storage status
    return res.status(200).json({
      ...priceData,
      dbStored: dbStoreSuccess
    });
    
  } catch (error) {
    console.error('Error fetching price data:', error);
    
    // If we have cached data, return it even if there's an error
    if (cachedData) {
      console.log('Returning cached data due to error');
      return res.status(200).json({
        ...cachedData,
        isCached: true,
        error: 'Using cached data due to API error'
      });
    }

    // If no cached data, use fallback data
    console.log('Using fallback data');
    const fallbackData = {
      price: 2383.15,
      change: -5.45,
      changePercent: -0.23,
      timestamp: new Date().toISOString(),
      timeSpan: "Today",
      isFallback: true,
      error: 'Using fallback data due to API error'
    };

    // Return fallback data
    return res.status(200).json(fallbackData);
  }
}

// Clean up Prisma connection on process exit
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
