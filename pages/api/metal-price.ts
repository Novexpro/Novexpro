import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration for time restrictions
const OPERATING_HOURS = {
  START_HOUR: 6, // 6 AM
  END_HOUR: 24,  // 11:59 PM (23:59 hours, using 24 to include up to 23:59)  
  TIMEZONE: 'Asia/Kolkata'
};

// Helper function to check if current time is within operating hours
function isWithinOperatingHours() {
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: OPERATING_HOURS.TIMEZONE }));
  
  const currentHour = istTime.getHours();
  const currentDay = istTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Check if it's weekend (Saturday = 6, Sunday = 0)
  if (currentDay === 0 || currentDay === 6) {
    return {
      allowed: false,
      reason: `Weekend (${currentDay === 0 ? 'Sunday' : 'Saturday'})`,
      currentTime: istTime.toISOString()
    };
  }
  
  // Check if within operating hours (6 AM to 11:59 PM on weekdays)
  if (currentHour < OPERATING_HOURS.START_HOUR || currentHour >= OPERATING_HOURS.END_HOUR) {
    return {
      allowed: false,
      reason: `Outside operating hours (${currentHour}:00 IST)`,
      currentTime: istTime.toISOString()
    };
  }
  
  return {
    allowed: true,
    reason: `Within operating hours (${currentHour}:00 IST)`,
    currentTime: istTime.toISOString()
  };
}

// Response interface for properly typed API responses
interface ApiResponse {
  success: boolean;
  message: string;
  data?: {
    spotPrice: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
    isExisting?: boolean;
  };
  error?: string;
}

// Interface for external API response data
interface ExternalApiData {
  spot_price?: number | null;
  price_change?: number;
  change_percentage?: number;
  last_updated?: string;
}

// Interface for database record
interface MetalPriceRecord {
  id: string;
  spotPrice: Prisma.Decimal | null;
  change: Prisma.Decimal | null;
  changePercent: Prisma.Decimal | null;
  createdAt: Date;
  source: string | null;
}

/**
 * Gets current time in IST (Indian Standard Time)
 */
function getCurrentISTTime(): Date {
  const now = new Date();
  // IST is UTC + 5:30
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istTime = new Date(now.getTime() + istOffset);
  return istTime;
}

/**
 * Converts a Date to IST and returns ISO string
 */
function toISTString(date: Date): string {
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istTime = new Date(date.getTime() + istOffset);
  return istTime.toISOString();
}

/**
 * Fetches metal price data from the external API
 */
async function fetchExternalPriceData(): Promise<ExternalApiData> {
  try {
    // Use the correct external API URL
    const backendUrl = process.env.BACKEND_URL || 'http://148.135.138.22:3232';
    const apiEndpoint = `${backendUrl}/api/price-data`;
    
    console.log(`Fetching data from external API: ${apiEndpoint}`);
    
    // Add timeout to avoid hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    const response = await fetch(apiEndpoint, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`External API returned status ${response.status}`);
    }
  
    const responseText = await response.text();
    const data = JSON.parse(responseText);
    
    console.log('Successfully fetched external API data');
    return data;
  } catch (error) {
    console.error('Error fetching from external API:', error);
    return {};
  }
}

/**
 * Processes the external API data into a consistent format
 */
function processExternalData(externalData: ExternalApiData) {
  // Log the raw API response to see exactly what we're getting
  console.log('Raw API response:', JSON.stringify(externalData));
  
  // Safety check - if we got null/undefined, use an empty object
  if (!externalData) {
    console.error('Received null/undefined external data');
    externalData = {};
  }
  
  // Extract values from API response WITHOUT any defaults
  // Keep the exact values that come from the API
  const spotPrice = externalData.spot_price;
  const change = externalData.price_change;
  const changePercent = externalData.change_percentage;
  const lastUpdated = externalData.last_updated;
  
  console.log(`Processed data (exact from API): spotPrice=${spotPrice}, change=${change}, changePercent=${changePercent}`);
  
  return {
    spotPrice,
    change,
    changePercent,
    lastUpdated
  };
}

/**
 * Converts values to standardized numbers for comparison
 * Modified to allow zero values
 */
function normalizeValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  if (isNaN(num)) {
    return null;
  }
  
  // Round to 2 decimal places
  const rounded = Math.round(num * 100) / 100;
  
  // Allow zero values - they are valid price data
  return rounded;
}

/**
 * Checks for existing records with the same values within a time window to prevent duplicates
 * Modified to only check for duplicates within the last 24 hours
 */
