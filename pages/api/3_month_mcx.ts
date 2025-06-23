import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client with connection pooling limits
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
  // Limit connection pool to reduce resource usage
  // connectionLimit: 5, // Not a valid option in PrismaClient constructor
});

// Resource Control Configuration
const CONFIG = {
  // API endpoint
  STREAM_URL: 'http://148.135.138.22:5002/stream',
  
  // Rate limiting - more restrictive to reduce load
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_IP: 20, // Reduced from 50
  
  // Database settings - more conservative
  DB_TIMEOUT: 3000, // Reduced to 3 seconds
  MAX_QUERY_RESULTS: 50, // Reduced from 100
  
  // Caching - increased to reduce database queries
  CACHE_TTL: 60000, // Increased to 60 seconds
  MAX_CACHE_ITEMS: 100, // Limit cache size
  
  // Data processing
  MIN_PRICE_CHANGE: 0.05, // Increased threshold to reduce DB writes
  
  // Connection settings
  CONNECTION_TIMEOUT: 5000, // Reduced to 5 seconds
  RECONNECT_DELAY: 5000, // Increased to 5 seconds
  
  // Resource throttling
  MIN_UPDATE_INTERVAL: 10000, // Minimum 10 seconds between DB updates
  BATCH_SIZE: 20, // Process in smaller batches
  
  // Memory management
  MEMORY_CHECK_INTERVAL: 60000, // 1 minute
  MAX_MEMORY_USAGE_MB: 200, // Maximum memory usage before cleanup
  
  // Time zone settings
  TIMEZONE_OFFSET: 330, // IST offset in minutes (UTC+5:30)
};

// Type definitions
interface PriceData {
  price: number;
  rate_change: string;
}

interface ApiResponse {
  timestamp: string;
  prices: Record<string, PriceData>;
}

// Cache management with size limit
const cache: Record<string, { data: any; timestamp: number }> = {};
let cacheSize = 0;

// Rate limiting
const ipRequestCounts: Record<string, { count: number; windowStart: number }> = {};

// Latest data storage
let latestData: ApiResponse | null = null;
let lastUpdateTime = 0;

// Resource monitoring
let lastMemoryCheck = Date.now();
let lastResourceLog = Date.now();
let updateCount = 0;
let skipCount = 0;

// Convert UTC to Indian Standard Time (IST)
function convertToIST(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : new Date(utcDate);
  
  if (isNaN(date.getTime())) {
    console.error('Invalid date for IST conversion:', utcDate);
    return new Date(); // Return current time as fallback
  }
  
  // Add 5 hours and 30 minutes for IST (UTC+5:30)
  return new Date(date.getTime() + (CONFIG.TIMEZONE_OFFSET * 60000));
}

// Format date for display in IST
function formatISTDate(date: Date | string): string {
  const istDate = convertToIST(date);
  
  // Format as YYYY-MM-DD HH:MM:SS
  return istDate.toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, '');
}

// Parse rate change string into numeric values
function parseRateChange(rateChangeStr: string): { rateChange: number; rateChangePercent: number } {
  const match = rateChangeStr.match(/([-+]?\d+\.?\d*)\s*\(([-+]?\d+\.?\d*)%\)/);
  if (!match) return { rateChange: 0, rateChangePercent: 0 };
  
  return {
    rateChange: parseFloat(match[1]) || 0,
    rateChangePercent: parseFloat(match[2]) || 0
  };
}

// Check rate limit for a client IP
function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  
  // IP-based rate limiting
  const ipData = ipRequestCounts[clientIp];
  if (!ipData || now - ipData.windowStart > CONFIG.RATE_LIMIT_WINDOW) {
    ipRequestCounts[clientIp] = { count: 1, windowStart: now };
    return true;
  }
  
  if (ipData.count >= CONFIG.MAX_REQUESTS_PER_IP) {
    return false;
  }
  
  ipData.count++;
  return true;
}

