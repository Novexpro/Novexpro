import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { EventSourcePolyfill, MessageEvent } from 'event-source-polyfill';

// Singleton Prisma instance with connection pooling
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Optimize connection pool
  __internal: {
    engine: {
      pool_timeout: 10,
      connection_limit: 10,
    },
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Rate limiting and caching
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;
const CACHE_TTL = 30000; // 30 seconds cache
const MIN_DATA_CHANGE_THRESHOLD = 0.001;
const MAX_DB_WRITES_PER_MINUTE = 10;

// In-memory stores for optimization
const requestCounts = new Map<string, { count: number; windowStart: number }>();
const dataCache = new Map<string, { data: any; timestamp: number }>();
const dbWriteTracker = { count: 0, windowStart: Date.now() };
let circuitBreakerOpen = false;
let circuitBreakerOpenTime = 0;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

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

// Cache for last processed data with TTL
let lastProcessedData: {
  timestamp: string;
  month1Label: string;
  month1Price: number;
  month2Label: string;
  month2Price: number;
  month3Label: string;
  month3Price: number;
  cachedAt: number;
} | null = null;

// Rate limiting middleware
function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const clientData = requestCounts.get(clientIp);

  if (!clientData || now - clientData.windowStart > RATE_LIMIT_WINDOW) {
    requestCounts.set(clientIp, { count: 1, windowStart: now });
    return true;
  }

  if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  clientData.count++;
  return true;
}

// Circuit breaker pattern
function checkCircuitBreaker(): boolean {
  if (circuitBreakerOpen) {
    if (Date.now() - circuitBreakerOpenTime > CIRCUIT_BREAKER_TIMEOUT) {
      circuitBreakerOpen = false;
      console.log('Circuit breaker reset');
      return true;
    }
    return false;
  }
  return true;
}

function openCircuitBreaker(): void {
  circuitBreakerOpen = true;
  circuitBreakerOpenTime = Date.now();
  console.log('Circuit breaker opened due to high load');
}

// Database write rate limiting
function canWriteToDatabase(): boolean {
  const now = Date.now();
  
  if (now - dbWriteTracker.windowStart > RATE_LIMIT_WINDOW) {
    dbWriteTracker.count = 0;
    dbWriteTracker.windowStart = now;
  }
  
  return dbWriteTracker.count < MAX_DB_WRITES_PER_MINUTE;
}

// Cache management
function getCachedData(key: string): any | null {
  const cached = dataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  dataCache.delete(key);
  return null;
}

function setCachedData(key: string, data: any): void {
  // Limit cache size to prevent memory issues
  if (dataCache.size > 100) {
    const oldestKey = dataCache.keys().next().value;
    dataCache.delete(oldestKey);
  }
  dataCache.set(key, { data, timestamp: Date.now() });
}

// Helper function to validate date objects
function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

// Helper function to parse rate change string with error handling
function parseRateChange(rateChangeStr: string): { rateChange: number; rateChangePercent: number } {
  try {
    const match = rateChangeStr.match(/^([-+]?\d+\.?\d*)\s*\(([-+]?\d+\.?\d*)%\)$/);
    
    if (!match) {
      return { rateChange: 0, rateChangePercent: 0 };
    }
    
    const rateChange = parseFloat(match[1]);
    const rateChangePercent = parseFloat(match[2]);
    
    if (isNaN(rateChange) || isNaN(rateChangePercent)) {
      return { rateChange: 0, rateChangePercent: 0 };
    }
    
    return { rateChange, rateChangePercent };
  } catch (error) {
    console.error('Error parsing rate change:', error);
    return { rateChange: 0, rateChangePercent: 0 };
  }
}

