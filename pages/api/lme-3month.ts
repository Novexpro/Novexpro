import { NextApiRequest, NextApiResponse } from 'next';
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
const CACHE_DURATION = 120000; // Increase to 2 minutes (120 seconds)

// Rate limiting
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute
const requestLog: number[] = [];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API request received for /api/lme-3month');
  
  // Apply rate limiting
  const now = Date.now();
  
  // Clean up old requests from the log
  const cutoff = now - RATE_LIMIT_WINDOW;
  while (requestLog.length > 0 && requestLog[0] < cutoff) {
    requestLog.shift();
  }
  
  // Check if rate limit is exceeded
  if (requestLog.length >= MAX_REQUESTS_PER_WINDOW) {
    console.log(`Rate limit exceeded: ${requestLog.length} requests in the last minute`);
    return res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
      error: 'RATE_LIMIT_EXCEEDED'
    });
  }
  
  // Add current request to log
  requestLog.push(now);
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check if we have cached data that's still valid
    if (cachedData && (now - lastFetchTime) < CACHE_DURATION) {
      console.log('Returning cached data');
      return res.status(200).json(cachedData);
    }

    console.log('Cache expired or not available, fetching from database');
    const prisma = new PrismaClient();
    
    // Get the latest record from the database
    const latestRecord = await prisma.lME_3Month.findFirst({
      orderBy: {
        timestamp: 'desc'
      }
    });
    
    // Get the previous record to calculate change
    const previousRecord = await prisma.lME_3Month.findFirst({
      where: {
        timestamp: {
          lt: latestRecord?.timestamp || new Date()
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });
    
    await prisma.$disconnect();
    
    if (!latestRecord) {
      throw new Error('No data found in database');
    }
    
    // Calculate change and change percent
    let change = 0;
    let changePercent = 0;
    
    if (previousRecord) {
      change = latestRecord.value - previousRecord.value;
      changePercent = previousRecord.value !== 0 
        ? (change / previousRecord.value) * 100 
        : 0;
    } else {
      // If no previous record, use the stored rate of change
      change = parseFloat(latestRecord.rateOfChange);
      changePercent = latestRecord.percentage;
    }
    
    const priceData: PriceData = {
      price: latestRecord.value,
      change: change,
      changePercent: changePercent,
      timestamp: latestRecord.timestamp.toISOString(),
      timeSpan: latestRecord.timeSpan
    };
    
    // Update cache
    cachedData = priceData;
    lastFetchTime = now;
    
    console.log('Successfully fetched and cached new data from database');
    
    // Return the data
    return res.status(200).json(priceData);
    
  } catch (error) {
    console.error('Error fetching LME 3-month data:', error);
    
    // If we have cached data, return it even if there's an error
    if (cachedData) {
      console.log('Returning cached data due to error');
      return res.status(200).json({
        ...cachedData,
        isCached: true,
        error: 'Using cached data due to database error'
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
      error: 'Using fallback data due to database error'
    };

    // Return fallback data
    return res.status(200).json(fallbackData);
  }
} 