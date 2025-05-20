import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { EventSourcePolyfill, MessageEvent } from 'event-source-polyfill';

const prisma = new PrismaClient();

// Define the data structure based on the API response
interface PriceData {
  price: number;
  site_rate_change: string;
}

interface ApiResponse {
  date: string;
  time: string;
  timestamp: string;
  prices: {
    [contractMonth: string]: PriceData;
  };
}

interface PreviousEntry {
  month1Label: string;
  month1Price: number;
  month1RateVal: number;
  month1RatePct: number;
  month2Label: string;
  month2Price: number;
  month2RateVal: number;
  month2RatePct: number;
  month3Label: string;
  month3Price: number;
  month3RateVal: number;
  month3RatePct: number;
}

// Define a return type for the MCX_3_Month database operation
type MCX3MonthData = Prisma.MCX_3_MonthGetPayload<{
  select: {
    id: true;
    timestamp: true;
    month1Label: true;
    month1Price: true;
    month1RateVal: true;
    month1RatePct: true;
    month2Label: true;
    month2Price: true;
    month2RateVal: true;
    month2RatePct: true;
    month3Label: true;
    month3Price: true;
    month3RateVal: true;
    month3RatePct: true;
    createdAt: true;
  };
}>;

// Cache to store the last processed data to avoid duplicates
let lastProcessedData: {
  timestamp: string;
  month1Label: string;
  month1Price: number;
  month2Label: string;
  month2Price: number;
  month3Label: string;
  month3Price: number;
} | null = null;

// Helper function to validate date objects
function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

// Helper function to parse rate change string
function parseRateChange(rateChangeStr: string): { rateChange: number; rateChangePercent: number } {
  // Format: "-0.4 (-0.17%)"
  const match = rateChangeStr.match(/^([-+]?\d+\.?\d*)\s*\(([-+]?\d+\.?\d*)%\)$/);
  
  if (!match) {
    return { rateChange: 0, rateChangePercent: 0 };
  }
  
  const rateChange = parseFloat(match[1]);
  const rateChangePercent = parseFloat(match[2]);
  
  return { rateChange, rateChangePercent };
}