// Optimized data storage with intelligent deduplication
async function storeData(data: ApiResponse): Promise<MCX3MonthData | null> {
  try {
    // Check circuit breaker
    if (!checkCircuitBreaker()) {
      console.log('Circuit breaker open, skipping database operation');
      return null;
    }

    // Check database write rate limit
    if (!canWriteToDatabase()) {
      console.log('Database write rate limit exceeded, skipping write');
      return null;
    }

    // Validate input data
    if (!data || !data.prices || Object.keys(data.prices).length === 0) {
      console.log('Invalid or empty data received, skipping');
      return null;
    }

    // Check cache first
    const cacheKey = `data_${data.timestamp}`;
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      console.log('Data found in cache, skipping database operation');
      return cachedResult;
    }

    let timestamp: Date;
    
    if (data.timestamp && isValidDate(new Date(data.timestamp))) {
      const utcTimestamp = new Date(data.timestamp);
      timestamp = new Date(utcTimestamp.getTime() + (5.5 * 60 * 60 * 1000));
    } else {
      timestamp = new Date();
      console.log('Using current time due to invalid timestamp');
    }

    // Quick duplicate check against memory cache
    if (lastProcessedData && 
        lastProcessedData.timestamp === data.timestamp &&
        Date.now() - lastProcessedData.cachedAt < CACHE_TTL) {
      
      const prices = Object.entries(data.prices).sort();
      const isSameData = prices.length > 0 && 
        lastProcessedData.month1Label === prices[0]?.[0] &&
        Math.abs(lastProcessedData.month1Price - (prices[0]?.[1]?.price || 0)) < MIN_DATA_CHANGE_THRESHOLD;
      
      if (isSameData) {
        console.log('Duplicate data detected in memory, skipping');
        return null;
      }
    }

    // Batch database checks to reduce queries
    const recentCheckPromise = prisma.mCX_3_Month.findFirst({
      where: { 
        timestamp: {
          gte: new Date(timestamp.getTime() - 300000), // 5 minutes
          lte: new Date(timestamp.getTime() + 300000)
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const previousEntryPromise = prisma.mCX_3_Month.findFirst({
      orderBy: { timestamp: 'desc' },
      select: {
        month1Label: true,
        month1Price: true,
        month1RateVal: true,
        month1RatePct: true,
        month2Label: true,
        month2Price: true,
        month2RateVal: true,
        month2RatePct: true,
        month3Label: true,
        month3Price: true,
        month3RateVal: true,
        month3RatePct: true,
      }
    });

    const [existingRecord, previousEntry] = await Promise.all([
      recentCheckPromise,
      previousEntryPromise
    ]);

    if (existingRecord) {
      console.log('Similar timestamp record exists, checking for changes');
      // Add logic to compare data changes
      const prices = Object.entries(data.prices).sort();
      if (prices.length > 0) {
        const newPrice = prices[0][1].price;
        if (Math.abs(Number(existingRecord.month1Price) - newPrice) < MIN_DATA_CHANGE_THRESHOLD) {
          console.log('No significant price change, skipping save');
          return null;
        }
      }
    }

    // Process the data efficiently
    const prices = Object.entries(data.prices);
    const sortedPrices = [...prices].sort((a, b) => {
      const getMonthNumeric = (monthStr: string) => {
        const monthMap: Record<string, number> = {
          "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
          "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12,
          "JANUARY": 1, "FEBRUARY": 2, "MARCH": 3, "APRIL": 4, "JUNE": 6,
          "JULY": 7, "AUGUST": 8, "SEPTEMBER": 9, "OCTOBER": 10, "NOVEMBER": 11, "DECEMBER": 12
        };
        
        const fullFormatMatch = monthStr.match(/^(\w+)\s+(\d{4})$/);
        if (fullFormatMatch) {
          const monthPart = fullFormatMatch[1].toUpperCase();
          const yearPart = fullFormatMatch[2];
          const monthValue = monthMap[monthPart] || 0;
          const yearValue = parseInt(yearPart, 10) || 0;
          return (yearValue * 100) + monthValue;
        }
        return 0;
      };
      
      return getMonthNumeric(a[0]) - getMonthNumeric(b[0]);
    });

    // Initialize with previous values or defaults
    let month1Label = previousEntry?.month1Label || '';
    let month1Price = Number(previousEntry?.month1Price) || 0;
    let month1RateVal = Number(previousEntry?.month1RateVal) || 0;
    let month1RatePct = Number(previousEntry?.month1RatePct) || 0;
    
    let month2Label = previousEntry?.month2Label || '';
    let month2Price = Number(previousEntry?.month2Price) || 0;
    let month2RateVal = Number(previousEntry?.month2RateVal) || 0;
    let month2RatePct = Number(previousEntry?.month2RatePct) || 0;
    
    let month3Label = previousEntry?.month3Label || '';
    let month3Price = Number(previousEntry?.month3Price) || 0;
    let month3RateVal = Number(previousEntry?.month3RateVal) || 0;
    let month3RatePct = Number(previousEntry?.month3RatePct) || 0;

    let hasNewData = false;

    // Update available months from new data
    if (sortedPrices.length > 0) {
      // Process month 1
      if (sortedPrices[0]) {
        const [month1, month1Data] = sortedPrices[0];
        const month1PriceNew = parseFloat(month1Data.price.toString());
        if (!isNaN(month1PriceNew)) {
          const { rateChange: m1RateVal, rateChangePercent: m1RatePct } = parseRateChange(month1Data.site_rate_change);
          
          if (month1Label !== month1 || Math.abs(month1Price - month1PriceNew) > MIN_DATA_CHANGE_THRESHOLD || 
              Math.abs(month1RateVal - m1RateVal) > MIN_DATA_CHANGE_THRESHOLD || Math.abs(month1RatePct - m1RatePct) > MIN_DATA_CHANGE_THRESHOLD) {
            hasNewData = true;
          }
          
          month1Label = month1;
          month1Price = month1PriceNew;
          month1RateVal = m1RateVal;
          month1RatePct = m1RatePct;
        }
      }

      // Process month 2
      if (sortedPrices[1]) {
        const [month2, month2Data] = sortedPrices[1];
        const month2PriceNew = parseFloat(month2Data.price.toString());
        if (!isNaN(month2PriceNew)) {
          const { rateChange: m2RateVal, rateChangePercent: m2RatePct } = parseRateChange(month2Data.site_rate_change);
          
          if (month2Label !== month2 || Math.abs(month2Price - month2PriceNew) > MIN_DATA_CHANGE_THRESHOLD || 
              Math.abs(month2RateVal - m2RateVal) > MIN_DATA_CHANGE_THRESHOLD || Math.abs(month2RatePct - m2RatePct) > MIN_DATA_CHANGE_THRESHOLD) {
            hasNewData = true;
          }
          
          month2Label = month2;
          month2Price = month2PriceNew;
          month2RateVal = m2RateVal;
          month2RatePct = m2RatePct;
        }
      }

      // Process month 3
      if (sortedPrices[2]) {
        const [month3, month3Data] = sortedPrices[2];
        const month3PriceNew = parseFloat(month3Data.price.toString());
        if (!isNaN(month3PriceNew)) {
          const { rateChange: m3RateVal, rateChangePercent: m3RatePct } = parseRateChange(month3Data.site_rate_change);
          
          if (month3Label !== month3 || Math.abs(month3Price - month3PriceNew) > MIN_DATA_CHANGE_THRESHOLD || 
              Math.abs(month3RateVal - m3RateVal) > MIN_DATA_CHANGE_THRESHOLD || Math.abs(month3RatePct - m3RatePct) > MIN_DATA_CHANGE_THRESHOLD) {
            hasNewData = true;
          }
          
          month3Label = month3;
          month3Price = month3PriceNew;
          month3RateVal = m3RateVal;
          month3RatePct = m3RatePct;
        }
      }
    }

    if (!hasNewData) {
      console.log('No significant data changes detected, skipping save');
      return null;
    }

    // Update memory cache
    lastProcessedData = {
      timestamp: data.timestamp,
      month1Label,
      month1Price,
      month2Label,
      month2Price,
      month3Label,
      month3Price,
      cachedAt: Date.now()
    };

    const currentISTTime = new Date(Date.now() + (5.5 * 60 * 60 * 1000));
    
    // Create record with timeout
    const createPromise = prisma.mCX_3_Month.create({
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
        createdAt: currentISTTime,
      },
    });

    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Database operation timeout')), 5000);
    });

    const result = await Promise.race([createPromise, timeoutPromise]);
    
    if (result) {
      dbWriteTracker.count++;
      setCachedData(cacheKey, result);
      console.log('Data stored successfully');
    }
    
    return result as MCX3MonthData;

  } catch (error) {
    console.error('Error storing data:', error);
    // Open circuit breaker on database errors
    if (error instanceof Error && error.message.includes('timeout')) {
      openCircuitBreaker();
    }
    return null;
  }
}