// Memory usage check
function checkMemoryUsage(): boolean {
  const now = Date.now();
  if (now - lastMemoryCheck < CONFIG.MEMORY_CHECK_INTERVAL) {
    return true;
  }
  
  lastMemoryCheck = now;
  
  // Log resource usage periodically
  if (now - lastResourceLog > CONFIG.MEMORY_CHECK_INTERVAL) {
    lastResourceLog = now;
    console.log(`Resource stats - Updates: ${updateCount}, Skipped: ${skipCount}, Cache size: ${cacheSize}`);
    updateCount = 0;
    skipCount = 0;
  }
  
  // Clean up rate limiting data
  const cutoff = now - CONFIG.RATE_LIMIT_WINDOW;
  Object.keys(ipRequestCounts).forEach(ip => {
    if (ipRequestCounts[ip].windowStart < cutoff) {
      delete ipRequestCounts[ip];
    }
  });
  
  try {
    // Check memory usage (Node.js specific)
    const memoryUsage = process.memoryUsage();
    const usedMemoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
    
    if (usedMemoryMB > CONFIG.MAX_MEMORY_USAGE_MB) {
      // Force cache cleanup to reduce memory usage
      cleanupCache(true);
      
      if (global.gc) {
        try {
          global.gc(); // Force garbage collection if available
        } catch (e) {
          // Ignore if not available
        }
      }
      
      console.warn(`High memory usage: ${usedMemoryMB}MB - Cache cleared`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Memory check error:', error);
    return true;
  }
}

// Get cached data
function getCachedData(key: string): any | null {
  const cached = cache[key];
  if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_TTL) {
    return cached.data;
  }
  
  if (cached) {
    delete cache[key];
    cacheSize--;
  }
  
  return null;
}

// Set cached data with size limit
function setCachedData(key: string, data: any): void {
  // Enforce cache size limit
  if (cacheSize >= CONFIG.MAX_CACHE_ITEMS) {
    cleanupCache();
  }
  
  cache[key] = { data, timestamp: Date.now() };
  cacheSize++;
}

// Clean up cache - remove oldest entries or all if forced
function cleanupCache(forceAll = false): void {
  if (forceAll) {
    Object.keys(cache).forEach(key => {
      delete cache[key];
    });
    cacheSize = 0;
    return;
  }
  
  // Remove oldest 20% of entries
  const entries = Object.entries(cache);
  if (entries.length === 0) return;
  
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
  const removeCount = Math.max(Math.floor(entries.length * 0.2), 1);
  
  for (let i = 0; i < removeCount; i++) {
    if (i < entries.length) {
      delete cache[entries[i][0]];
      cacheSize--;
    }
  }
}

// Store data in the database with throttling
async function storeData(data: ApiResponse): Promise<boolean> {
  try {
    // Quick validation
    if (!data?.prices || Object.keys(data.prices).length === 0) {
      skipCount++;
      return false;
    }
    
    // Throttle updates to reduce database load
    const now = Date.now();
    if (now - lastUpdateTime < CONFIG.MIN_UPDATE_INTERVAL) {
      skipCount++;
      return false;
    }
    
    // Check if we should skip based on cache
    const cacheKey = `last_data_${data.timestamp}`;
    if (getCachedData(cacheKey)) {
      skipCount++;
      return false; // Already processed
    }
    
    // Check memory before heavy operations
    if (!checkMemoryUsage()) {
      skipCount++;
      return false;
    }

    // Get latest record for comparison
    const latestRecord = await prisma.mCX_3_Month.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { month1Price: true },
    });

    // Process first 3 prices (or fewer if not available)
    const prices = Object.entries(data.prices).slice(0, 3);
    if (prices.length === 0) {
      skipCount++;
      return false;
    }

    // Check if price change is significant
    if (latestRecord && prices.length > 0) {
      const newPrice = prices[0][1].price;
      const oldPrice = Number(latestRecord.month1Price);
      if (Math.abs(newPrice - oldPrice) < CONFIG.MIN_PRICE_CHANGE) {
        skipCount++;
        return false; // No significant change
      }
    }

    // Parse timestamp and convert to IST
    const utcTimestamp = new Date(data.timestamp);
    if (isNaN(utcTimestamp.getTime())) {
      console.error('Invalid timestamp:', data.timestamp);
      skipCount++;
      return false;
    }
    
    // Convert to IST for storage
    const istTimestamp = convertToIST(utcTimestamp);

    // Extract month data
    const month1 = prices[0] || null;
    const month2 = prices[1] || null;
    const month3 = prices[2] || null;

    const month1Data = month1 ? parseRateChange(month1[1].rate_change) : { rateChange: 0, rateChangePercent: 0 };
    const month2Data = month2 ? parseRateChange(month2[1].rate_change) : { rateChange: 0, rateChangePercent: 0 };
    const month3Data = month3 ? parseRateChange(month3[1].rate_change) : { rateChange: 0, rateChangePercent: 0 };

    // Store in database with timeout protection
    await Promise.race([
      prisma.mCX_3_Month.create({
        data: {
          timestamp: istTimestamp, // Store as IST
          month1Label: month1?.[0] || '',
          month1Price: month1?.[1]?.price || 0,
          month1RateVal: month1Data.rateChange,
          month1RatePct: month1Data.rateChangePercent,
          month2Label: month2?.[0] || '',
          month2Price: month2?.[1]?.price || 0,
          month2RateVal: month2Data.rateChange,
          month2RatePct: month2Data.rateChangePercent,
          month3Label: month3?.[0] || '',
          month3Price: month3?.[1]?.price || 0,
          month3RateVal: month3Data.rateChange,
          month3RatePct: month3Data.rateChangePercent,
          createdAt: new Date(),
        },
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('DB timeout')), CONFIG.DB_TIMEOUT)
      )
    ]);

    // Update tracking variables
    lastUpdateTime = now;
    updateCount++;
    
    // Cache success
    setCachedData(cacheKey, true);
    return true;

  } catch (error) {
    console.error('Store data error:', error);
    return false;
  }
}

