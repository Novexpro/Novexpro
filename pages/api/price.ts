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
});

// Resource Control Configuration
const CONFIG = {
  // API endpoint
  STREAM_URL: 'http://148.135.138.22:5004/stream',
  
  // Rate limiting
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_IP: 20,
  
  // Database settings
  DB_TIMEOUT: 3000, // 3 seconds
  MAX_QUERY_RESULTS: 50,
  
  // Caching
  CACHE_TTL: 60000, // 60 seconds
  MAX_CACHE_ITEMS: 100,
  
  // Data processing
  MIN_PRICE_CHANGE: 0.05,
  
  // Connection settings
  CONNECTION_TIMEOUT: 5000,
  RECONNECT_DELAY: 5000,
  
  // Resource throttling
  MIN_UPDATE_INTERVAL: 10000, // 10 seconds between updates
  
  // Memory management
  MEMORY_CHECK_INTERVAL: 60000, // 1 minute
  MAX_MEMORY_USAGE_MB: 200,
  
  // Time zone settings
  TIMEZONE_OFFSET: 330, // IST offset in minutes (UTC+5:30)
  
  // Database batch processing
  BATCH_SIZE: 20,
  
  // Database cleanup
  CLEANUP_INTERVAL: 86400000, // 24 hours
  DEFAULT_RETENTION_DAYS: 30,
};

// Type definitions
interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
  timeSpan: string;
  error?: string;
  isCached?: boolean;
  isFallback?: boolean;
  fromDatabase?: boolean;
}

// Cache management with size limit
const cache: Record<string, { data: any; timestamp: number }> = {};
let cacheSize = 0;

// Rate limiting
const ipRequestCounts: Record<string, { count: number; windowStart: number }> = {};

// Latest data storage
let latestData: PriceData | null = null;
let lastUpdateTime = 0;

// Resource monitoring
let lastMemoryCheck = Date.now();
let lastResourceLog = Date.now();
let lastCleanupTime = Date.now();
let updateCount = 0;
let skipCount = 0;
let connectionAttempts = 0;
let errorCount = 0;

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

// Helper function to parse rate change string
function parseRateChange(rateChangeStr: string): { rateChange: number; rateChangePercent: number } {
  try {
    console.log('Parsing rate change string:', rateChangeStr);
    
    if (!rateChangeStr || typeof rateChangeStr !== 'string') {
      console.warn('Invalid rate change string:', rateChangeStr);
      return { rateChange: 0, rateChangePercent: 0 };
    }
    
    // Try first format: "+2.60 ((+0.10%))"
    let match = rateChangeStr.match(/^([-+]?\d+\.?\d*)\s*\(\(([-+]?\d+\.?\d*)%\)\)$/);
    
    if (!match) {
      // Try alternate format: "+2.60 (+0.10%)"
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
  } catch (error) {
    console.error('Error parsing rate change:', error);
    return { rateChange: 0, rateChangePercent: 0 };
  }
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
    console.log(`Resource stats - Updates: ${updateCount}, Skipped: ${skipCount}, Cache size: ${cacheSize}, Errors: ${errorCount}`);
    updateCount = 0;
    skipCount = 0;
    errorCount = 0;
  }
  
  // Clean up rate limiting data
  const cutoff = now - CONFIG.RATE_LIMIT_WINDOW;
  Object.keys(ipRequestCounts).forEach(ip => {
    if (ipRequestCounts[ip].windowStart < cutoff) {
      delete ipRequestCounts[ip];
    }
  });
  
  // Periodic database cleanup
  if (now - lastCleanupTime > CONFIG.CLEANUP_INTERVAL) {
    lastCleanupTime = now;
    cleanupOldRecords().catch(err => {
      console.error('Cleanup error:', err);
    });
  }
  
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

// Clean up old database records
async function cleanupOldRecords(): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CONFIG.DEFAULT_RETENTION_DAYS);
    
    const result = await prisma.lME_3Month.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });
    
    console.log(`Cleaned up ${result.count} old records older than ${CONFIG.DEFAULT_RETENTION_DAYS} days`);
    return result.count;
  } catch (error) {
    console.error('Error cleaning up old records:', error);
    return 0;
  }
}