async function findExistingRecord(spotPrice: number | null | undefined, change: number | null | undefined, changePercent: number | null | undefined): Promise<MetalPriceRecord | null> {
  try {
    // Normalize values for comparison
    const normalizedSpotPrice = normalizeValue(spotPrice);
    const normalizedChange = normalizeValue(change);
    const normalizedChangePercent = normalizeValue(changePercent);
    
    console.log('Checking for duplicates with normalized values:', {
      spotPrice: normalizedSpotPrice,
      change: normalizedChange,
      changePercent: normalizedChangePercent
    });
    
    // Only check for duplicates within the last 24 hours (or 1 hour for more frequent updates)
    const timeWindow = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    // Alternative: Use 1 hour window: const timeWindow = 60 * 60 * 1000; // 1 hour in milliseconds
    
    const cutoffTime = new Date(Date.now() - timeWindow);
    console.log(`Checking for duplicates since: ${cutoffTime.toISOString()}`);
    
    // Build WHERE conditions for exact matches within time window
    const whereConditions: any = {
      createdAt: {
        gte: cutoffTime // Only check records created after the cutoff time
      }
    };
    
    // Check for records with the same spot price (including zero)
    if (normalizedSpotPrice !== null) {
      whereConditions.spotPrice = {
        equals: new Prisma.Decimal(normalizedSpotPrice)
      };
    } else {
      whereConditions.spotPrice = null;
    }
    
    // Check for records with the same change (including zero)
    if (normalizedChange !== null) {
      whereConditions.change = {
        equals: new Prisma.Decimal(normalizedChange)
      };
    } else {
      whereConditions.change = null;
    }
    
    // Check for records with the same change percent (including zero)
    if (normalizedChangePercent !== null) {
      whereConditions.changePercent = {
        equals: new Prisma.Decimal(normalizedChangePercent)
      };
    } else {
      whereConditions.changePercent = null;
    }
    
    const existingRecord = await prisma.metalPrice.findFirst({
      where: whereConditions,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (existingRecord) {
      console.log(`Found existing record with same values within ${timeWindow / (60 * 60 * 1000)} hours:`, existingRecord.id);
      return existingRecord as MetalPriceRecord;
    }
    
    console.log(`No duplicate records found within the last ${timeWindow / (60 * 60 * 1000)} hours`);
    return null;
  } catch (error) {
    console.error('Error checking for existing records:', error);
    return null;
  }
}

/**
 * Creates a new price record in the database with IST timestamp
 * Modified to allow zero values and use IST time
 */
async function createNewRecord(spotPrice: number | null | undefined, change: number | null | undefined, changePercent: number | null | undefined): Promise<MetalPriceRecord> {
  try {
    const normalizedSpotPrice = normalizeValue(spotPrice);
    const normalizedChange = normalizeValue(change);
    const normalizedChangePercent = normalizeValue(changePercent);
    
    // Only validate that we have at least some defined values (not all null/undefined)
    if (normalizedSpotPrice === null && normalizedChange === null && normalizedChangePercent === null) {
      throw new Error('Cannot create record with all null values');
    }
    
    // Get current IST time
    const istTime = getCurrentISTTime();
    console.log(`Creating new record with IST time: ${istTime.toISOString()}`);
    
    console.log('Creating new record with values:', {
      spotPrice: normalizedSpotPrice,
      change: normalizedChange,
      changePercent: normalizedChangePercent,
      createdAt: istTime.toISOString()
    });
    
    // Prepare data object
    const data: any = {
      createdAt: istTime, // Use IST time instead of new Date()
      source: 'metal-price'
    };
    
    // Add all non-null values (including zeros)
    if (normalizedSpotPrice !== null) {
      data.spotPrice = new Prisma.Decimal(normalizedSpotPrice);
    }
    
    if (normalizedChange !== null) {
      data.change = new Prisma.Decimal(normalizedChange);
    }
    
    if (normalizedChangePercent !== null) {
      data.changePercent = new Prisma.Decimal(normalizedChangePercent);
    }
    
    const newRecord = await prisma.metalPrice.create({
      data
    });
    
    console.log(`Successfully created new record with ID: ${newRecord.id} at IST time: ${newRecord.createdAt.toISOString()}`);
    return newRecord as MetalPriceRecord;
  } catch (error) {
    console.error('Error creating new record:', error);
    throw error;
  }
}

/**
 * API handler that fetches data from the external API and stores it in the database
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Check operating hours first
  const timeCheck = isWithinOperatingHours();
  
  if (!timeCheck.allowed) {
    console.log(`🚫 Metal-price request blocked: ${timeCheck.reason}`);
    return res.status(200).json({
      success: false,
      message: `Data fetching restricted: ${timeCheck.reason}`,
      error: `Operating hours: Monday-Friday, 6:00 AM - 11:59 PM IST. Current: ${timeCheck.reason}`
    });
  }

  console.log(`API request received: ${req.method} ${req.url} at IST: ${getCurrentISTTime().toISOString()}`);
  
  // Set cache control headers to prevent browser caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  try {
    // Fetch data from external API
    const externalData = await fetchExternalPriceData();
    console.log('External API data:', externalData);
    
    // Process the data
    const { spotPrice, change, changePercent, lastUpdated } = processExternalData(externalData);
    console.log('Processed data:', { spotPrice, change, changePercent, lastUpdated });
    
    // Check if we have valid data (not all null/undefined)
    if (spotPrice === null && change === null && changePercent === null) {
      return res.status(400).json({
        success: false,
        message: 'Failed to retrieve valid data from external API'
      });
    }
    
    // Check for existing records within time window to prevent recent duplicates
    const existingRecord = await findExistingRecord(spotPrice, change, changePercent);
    
    if (existingRecord) {
      console.log('Using existing record instead of creating duplicate within time window');
      return res.status(200).json({
        success: true,
        message: 'Data already exists in database within time window, returning existing record',
        data: {
          spotPrice: Number(existingRecord.spotPrice?.toNumber() || 0),
          change: Number(existingRecord.change?.toNumber() || 0),
          changePercent: Number(existingRecord.changePercent?.toNumber() || 0),
          lastUpdated: toISTString(existingRecord.createdAt), // Convert to IST for response
          isExisting: true
        }
      });
    }
    
    // Create new record with IST timestamp
    const newRecord = await createNewRecord(spotPrice, change, changePercent);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Data fetched from API and saved to database with IST timestamp',
      data: {
        spotPrice: Number(newRecord.spotPrice?.toNumber() || 0),
        change: Number(newRecord.change?.toNumber() || 0),
        changePercent: Number(newRecord.changePercent?.toNumber() || 0),
        lastUpdated: toISTString(newRecord.createdAt), // Convert to IST for response
        isExisting: false
      }
    });
    
  } catch (error) {
    console.error('Error in API handler:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process request',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
}