// Connection management
let eventSource: EventSourcePolyfill | null = null;
let isFetching = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3; // Reduced from 5

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
  
  stopDataFetching();
  
  isFetching = true;
  console.log('Starting continuous data fetching...');

  try {
    eventSource = new EventSourcePolyfill('http://148.135.138.22:5002/stream', {
      headers: {
        'Accept': 'text/event-stream'
      },
      // Add connection timeout
      heartbeatTimeout: 60000,
    });

    eventSource.onopen = () => {
      console.log('Connection to stream established');
      reconnectAttempts = 0;
    };

    eventSource.onmessage = async (event: MessageEvent) => {
      try {
        if (!checkCircuitBreaker()) {
          console.log('Circuit breaker open, skipping message processing');
          return;
        }
        
        const data: ApiResponse = JSON.parse(event.data);
        await storeData(data);
      } catch (error) {
        console.error('Error processing stream data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Error in event source:', error);
      stopDataFetching();
      
      reconnectAttempts++;
      if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        console.log(`Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        const delay = Math.min(10000 * Math.pow(1.5, reconnectAttempts - 1), 60000);
        setTimeout(startDataFetching, delay);
      } else {
        console.log('Max reconnect attempts reached, giving up');
        openCircuitBreaker();
      }
    };
  } catch (error) {
    console.error('Error starting data fetching:', error);
    stopDataFetching();
    openCircuitBreaker();
  }
}

// Optimized latest data fetching with timeout
async function fetchLatestData(): Promise<ApiResponse | null> {
  if (!checkCircuitBreaker()) {
    console.log('Circuit breaker open, skipping latest data fetch');
    return null;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (tempEventSource) {
        tempEventSource.close();
      }
      resolve(null);
    }, 3000); // Reduced timeout

    let tempEventSource: EventSourcePolyfill;
    
    try {
      tempEventSource = new EventSourcePolyfill('http://148.135.138.22:5002/stream', {
        headers: {
          'Accept': 'text/event-stream'
        }
      });

      tempEventSource.onmessage = (event) => {
        clearTimeout(timeout);
        tempEventSource.close();
        try {
          const data: ApiResponse = JSON.parse(event.data);
          resolve(data);
        } catch (error) {
          resolve(null);
        }
      };

      tempEventSource.onerror = () => {
        clearTimeout(timeout);
        tempEventSource.close();
        resolve(null);
      };
    } catch (error) {
      clearTimeout(timeout);
      resolve(null);
    }
  });
}

// Optimized deduplication with batching
async function deduplicateExistingRecords() {
  try {
    if (!checkCircuitBreaker()) {
      console.log('Circuit breaker open, skipping deduplication');
      return 0;
    }

    console.log('Starting optimized deduplication');
    
    // Use raw query for better performance
    const duplicates = await prisma.$queryRaw<{id: number, timestamp: Date, row_num: number}[]>`
      SELECT id, timestamp, ROW_NUMBER() OVER (PARTITION BY timestamp ORDER BY "createdAt" DESC) as row_num
      FROM "MCX_3_Month"
    `;
    
    const idsToDelete = duplicates
      .filter(record => record.row_num > 1)
      .map(record => record.id);
    
    if (idsToDelete.length > 0) {
      // Batch delete in chunks
      const chunkSize = 100;
      let deletedCount = 0;
      
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        const result = await prisma.mCX_3_Month.deleteMany({
          where: { id: { in: chunk } }
        });
        deletedCount += result.count;
      }
      
      console.log(`Deduplication complete. Deleted ${deletedCount} duplicate records.`);
      return deletedCount;
    }
    
    return 0;
  } catch (error) {
    console.error('Error during deduplication:', error);
    openCircuitBreaker();
    return 0;
  }
}

// Graceful shutdown
process.on('beforeExit', () => {
  stopDataFetching();
});

process.on('SIGTERM', () => {
  stopDataFetching();
  prisma.$disconnect();
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();
  
  try {
    // Get client IP for rate limiting
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                     req.connection.remoteAddress || 
                     'unknown';

    // Apply rate limiting
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded. Please try again later.'
      });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

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
      if (!checkCircuitBreaker()) {
        return res.status(503).json({
          success: false,
          message: 'Service temporarily unavailable due to high load'
        });
      }

      const { days = '7' } = req.query;
      const daysToKeep = Math.min(parseInt(days as string, 10), 30); // Limit to 30 days max
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

    // Check cache first for data retrieval
    const { limit = '100', page = '1' } = req.query;
    const limitNum = Math.min(parseInt(limit as string), 1000); // Limit max results
    const pageNum = Math.max(parseInt(page as string), 1);
    const skip = (pageNum - 1) * limitNum;
    
    const cacheKey = `api_data_${limitNum}_${pageNum}`;
    const cachedResponse = getCachedData(cacheKey);
    
    if (cachedResponse) {
      console.log('Returning cached response');
      return res.status(200).json(cachedResponse);
    }

    // Try to fetch latest data (non-blocking)
    if (req.query.fetch !== 'false') {
      fetchLatestData()
        .then(latestData => {
          if (latestData) {
            storeData(latestData).catch(error => {
              console.error('Background data storage error:', error);
            });
          }
        })
        .catch(error => {
          console.error('Background data fetch error:', error);
        });
    }

    // Retrieve stored data with optimized query
    const [totalCount, data] = await Promise.all([
      prisma.mCX_3_Month.count(),
      prisma.mCX_3_Month.findMany({
        orderBy: { timestamp: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          timestamp: true,
          month1Label: true,
          month1Price: true,
          month1RateVal: true,
          month1RatePct: true,
          month2Label: true,
          month2Price: true,
          month2RateVal: true,
          month2RatePct: true,
          month3Label: true,
          month3Price: true,
          month3RateVal: true,
          month3RatePct: true,
          createdAt: true,
        }
      })
    ]);
    
    const response = {
      success: true,
      data,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum)
      },
      performance: {
        processTime: Date.now() - startTime,
        circuitBreakerStatus: circuitBreakerOpen ? 'open' : 'closed'
      }
    };

    // Cache the response
    setCachedData(cacheKey, response);
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Error in API handler:', error);
    
    // Open circuit breaker on repeated errors
    openCircuitBreaker();
    
    return res.status(500).json({
      success: false,
      message: 'Service temporarily unavailable',
      error: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : 
        'Internal server error'
    });
  }
}