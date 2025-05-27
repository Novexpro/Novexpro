import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

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
  
  // Return null if the value is exactly zero to avoid storing zero values
  // This helps prevent storing meaningless data
  return rounded === 0 ? null : rounded;
}

/**
 * Checks for existing records with the same values to prevent duplicates
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
    
    // Check for any existing record with exactly the same values (no time constraint)
    // Simplified approach - only check for exact matches on non-null values
    const whereConditions: any[] = [];
    
    if (normalizedSpotPrice !== null) {
      whereConditions.push({
        spotPrice: {
          equals: new Prisma.Decimal(normalizedSpotPrice)
        }
      });
    }
    
    if (normalizedChange !== null) {
      whereConditions.push({
        change: {
          equals: new Prisma.Decimal(normalizedChange)
        }
      });
    }
    
    if (normalizedChangePercent !== null) {
      whereConditions.push({
        changePercent: {
          equals: new Prisma.Decimal(normalizedChangePercent)
        }
      });
    }
    
    // If we don't have any conditions, return null early
    if (whereConditions.length === 0) {
      console.log('No valid conditions for database search');
      return null;
    }
    
    const existingRecord = await prisma.metalPrice.findFirst({
      where: {
        OR: whereConditions
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (existingRecord) {
      console.log('Found existing record with same values:', existingRecord.id);
      return existingRecord as MetalPriceRecord;
    }
    
    console.log('No duplicate records found');
    return null;
  } catch (error) {
    console.error('Error checking for existing records:', error);
    return null;
  }
}

/**
 * Creates a new price record in the database
 */
async function createNewRecord(spotPrice: number | null | undefined, change: number | null | undefined, changePercent: number | null | undefined): Promise<MetalPriceRecord> {
  try {
    const normalizedSpotPrice = normalizeValue(spotPrice);
    const normalizedChange = normalizeValue(change);
    const normalizedChangePercent = normalizeValue(changePercent);
    
    // Validate that we have at least some non-null values
    if (normalizedSpotPrice === null && normalizedChange === null && normalizedChangePercent === null) {
      throw new Error('Cannot create record with all null values');
    }
    
    console.log('Creating new record with values:', {
      spotPrice: normalizedSpotPrice,
      change: normalizedChange,
      changePercent: normalizedChangePercent
    });
    
    // Prepare data object with only defined values
    const data: any = {
      createdAt: new Date(),
      source: 'metal-price'
    };
    
    // Only add non-null values
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
    
    console.log(`Successfully created new record with ID: ${newRecord.id}`);
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
  console.log(`API request received: ${req.method} ${req.url}`);
  
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
    
    // Check for existing records to prevent duplicates
    const existingRecord = await findExistingRecord(spotPrice, change, changePercent);
    
    if (existingRecord) {
      console.log('Using existing record instead of creating duplicate');
      return res.status(200).json({
        success: true,
        message: 'Data already exists in database, returning existing record',
        data: {
          spotPrice: Number(existingRecord.spotPrice?.toNumber() || 0),
          change: Number(existingRecord.change?.toNumber() || 0),
          changePercent: Number(existingRecord.changePercent?.toNumber() || 0),
          lastUpdated: existingRecord.createdAt.toISOString(),
          isExisting: true
        }
      });
    }
    
    // Create new record
    const newRecord = await createNewRecord(spotPrice, change, changePercent);
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Data fetched from API and saved to database',
      data: {
        spotPrice: Number(newRecord.spotPrice?.toNumber() || 0),
        change: Number(newRecord.change?.toNumber() || 0),
        changePercent: Number(newRecord.changePercent?.toNumber() || 0),
        lastUpdated: newRecord.createdAt.toISOString(),
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