// Fetch latest data using EventSource for continuous updates
let eventSource: EventSource | null = null;
let isConnecting = false;
let connectionAttempts = 0;

// Setup EventSource connection with backoff strategy
function setupEventSource() {
  if (typeof window === 'undefined' && !isConnecting) {
    isConnecting = true;
    
    try {
      // Only run on server-side
      const { EventSource } = require('eventsource');
      
      if (eventSource) {
        eventSource.close();
      }
      
      // Implement exponential backoff for reconnection attempts
      const backoffDelay = Math.min(
        CONFIG.RECONNECT_DELAY * Math.pow(1.5, connectionAttempts),
        30000 // Max 30 seconds
      );
      
      // Check memory before establishing connection
      if (!checkMemoryUsage()) {
        isConnecting = false;
        setTimeout(setupEventSource, backoffDelay);
        return;
      }
      
      eventSource = new EventSource(CONFIG.STREAM_URL, {
        // Use https if available
        https: CONFIG.STREAM_URL.startsWith('https'),
        // Set reasonable timeouts
        rejectUnauthorized: false,
        timeout: CONFIG.CONNECTION_TIMEOUT
      });
      
      if (eventSource) {
        eventSource.onopen = () => {
          console.log('EventSource connection opened');
          isConnecting = false;
          connectionAttempts = 0; // Reset on successful connection
        };
        
        eventSource.onmessage = (event: MessageEvent) => {
          try {
            // Throttle processing to reduce CPU usage
            const now = Date.now();
            if (now - lastUpdateTime < CONFIG.MIN_UPDATE_INTERVAL) {
              skipCount++;
              return; // Skip processing this update
            }
            
            const data = JSON.parse(event.data);
            
            // Convert timestamp to IST for frontend display
            if (data && data.timestamp) {
              // Create a copy to avoid modifying the original data unexpectedly
              const dataWithIST = {
                ...data,
                timestamp: formatISTDate(data.timestamp),
                original_timestamp: data.timestamp // Keep original for reference
              };
              latestData = dataWithIST;
            } else {
              latestData = data;
            }
            
            // Store data in background (original UTC data, conversion happens in storeData)
            storeData(data).catch(err => {
              console.error('Background store error:', err);
            });
          } catch (error) {
            console.error('Error processing event data:', error);
          }
        };
        
        eventSource.onerror = (error: any) => {
          console.error('EventSource error:', error);
          
          // Close and reconnect with backoff
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          
          connectionAttempts++;
          isConnecting = false;
          
          const backoffDelay = Math.min(
            CONFIG.RECONNECT_DELAY * Math.pow(1.5, connectionAttempts),
            30000 // Max 30 seconds
          );
          
          console.log(`Reconnecting in ${Math.round(backoffDelay/1000)}s (attempt ${connectionAttempts})`);
          setTimeout(setupEventSource, backoffDelay);
        };
      }
    } catch (error) {
      console.error('Error setting up EventSource:', error);
      connectionAttempts++;
      isConnecting = false;
      
      const backoffDelay = Math.min(
        CONFIG.RECONNECT_DELAY * Math.pow(1.5, connectionAttempts),
        30000 // Max 30 seconds
      );
      
      setTimeout(setupEventSource, backoffDelay);
    }
  }
}

