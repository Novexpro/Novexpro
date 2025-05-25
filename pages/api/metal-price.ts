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
 * Saves the price data to the database
 */
async function savePriceToDatabase(spotPrice: number | null, change: number | null, changePercent: number | null) {
  try {
    // Use current date for timestamp
    const createdAt = new Date();
    
    console.log(`Saving to database - spotPrice: ${spotPrice}, change: ${change}, changePercent: ${changePercent}`);
    
    // Create a new record in the database
    const newRecord = await prisma.metalPrice.create({
      data: {
        spotPrice: spotPrice !== null ? new Prisma.Decimal(spotPrice) : new Prisma.Decimal(0),
        change: change !== null ? new Prisma.Decimal(change) : new Prisma.Decimal(0),
        changePercent: changePercent !== null ? new Prisma.Decimal(changePercent) : new Prisma.Decimal(0),
        createdAt: createdAt,
        source: 'metal-price'
      }
    });
    
    console.log(`Successfully saved to database with ID: ${newRecord.id}`);
    return newRecord;
  } catch (error) {
    console.error('Error saving to database:', error);
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
    // First, let's check the database schema to understand what fields are required
    try {
      console.log('Checking database schema...');
      const sampleRecord = await prisma.metalPrice.findFirst();
      console.log('Database schema check - sample record:', sampleRecord);
    } catch (schemaError) {
      console.error('Error checking database schema:', schemaError);
    }
    
    // Fetch data from external API
    const externalData = await fetchExternalPriceData();
    console.log('External API data:', externalData);
    
    // Process the data
    const { spotPrice, change, changePercent, lastUpdated } = processExternalData(externalData);
    console.log('Processed data:', { spotPrice, change, changePercent, lastUpdated });
    
    // Check if we have valid data
    if (spotPrice === null && change === null) {
      return res.status(400).json({
        success: false,
        message: 'Failed to retrieve valid data from external API'
      });
    }
    
    try {
      // Try to save to database with direct query to see exact error
      console.log('Attempting to save to database...');
      const createdAt = new Date();
      
      // Create a new record in the database
      // Include the required metal field that exists in the database but not in the Prisma schema
      // Store exactly what comes from the API without any defaults
      const newRecord = await prisma.$queryRaw`
        INSERT INTO "MetalPrice" ("id", "metal", "spotPrice", "change", "changePercent", "lastUpdated", "createdAt", "source")
        VALUES (
          gen_random_uuid(), 
          'aluminum', 
          ${spotPrice === undefined || spotPrice === null ? null : spotPrice}, 
          ${change === undefined ? null : change}, 
          ${changePercent === undefined ? null : changePercent}, 
          ${lastUpdated ? new Date(lastUpdated) : createdAt}, 
          ${createdAt}, 
          'metal-price'
        )
        RETURNING *
      `;
      
      console.log('Successfully saved to database with raw query:', newRecord);
      
      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Data fetched from API and saved to database',
        data: {
          spotPrice: Number(spotPrice || 0),
          change: Number(change || 0),
          changePercent: Number(changePercent || 0),
          lastUpdated: createdAt.toISOString()
        }
      });
    } catch (dbError) {
      console.error('Error saving to database with raw query:', dbError);
      
      // Return error response with detailed information
      return res.status(500).json({
        success: false,
        message: 'Failed to save data to database',
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      });
    }
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