// Store data in the database with throttling
async function storeData(data: any): Promise<boolean> {
  try {
    // Quick validation
    if (!data || !data.Value || !data.Timestamp || !data['Rate of Change']) {
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
    const cacheKey = `last_data_${data.Timestamp}`;
    if (getCachedData(cacheKey)) {
      skipCount++;
      return false; // Already processed
    }
    
    // Check memory before heavy operations
    if (!checkMemoryUsage()) {
      skipCount++;
      return false;
    }

    // Parse the data
    const price = parseFloat(data.Value.replace(/,/g, ''));
    const rateChangeData = parseRateChange(data['Rate of Change']);
    
    // Validate parsed data
    if (isNaN(price)) {
      console.error('Invalid price value:', data.Value);
      skipCount++;
      return false;
    }
    
    // Get latest record for comparison
    const latestRecord = await Promise.race([
      prisma.lME_3Month.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { value: true },
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('DB timeout')), CONFIG.DB_TIMEOUT)
      )
    ]);

    // Check if price change is significant
    if (latestRecord) {
      const oldPrice = Number(latestRecord.value);
      if (Math.abs(price - oldPrice) < CONFIG.MIN_PRICE_CHANGE) {
        skipCount++;
        return false; // No significant change
      }
    }

    // Parse timestamp and convert to IST
    let timestamp: Date;
    try {
      timestamp = new Date(data.Timestamp);
      if (isNaN(timestamp.getTime())) {
        console.error('Invalid timestamp:', data.Timestamp);
        skipCount++;
        return false;
      }
    } catch (error) {
      console.error('Error parsing timestamp:', error);
      skipCount++;
      return false;
    }
    
    // Check for duplicate records with similar timestamp and value
    const existingRecord = await Promise.race([
      prisma.lME_3Month.findFirst({
        where: {
          timestamp: {
            // Use a small time window (5 minutes) to avoid duplicates due to slight timestamp differences
            gte: new Date(timestamp.getTime() - 5 * 60 * 1000), // 5 minutes before
            lte: new Date(timestamp.getTime() + 5 * 60 * 1000), // 5 minutes after
          },
          // Also check if the value is very similar to avoid duplicates with slightly different values
          value: {
            gte: price - 0.001,
            lte: price + 0.001,
          }
        },
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('DB timeout')), CONFIG.DB_TIMEOUT)
      )
    ]);
    
    if (existingRecord) {
      console.log('Duplicate record found, skipping database insert');
      skipCount++;
      return false;
    }
    
    // Store in database with timeout protection
    await Promise.race([
      prisma.lME_3Month.create({
        data: {
          rateOfChange: String(rateChangeData.rateChange),
          percentage: rateChangeData.rateChangePercent,
          timeSpan: data['Time span'],
          timestamp: timestamp,
          value: price
        }
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
    errorCount++;
    return false;
  }
}

// Process the raw data from stream
function processStreamData(rawData: any): PriceData {
  try {
    // Parse the price and rate change
    const price = parseFloat(rawData.Value.replace(/,/g, ''));
    const rateChangeData = parseRateChange(rawData['Rate of Change']);
    
    // Create the processed data object
    const processedData: PriceData = {
      price: price,
      change: rateChangeData.rateChange,
      changePercent: rateChangeData.rateChangePercent,
      timestamp: rawData.Timestamp,
      timeSpan: rawData['Time span']
    };
    
    return processedData;
  } catch (error) {
    console.error('Error processing stream data:', error);
    errorCount++;
    return {
      price: 0,
      change: 0,
      changePercent: 0,
      timestamp: new Date().toISOString(),
      timeSpan: "",
      error: 'Data processing error'
    };
  }
}

// Fetch latest data using EventSource for continuous updates
let eventSource: any = null;
let isConnecting = false;

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
      
      console.log(`Connecting to LME 3-month stream: ${CONFIG.STREAM_URL}`);
      
      eventSource = new EventSource(CONFIG.STREAM_URL, {
        // Use https if available
        https: CONFIG.STREAM_URL.startsWith('https'),
        // Set reasonable timeouts
        rejectUnauthorized: false,
        timeout: CONFIG.CONNECTION_TIMEOUT
      });
      
      if (eventSource) {
        eventSource.onopen = () => {
          console.log('LME 3-month EventSource connection opened');
          isConnecting = false;
          connectionAttempts = 0; // Reset on successful connection
        };
        
        eventSource.onmessage = (event: any) => {
          try {
            // Throttle processing to reduce CPU usage
            const now = Date.now();
            if (now - lastUpdateTime < CONFIG.MIN_UPDATE_INTERVAL) {
              skipCount++;
              return; // Skip processing this update
            }
            
            let rawData;
            try {
              rawData = JSON.parse(event.data);
            } catch (parseError) {
              console.error('Error parsing stream data:', parseError);
              errorCount++;
              return;
            }
            
            console.log('Received LME 3-month data:', rawData);
            
            // Validate the data
            if (!rawData || !rawData.Value || !rawData.Timestamp) {
              console.error('Invalid data format received:', rawData);
              errorCount++;
              return;
            }
            
            // Process the data
            const processedData = processStreamData(rawData);
            
            // Update latest data
            latestData = processedData;
            
            // Store raw data in background
            storeData(rawData).catch(err => {
              console.error('Background store error:', err);
              errorCount++;
            });
          } catch (error) {
            console.error('Error processing LME 3-month event data:', error);
            errorCount++;
          }
        };
        
        eventSource.onerror = (error: any) => {
          console.error('LME 3-month EventSource error:', error);
          errorCount++;
          
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
          
          console.log(`Reconnecting LME 3-month in ${Math.round(backoffDelay/1000)}s (attempt ${connectionAttempts})`);
          setTimeout(setupEventSource, backoffDelay);
        };
      }
    } catch (error) {
      console.error('Error setting up LME 3-month EventSource:', error);
      errorCount++;
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
const DISABLE_STREAMING = process.env.DISABLE_LME_STREAMING === 'true';
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test' && !DISABLE_STREAMING) {
  // Delay initial connection to prevent startup resource spikes
  setTimeout(setupEventSource, 5000);
}

// Quick deduplication function
async function quickDeduplication(): Promise<number> {
  try {
    // Simple deletion of obvious duplicates
    const result = await prisma.$executeRaw`
      DELETE FROM "LME_3Month" 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM "LME_3Month" 
        GROUP BY timestamp
      )
    `;
    
    return Number(result);
  } catch (error) {
    console.error('Deduplication error:', error);
    return 0;
  }
}

// Fallback data if needed
const fallbackData: PriceData = {
  price: 2383.15,
  change: -5.45,
  changePercent: -0.23,
  timestamp: new Date().toISOString(),
  timeSpan: "Today",
  isFallback: true,
  error: 'Using fallback data due to API error'
};

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
      const days = Math.min(parseInt(req.query.days as string) || CONFIG.DEFAULT_RETENTION_DAYS, 90);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      
      const deleted = await prisma.lME_3Month.deleteMany({
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
          connectionAttempts,
          errors: errorCount
        }
      });
    }

    // Check if client wants latest data
    if (req.query.latest === 'true') {
      if (latestData) {
        return res.status(200).json({
          success: true,
          ...latestData,
          performance: {
            processTime: Date.now() - startTime
          }
        });
      } else {
        // If no latest data is available, fetch from database
        const latestRecord = await Promise.race([
          prisma.lME_3Month.findFirst({
            orderBy: { timestamp: 'desc' }
          }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), CONFIG.DB_TIMEOUT)
          )
        ]);
        
        if (latestRecord) {
          const data = {
            price: Number(latestRecord.value),
            change: parseFloat(latestRecord.rateOfChange),
            changePercent: latestRecord.percentage,
            timestamp: formatISTDate(latestRecord.timestamp),
            timeSpan: latestRecord.timeSpan || "Today",
            fromDatabase: true
          };
          
          return res.status(200).json(data);
        }
      }
    }

    // Handle pagination for historical data
    if (req.query.history === 'true') {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, CONFIG.MAX_QUERY_RESULTS);
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const skip = (page - 1) * limit;
      
      const cacheKey = `history_${limit}_${page}`;
      const cachedResponse = getCachedData(cacheKey);
      
      if (cachedResponse) {
        // Add performance header
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cachedResponse);
      }
      
      // Get data from database
      const data = await Promise.race([
        prisma.lME_3Month.findMany({
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            timestamp: true,
            value: true,
            rateOfChange: true,
            percentage: true,
            timeSpan: true
          }
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), CONFIG.DB_TIMEOUT)
        )
      ]);
      
      // Format timestamps for frontend display
      const formattedData = data.map(record => ({
        id: record.id,
        price: Number(record.value),
        change: parseFloat(record.rateOfChange),
        changePercent: record.percentage,
        timestamp: formatISTDate(record.timestamp),
        timeSpan: record.timeSpan || "N/A",
        displayDate: new Date(record.timestamp).toLocaleDateString('en-GB')
      }));
      
      // Prepare response
      const response = {
        success: true,
        data: formattedData,
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
    }

    // If we have latest data from stream, return it
    if (latestData) {
      return res.status(200).json(latestData);
    }
    
    // Otherwise, get the latest from the database
    const dbData = await Promise.race([
      prisma.lME_3Month.findFirst({
        orderBy: { timestamp: 'desc' }
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), CONFIG.DB_TIMEOUT)
      )
    ]);
    
    if (dbData) {
      const data = {
        price: Number(dbData.value),
        change: parseFloat(dbData.rateOfChange),
        changePercent: dbData.percentage,
        timestamp: formatISTDate(dbData.timestamp),
        timeSpan: dbData.timeSpan || "Today"
      };
      
      return res.status(200).json(data);
    }
    
    // If no data available, use fallback
    return res.status(200).json(fallbackData);
    
  } catch (error) {
    console.error('Handler error:', error);
    errorCount++;
    
    // If we have latest data, return it even if there's an error
    if (latestData) {
      return res.status(200).json({
        ...latestData,
        isCached: true,
        error: 'Using cached data due to API error'
      });
    }
    
    // Return fallback data
    return res.status(200).json(fallbackData);
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