// Helper function to store data in the database, supporting partial updates
async function storeData(data: ApiResponse): Promise<MCX3MonthData | null> {
  try {
    // Check if the timestamp from data is valid
    let timestamp: Date;
    
    if (data.timestamp && isValidDate(new Date(data.timestamp))) {
      // Convert timestamp to Indian time (UTC+5:30)
      const utcTimestamp = new Date(data.timestamp);
      // Add 5 hours and 30 minutes to convert to Indian time
      timestamp = new Date(utcTimestamp.getTime() + (5.5 * 60 * 60 * 1000));
      console.log(`Using API timestamp: Original UTC timestamp: ${utcTimestamp.toISOString()}, Indian timestamp: ${timestamp.toISOString()}`);
    } else {
      // If timestamp is invalid or missing, use current time in IST
      const now = new Date();
      // Current time is already in local timezone, just log it
      timestamp = now;
      console.log(`API timestamp invalid or missing, using current time: ${timestamp.toISOString()}`);
    }
    
    const prices = Object.entries(data.prices);
    
    // More comprehensive check for existing records with similar timestamps
    // Look for records within a 5-minute window to catch slight timestamp variations
    const fiveMinutesBeforeTimestamp = new Date(timestamp.getTime() - 5 * 60 * 1000);
    const fiveMinutesAfterTimestamp = new Date(timestamp.getTime() + 5 * 60 * 1000);
    
    const existingRecords = await prisma.mCX_3_Month.findMany({
      where: { 
        timestamp: {
          gte: fiveMinutesBeforeTimestamp,
          lte: fiveMinutesAfterTimestamp
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (existingRecords.length > 0) {
      console.log(`Found ${existingRecords.length} records with similar timestamps, checking for data changes`);
      
      // Check if any of these records have the same data
      for (const existingRecord of existingRecords) {
        // Get the sorted price keys for comparison
        const priceKeys = Object.keys(data.prices).sort();
        
        // If the record exists with the same data, skip saving
        const hasSameData = 
          (existingRecord.month1Label === priceKeys[0] || !priceKeys[0]) &&
          (existingRecord.month2Label === priceKeys[1] || !priceKeys[1]) &&
          (existingRecord.month3Label === priceKeys[2] || !priceKeys[2]) &&
          (Math.abs(Number(existingRecord.month1Price) - parseFloat(data.prices[existingRecord.month1Label]?.price.toString() || '0')) < 0.001) &&
          (Math.abs(Number(existingRecord.month2Price) - parseFloat(data.prices[existingRecord.month2Label]?.price.toString() || '0')) < 0.001) &&
          (Math.abs(Number(existingRecord.month3Price) - parseFloat(data.prices[existingRecord.month3Label]?.price.toString() || '0')) < 0.001);
        
        if (hasSameData) {
          console.log('Duplicate data detected in database, skipping save');
          return null;
        }
      }
    }
    
    // Get the most recent record to use for any missing months
    let previousEntry: PreviousEntry[] | null = null;
    try {
      previousEntry = await prisma.$queryRaw<PreviousEntry[]>`
        SELECT 
          "month1Label", 
          "month1Price"::float, 
          "month1RateVal"::float, 
          "month1RatePct"::float,
          "month2Label", 
          "month2Price"::float, 
          "month2RateVal"::float, 
          "month2RatePct"::float,
          "month3Label", 
          "month3Price"::float, 
          "month3RateVal"::float, 
          "month3RatePct"::float
        FROM "MCX_3_Month"
        ORDER BY timestamp DESC
        LIMIT 1
      `;
    } catch (error) {
      console.error('Error fetching previous entry:', error);
      previousEntry = null;
    }

    // Initialize with previous values if available, otherwise use defaults
    let month1Label = previousEntry?.[0]?.month1Label || '';
    let month1Price = previousEntry?.[0]?.month1Price || 0;
    let month1RateVal = previousEntry?.[0]?.month1RateVal || 0;
    let month1RatePct = previousEntry?.[0]?.month1RatePct || 0;
    
    let month2Label = previousEntry?.[0]?.month2Label || '';
    let month2Price = previousEntry?.[0]?.month2Price || 0;
    let month2RateVal = previousEntry?.[0]?.month2RateVal || 0;
    let month2RatePct = previousEntry?.[0]?.month2RatePct || 0;
    
    let month3Label = previousEntry?.[0]?.month3Label || '';
    let month3Price = previousEntry?.[0]?.month3Price || 0;
    let month3RateVal = previousEntry?.[0]?.month3RateVal || 0;
    let month3RatePct = previousEntry?.[0]?.month3RatePct || 0;
    
    // Flag to track if any data has changed
    let hasNewData = false;
    
    // Update the available months from the new data
    if (prices.length > 0) {
      console.log(`Found ${prices.length} month(s) in new data`);
      
      // Sort contracts by month/year
      const sortedPrices = [...prices].sort((a, b) => {
        const aMonth = a[0]; // e.g. "JUN24" or "June24"
        const bMonth = b[0];
        
        // Function to convert month names to numeric values for correct sorting
        const getMonthNumeric = (monthStr: string) => {
          const monthMap: Record<string, number> = {
            "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
            "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
            "JANUARY": 1, "FEBRUARY": 2, "MARCH": 3, "APRIL": 4, "MAY_FULL": 5, "JUNE": 6,
            "JULY": 7, "AUGUST": 8, "SEPTEMBER": 9, "OCTOBER": 10, "NOVEMBER": 11, "DECEMBER": 12
          };
          
          // Extract month part and year part (assuming format like "JUN24" or "June24")
          const monthPart = monthStr.replace(/[0-9]/g, "").toUpperCase();
          // Special case for "MAY" since it can be both abbreviated and full form
          const normalizedMonthPart = monthPart === "MAY" ? "MAY" : monthPart;
          
          // Get numeric month value or default to 0 if not found
          const monthValue = monthMap[normalizedMonthPart] || 0;
          const yearPart = monthStr.replace(/[^0-9]/g, "");
          const yearValue = parseInt(yearPart, 10) || 0;
          
          // Return a value that can be compared (year * 100 + month)
          // This ensures that JAN25 comes after DEC24
          return (yearValue * 100) + monthValue;
        };
        
        const aValue = getMonthNumeric(aMonth);
        const bValue = getMonthNumeric(bMonth);
        
        // Sort in ascending order (earliest month first)
        return aValue - bValue;
      });
      
      // Log the sorted months for debugging
      console.log('Months after sorting (chronological order):', sortedPrices.map(pair => pair[0]).join(', '));
      
      // Update month 1 if available
      if (sortedPrices[0]) {
        const [month1, month1Data] = sortedPrices[0];
        const month1PriceNew = parseFloat(month1Data.price.toString());
        if (!isNaN(month1PriceNew)) {
          const { rateChange: m1RateVal, rateChangePercent: m1RatePct } = parseRateChange(month1Data.site_rate_change);
          
          // Check if data has changed
          if (month1Label !== month1 || Math.abs(month1Price - month1PriceNew) > 0.001 || 
              Math.abs(month1RateVal - m1RateVal) > 0.001 || Math.abs(month1RatePct - m1RatePct) > 0.001) {
            hasNewData = true;
          }
          
          month1Label = month1;
          month1Price = month1PriceNew;
          month1RateVal = m1RateVal;
          month1RatePct = m1RatePct;
        }
      }
      
      // Update month 2 if available
      if (sortedPrices[1]) {
        const [month2, month2Data] = sortedPrices[1];
        const month2PriceNew = parseFloat(month2Data.price.toString());
        if (!isNaN(month2PriceNew)) {
          const { rateChange: m2RateVal, rateChangePercent: m2RatePct } = parseRateChange(month2Data.site_rate_change);
          
          // Check if data has changed
          if (month2Label !== month2 || Math.abs(month2Price - month2PriceNew) > 0.001 || 
              Math.abs(month2RateVal - m2RateVal) > 0.001 || Math.abs(month2RatePct - m2RatePct) > 0.001) {
            hasNewData = true;
          }
          
          month2Label = month2;
          month2Price = month2PriceNew;
          month2RateVal = m2RateVal;
          month2RatePct = m2RatePct;
        }
      }
      
      // Update month 3 if available
      if (sortedPrices[2]) {
        const [month3, month3Data] = sortedPrices[2];
        const month3PriceNew = parseFloat(month3Data.price.toString());
        if (!isNaN(month3PriceNew)) {
          const { rateChange: m3RateVal, rateChangePercent: m3RatePct } = parseRateChange(month3Data.site_rate_change);
          
          // Check if data has changed
          if (month3Label !== month3 || Math.abs(month3Price - month3PriceNew) > 0.001 || 
              Math.abs(month3RateVal - m3RateVal) > 0.001 || Math.abs(month3RatePct - m3RatePct) > 0.001) {
            hasNewData = true;
          }
          
          month3Label = month3;
          month3Price = month3PriceNew;
          month3RateVal = m3RateVal;
          month3RatePct = m3RatePct;
        }
      }
    }
    
    // If no data has changed, skip saving
    if (!hasNewData) {
      console.log('No new data detected, skipping save');
      if (previousEntry && previousEntry.length > 0) {
        // Return the existing record to avoid unnecessary database writes
        return null;
      }
    }
    
    // Check against in-memory cache for duplicate detection
    if (lastProcessedData && 
        lastProcessedData.timestamp === data.timestamp &&
        lastProcessedData.month1Label === month1Label && 
        Math.abs(lastProcessedData.month1Price - month1Price) < 0.001 &&
        lastProcessedData.month2Label === month2Label &&
        Math.abs(lastProcessedData.month2Price - month2Price) < 0.001 &&
        lastProcessedData.month3Label === month3Label &&
        Math.abs(lastProcessedData.month3Price - month3Price) < 0.001) {
      console.log('Duplicate data detected in memory cache, skipping save');
      return null;
    }

    // Update memory cache with this new data
    lastProcessedData = {
      timestamp: data.timestamp,
      month1Label,
      month1Price,
      month2Label,
      month2Price,
      month3Label,
      month3Price
    };

    // Add rate limiting to prevent too frequent updates for the same timestamp
    // Use IST time for rate limiting as well
    const nowUTC = new Date();
    const nowIST = new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000));
    const fiveSecondsAgo = new Date(nowIST.getTime() - 5000);
    
    console.log(`Rate limiting check: Current IST time: ${nowIST.toISOString()}, Checking records after: ${fiveSecondsAgo.toISOString()}`);
    
    const recentRecords = await prisma.mCX_3_Month.count({
      where: {
        createdAt: {
          gte: fiveSecondsAgo
        }
      }
    });
    
    if (recentRecords > 0) {
      console.log('Rate limiting: too many recent updates, skipping this one');
      return null;
    }

    // Save the data with available months and previous values for missing months
    console.log('Storing partial data update for timestamp:', data.timestamp);
    
    // Create the current IST time for createdAt field
    // Get current UTC time and convert to IST by adding 5 hours and 30 minutes
    const currentUTCTime = new Date();
    const currentISTTime = new Date(currentUTCTime.getTime() + (5.5 * 60 * 60 * 1000));
    console.log(`Current UTC time: ${currentUTCTime.toISOString()}, Current IST time: ${currentISTTime.toISOString()}`);
    
    return await prisma.mCX_3_Month.create({
      data: {
        timestamp,
        month1Label,
        month1Price,
        month1RateVal,
        month1RatePct,
        month2Label,
        month2Price,
        month2RateVal,
        month2RatePct,
        month3Label,
        month3Price,
        month3RateVal,
        month3RatePct,
        // Explicitly set createdAt to current IST time
        createdAt: currentISTTime,
      },
    });
  } catch (error) {
    console.error('Error storing data:', error);
    return null;
  }
}

// Function to start continuous data fetching
let eventSource: EventSourcePolyfill | null = null;
let isFetching = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function stopDataFetching() {
  if (eventSource) {
    console.log('Closing existing event source connection');
    eventSource.close();
    eventSource = null;
  }
  isFetching = false;
}

async function startDataFetching() {
  if (isFetching) {
    console.log('Already fetching data, not starting a new connection');
    return;
  }
  
  // Close any existing connection before starting a new one
  stopDataFetching();
  
  isFetching = true;
  console.log('Starting continuous data fetching...');

  try {
    eventSource = new EventSourcePolyfill('http://148.135.138.22:5006/stream', {
      headers: {
        'Accept': 'text/event-stream'
      }
    });

    // Set onopen handler to reset reconnect attempts
    eventSource.onopen = () => {
      console.log('Connection to stream established');
      reconnectAttempts = 0;
    };

    eventSource.onmessage = async (event: MessageEvent) => {
      try {
        const data: ApiResponse = JSON.parse(event.data);
        await storeData(data);
      } catch (error) {
        console.error('Error processing stream data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Error in event source:', error);
      stopDataFetching();
      
      // Only attempt to reconnect if we haven't exceeded the maximum attempts
      reconnectAttempts++;
      if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        console.log(`Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        // Use exponential backoff for reconnect attempts
        const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000);
        setTimeout(startDataFetching, delay);
      } else {
        console.log('Max reconnect attempts reached, giving up');
      }
    };
  } catch (error) {
    console.error('Error starting data fetching:', error);
    stopDataFetching();
    
    // Only attempt to reconnect if we haven't exceeded the maximum attempts
    reconnectAttempts++;
    if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
      console.log(`Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60000);
      setTimeout(startDataFetching, delay);
    } else {
      console.log('Max reconnect attempts reached, giving up');
    }
  }
}

// Start data fetching when the API is first loaded
// In a serverless environment, this won't persist between requests
// so we'll also fetch on each request
let hasStarted = false;
if (!hasStarted) {
  hasStarted = true;
  startDataFetching();
}

async function fetchLatestData(): Promise<ApiResponse | null> {
  return new Promise((resolve, reject) => {
    const tempEventSource = new EventSourcePolyfill('http://148.135.138.22:5006/stream', {
      headers: {
        'Accept': 'text/event-stream'
      }
    });

    const timeout = setTimeout(() => {
      tempEventSource.close();
      resolve(null);
    }, 5000);

    tempEventSource.onmessage = (event) => {
      clearTimeout(timeout);
      tempEventSource.close();
      try {
        const data: ApiResponse = JSON.parse(event.data);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };

    tempEventSource.onerror = (error) => {
      clearTimeout(timeout);
      tempEventSource.close();
      reject(error);
    };
  });
}

// Clean up resources when the module is unloaded
process.on('beforeExit', () => {
  stopDataFetching();
});

// Function to deduplicate existing database records
async function deduplicateExistingRecords() {
  try {
    console.log('Starting deduplication of existing records');
    
    // Get all unique timestamps
    const uniqueTimestamps = await prisma.$queryRaw<{timestamp: Date}[]>`
      SELECT DISTINCT timestamp FROM "MCX_3_Month" ORDER BY timestamp
    `;
    
    let deletedCount = 0;
    
    // For each timestamp, keep only the most recent record (by createdAt)
    for (const { timestamp } of uniqueTimestamps) {
      // Get all records for this timestamp, ordered by createdAt
      const records = await prisma.mCX_3_Month.findMany({
        where: { timestamp },
        orderBy: { createdAt: 'desc' },
      });
      
      // If there's more than one record for this timestamp, delete all but the first (most recent by createdAt)
      if (records.length > 1) {
        const keepId = records[0].id;
        const deleteResult = await prisma.mCX_3_Month.deleteMany({
          where: {
            timestamp,
            id: { not: keepId }
          }
        });
        
        deletedCount += deleteResult.count;
        console.log(`Deleted ${deleteResult.count} duplicates for timestamp ${timestamp.toISOString()}`);
      }
    }
    
    console.log(`Deduplication complete. Deleted ${deletedCount} duplicate records.`);
    return deletedCount;
  } catch (error) {
    console.error('Error during deduplication:', error);
    return 0;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // Handle deduplicate request
      if (req.query.deduplicate === 'true') {
        const deletedCount = await deduplicateExistingRecords();
        return res.status(200).json({
          success: true,
          message: `Deduplication completed. Deleted ${deletedCount} duplicate records.`
        });
      }
      
      // Handle cleanup request
      if (req.query.cleanup === 'true') {
        const { days = '7' } = req.query;
        const daysToKeep = parseInt(days as string, 10);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const deleteCount = await prisma.mCX_3_Month.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        });
        
        return res.status(200).json({
          success: true,
          message: `Deleted ${deleteCount.count} records older than ${daysToKeep} days`
        });
      }
      
      // First, try to fetch latest data from the stream
      try {
        const latestData = await fetchLatestData();
        if (latestData) {
          const storedData = await storeData(latestData);
          if (storedData) {
            console.log('New data saved successfully');
          }
        }
      } catch (error) {
        console.error('Error fetching latest data:', error);
        // Continue with retrieving stored data even if fetching fails
      }

      // Then retrieve stored data
      const { limit = '100', page = '1' } = req.query;
      const limitNum = parseInt(limit as string);
      const pageNum = parseInt(page as string);
      const skip = (pageNum - 1) * limitNum;
      
      const totalCount = await prisma.mCX_3_Month.count();
      
      const data = await prisma.mCX_3_Month.findMany({
        orderBy: { timestamp: 'desc' },
        skip,
        take: limitNum,
      });
      
      return res.status(200).json({
        success: true,
        data,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      });
    } catch (error) {
      console.error('Error in API handler:', error);
      return res.status(500).json({
        success: false,
        message: 'Error processing request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      // Note: We're not disconnecting Prisma here to allow for better connection pooling
      // in a serverless environment. The connection will be managed by the Prisma client.
    }
  } else {
    return res.status(405).json({ message: 'Method not allowed' });
  }
}
