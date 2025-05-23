import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

// Use type assertion to ensure TypeScript recognizes the getquote model
const prisma = new PrismaClient() as PrismaClient & {
  getquote: {
    findFirst: (args: any) => Promise<{ priceChange: number } | null>,
    create: (args: { data: { stockName: string, priceChange: number, timestamp: Date } }) => Promise<any>
  }
};

// Interface for company update data from external API
interface CompanyUpdate {
  stockName: string;
  priceChange: number;
  timestamp: string;
}

// Interface for API response
interface ApiResponse {
  success: boolean;
  message: string;
  updatedCompanies?: string[];
  error?: string;
}

// Cache control headers to prevent browser caching
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// Function to fetch company updates from external API
async function fetchCompanyUpdates(): Promise<CompanyUpdate[]> {
  try {
    const apiUrl = 'http://148.135.138.22/api/company-updates';
    console.log(`Fetching company updates from: ${apiUrl}`);
    
    // Add timeout to avoid hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);
    console.log(`External API response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`External API returned status ${response.status}: ${errorText}`);
      
      // If the API returns a specific error about no updates, return empty array
      if (errorText.includes('No company updates available')) {
        return [];
      }
      
      throw new Error(`External API returned status ${response.status}: ${errorText}`);
    }
    
    // Parse the response
    const responseText = await response.text();
    console.log('Raw response from external API:', responseText.substring(0, 500)); // Log first 500 chars
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw new Error(`Failed to parse API response as JSON: ${parseError}`);
    }
    
    // Check if we have valid data
    if (!data || !Array.isArray(data)) {
      console.log('API did not return an array of company updates');
      return [];
    }
    
    console.log(`Successfully fetched ${data.length} company updates`);
    return data;
  } catch (error) {
    console.error('Error fetching company updates:', error);
    return [];
  }
}

// Function to get the latest entry for a specific company
async function getLatestCompanyEntry(stockName: string): Promise<{ priceChange: number } | null> {
  try {
    // Use the type-asserted prisma client to access getquote
    const latestEntry = await prisma.getquote.findFirst({
      where: {
        stockName: stockName
      },
      orderBy: {
        timestamp: 'desc'
      },
      select: {
        priceChange: true
      }
    });
    
    return latestEntry;
  } catch (error) {
    console.error(`Error getting latest entry for ${stockName}:`, error);
    return null;
  }
}

// Function to process and save company updates
async function processAndSaveCompanyUpdates(updates: CompanyUpdate[]): Promise<string[]> {
  const targetCompanies = ['Hindalco', 'Vedanta', 'NALCO'];
  const updatedCompanies: string[] = [];
  
  for (const update of updates) {
    // Only process updates for our target companies
    if (!targetCompanies.includes(update.stockName)) {
      continue;
    }
    
    try {
      // Get the latest entry for this company
      const latestEntry = await getLatestCompanyEntry(update.stockName);
      
      // Calculate new price change by adding the latest entry's price change to the update's price change
      const newPriceChange = latestEntry 
        ? latestEntry.priceChange + update.priceChange 
        : update.priceChange;
      
      // Create a new entry with the updated price change
      // Use the type-asserted prisma client to access getquote
      await prisma.getquote.create({
        data: {
          stockName: update.stockName,
          priceChange: newPriceChange,
          timestamp: new Date(update.timestamp || Date.now())
        }
      });
      
      console.log(`Updated ${update.stockName} with new price change: ${newPriceChange}`);
      updatedCompanies.push(update.stockName);
    } catch (error) {
      console.error(`Error processing update for ${update.stockName}:`, error);
    }
  }
  
  return updatedCompanies;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  console.log(`Company updates API request received: ${req.method} ${req.url}`);
  
  // Set cache control headers
  res.setHeader('Cache-Control', noCacheHeaders['Cache-Control']);
  res.setHeader('Pragma', noCacheHeaders['Pragma']);
  res.setHeader('Expires', noCacheHeaders['Expires']);
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed',
      error: 'Only GET requests are supported'
    });
  }
  
  try {
    // Fetch company updates from external API
    const companyUpdates = await fetchCompanyUpdates();
    
    if (companyUpdates.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No new company updates available'
      });
    }
    
    // Process and save the updates
    const updatedCompanies = await processAndSaveCompanyUpdates(companyUpdates);
    
    if (updatedCompanies.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No companies were updated'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Company updates processed successfully',
      updatedCompanies: updatedCompanies
    });
  } catch (error) {
    console.error('Error in company updates API:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
}