// Initialize EventSource connection when module is loaded
// But only if not in test environment and not disabled
const DISABLE_STREAMING = process.env.DISABLE_MCX_STREAMING === 'true';
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test' && !DISABLE_STREAMING) {
  // Delay initial connection to prevent startup resource spikes
  setTimeout(setupEventSource, 5000);
}

// Cleanup function for database connections
async function quickDeduplication(): Promise<number> {
  try {
    // Simple deletion of obvious duplicates
    const result = await prisma.$executeRaw`
      DELETE FROM "MCX_3_Month" 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM "MCX_3_Month" 
        GROUP BY timestamp
      )
    `;
    
    return Number(result);
  } catch (error) {
    console.error('Deduplication error:', error);
    return 0;
  }
}

// Main API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();
  
  try {
    // Get client IP
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown';

    // Rate limiting
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded'
      });
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
    
    // Check memory usage
    checkMemoryUsage();

    // Handle special operations
    if (req.query.deduplicate === 'true') {
      const deleted = await quickDeduplication();
      return res.status(200).json({
        success: true,
        message: `Deleted ${deleted} duplicates`
      });
    }

    if (req.query.cleanup === 'true') {
      const days = Math.min(parseInt(req.query.days as string) || 7, 30);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      
      const deleted = await prisma.mCX_3_Month.deleteMany({
        where: { timestamp: { lt: cutoff } }
      });
      
      return res.status(200).json({
        success: true,
        message: `Deleted ${deleted.count} old records`
      });
    }
    
    // Check if streaming is disabled
    if (req.query.status === 'true') {
      return res.status(200).json({
        success: true,
        streaming: !DISABLE_STREAMING,
        lastUpdate: lastUpdateTime ? new Date(lastUpdateTime).toISOString() : null,
        stats: {
          updates: updateCount,
          skipped: skipCount,
          cacheSize,
          connectionAttempts
        }
      });
    }

    // Check if client wants latest data
    if (req.query.latest === 'true' && latestData) {
      return res.status(200).json({
        success: true,
        data: latestData,
        performance: {
          processTime: Date.now() - startTime
        }
      });
    }

    // Data retrieval with pagination
    const limit = Math.min(parseInt(req.query.limit as string) || 20, CONFIG.MAX_QUERY_RESULTS);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const skip = (page - 1) * limit;

    const cacheKey = `data_${limit}_${page}`;
    const cachedResponse = getCachedData(cacheKey);
    
    if (cachedResponse) {
      // Add performance header
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cachedResponse);
    }

    // Get data from database
    const data = await Promise.race([
      prisma.mCX_3_Month.findMany({
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
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
        }
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), CONFIG.DB_TIMEOUT)
      )
    ]);

    // Format timestamps for frontend display
    const formattedData = data.map(record => ({
      ...record,
      // Format the timestamp for display - already in IST from database
      displayTimestamp: formatISTDate(record.timestamp)
    }));

    // Prepare response
    const response = {
      success: true,
      data: formattedData,
      // Only include latest data if explicitly requested to reduce payload size
      latestData: req.query.includeLatest === 'true' ? latestData : undefined,
      pagination: {
        page,
        limit,
        hasMore: data.length === limit
      },
      performance: {
        processTime: Date.now() - startTime,
        cached: false
      }
    };

    // Cache response
    setCachedData(cacheKey, response);
    
    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Cache', 'MISS');
    
    return res.status(200).json(response);

  } catch (error) {
    console.error('Handler error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Service temporarily unavailable'
    });
  }
}

// Cleanup on process exit
process.on('SIGTERM', () => {
  if (eventSource) {
    eventSource.close();
  }
  prisma.$disconnect().catch(() => {});
});

process.on('beforeExit', () => {
  if (eventSource) {
    eventSource.close();
  }
  prisma.$disconnect().catch(() => {});
});