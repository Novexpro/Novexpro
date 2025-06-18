import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

interface SpotPriceData {
  spotPrice: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  threeMonthPrice?: number;
}

// Cache the last successful response
let cachedData: SpotPriceData | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 120000; // Increase to 2 minutes (120 seconds)

// Rate limiting
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 60 requests per minute
const requestLog: number[] = [];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API request received for /api/lme-spot');
  
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
      return res.status(200).json({
        success: true,
        message: 'Spot price data retrieved from cache',
        data: cachedData
      });
    }

    console.log('Cache expired or not available, fetching from database');
    const prisma = new PrismaClient();
    
    // Get the latest record from the database with source='spot-price-update'
    const latestRecord = await prisma.metalPrice.findFirst({
      where: {
        source: 'spot-price-update'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // If no record with source='spot-price-update', try any source
    if (!latestRecord) {
      const anyRecord = await prisma.metalPrice.findFirst({
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      if (!anyRecord) {
        throw new Error('No spot price data found in database');
      }
    }
    
    // Get the latest LME 3-month price for reference
    const latestLME3Month = await prisma.lME_3Month.findFirst({
      orderBy: {
        timestamp: 'desc'
      }
    });
    
    await prisma.$disconnect();
    
    const record = latestRecord || await prisma.metalPrice.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (!record) {
      throw new Error('No spot price data found in database');
    }
    
    // Format the response data
    const spotPriceData: SpotPriceData = {
      spotPrice: Number(record.spotPrice),
      change: Number(record.change),
      changePercent: Number(record.changePercent),
      lastUpdated: record.createdAt.toISOString(),
      threeMonthPrice: latestLME3Month ? latestLME3Month.value : undefined
    };
    
    // Update cache
    cachedData = spotPriceData;
    lastFetchTime = now;
    
    console.log('Successfully fetched and cached new data from database');
    
    // Return the data
    return res.status(200).json({
      success: true,
      message: 'Spot price data retrieved successfully',
      data: spotPriceData
    });
    
  } catch (error) {
    console.error('Error fetching LME spot price data:', error);
    
    // If we have cached data, return it even if there's an error
    if (cachedData) {
      console.log('Returning cached data due to error');
      return res.status(200).json({
        success: true,
        message: 'Using cached data due to database error',
        data: {
          ...cachedData,
          isCached: true
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // If no cached data, use fallback data
    console.log('Using fallback data');
    const fallbackData = {
      spotPrice: 2377.70,
      change: -5.45,
      changePercent: -0.23,
      lastUpdated: new Date().toISOString()
    };

    // Return fallback data
    return res.status(200).json({
      success: true,
      message: 'Using fallback data due to database error',
      data: {
        ...fallbackData,
        isFallback: true
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 