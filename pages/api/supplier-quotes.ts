import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

// Use type assertion to ensure TypeScript recognizes the getquote model
const prisma = new PrismaClient() as PrismaClient & {
  getquote: {
    findFirst: (args: any) => Promise<{ priceChange: number } | null>,
    findMany: (args: any) => Promise<any[]>,
    create: (args: { data: { stockName: string, priceChange: number, timestamp: Date } }) => Promise<any>
  }
};

// Interface for company update data from external API
interface CompanyUpdate {
  stockName: string;
  priceChange: number;
  timestamp: string;
}

// Interface for the external API response format
interface ExternalApiCompanyInfo {
  amount: number;
  effective_date: string;
  last_updated: string;
  sign: string;
}

// Interface for API response
interface ApiResponse {
  success: boolean;
  message?: string;
  data?: {
    [key: string]: {
      stockName: string;
      priceChange: number;
      timestamp: string;
    } | null;
  };
  updatedCompanies?: string[];
  updated?: boolean;
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
    if (!data) {
      console.log('API did not return valid data');
      return [];
    }
    
    // Convert object format to array format if needed
    let updates: CompanyUpdate[] = [];
    
    // Check if data is an object (not an array)
    if (!Array.isArray(data) && typeof data === 'object') {
      console.log('API returned object format instead of array, converting...');
      
      // Convert the object to our expected array format, but only for non-null entries
      for (const [stockName, info] of Object.entries(data)) {
        // Skip null entries
        if (!info) {
          console.log(`Skipping null entry for ${stockName}`);
          continue;
        }
        
        // Cast the info to our interface
        const companyInfo = info as ExternalApiCompanyInfo;
        
        // Extract the data from the object format
        const update: CompanyUpdate = {
          stockName,
          // Convert amount to number and apply sign
          priceChange: companyInfo.sign === '-' ? -Number(companyInfo.amount) : Number(companyInfo.amount),
          timestamp: companyInfo.last_updated || new Date().toISOString()
        };
        
        updates.push(update);
        console.log(`Processed update for ${stockName}: ${JSON.stringify(update)}`);
      }
    } else if (Array.isArray(data)) {
      // If it's already an array, filter out any null entries
      updates = data.filter(item => item !== null);
    }
    
    console.log(`Successfully processed ${updates.length} company updates`);
    return updates;
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
  
  console.log(`Processing ${updates.length} updates for companies: ${updates.map(u => u.stockName).join(', ')}`);
  
  // First, get the latest entries for all companies to compare timestamps
  const latestEntries = new Map<string, { priceChange: number, timestamp: Date | string } | null>();
  
  for (const company of targetCompanies) {
    const entry = await getLatestCompanyEntry(company);
    if (entry) {
      // Get the timestamp from the database entry
      const dbEntry = await prisma.getquote.findFirst({
        where: { stockName: company },
        orderBy: { timestamp: 'desc' },
        select: { priceChange: true, timestamp: true }
      });
      
      if (dbEntry) {
        latestEntries.set(company, {
          priceChange: entry.priceChange,
          timestamp: dbEntry.timestamp
        });
      } else {
        latestEntries.set(company, null);
      }
    } else {
      latestEntries.set(company, null);
    }
  }
  
  for (const update of updates) {
    // Only process updates for our target companies
    if (!targetCompanies.includes(update.stockName)) {
      console.log(`Skipping non-target company: ${update.stockName}`);
      continue;
    }
    
    try {
      const latestEntry = latestEntries.get(update.stockName);
      const updateTimestamp = new Date(update.timestamp || Date.now());
      
      // Check if this is actually a new update by comparing timestamps
      if (latestEntry) {
        const dbTimestamp = new Date(latestEntry.timestamp);
        
        // If the update timestamp is older or the same as what we have in the database, skip it
        if (updateTimestamp <= dbTimestamp) {
          console.log(`Skipping ${update.stockName} update as it's not newer than what's in the database`);
          console.log(`DB timestamp: ${dbTimestamp.toISOString()}, Update timestamp: ${updateTimestamp.toISOString()}`);
          continue;
        }
      }
      
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
          timestamp: updateTimestamp
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

// Function to fetch latest quotes for all companies
async function fetchLatestQuotes() {
  try {
    // Define companies with both display names and database names
    const companies = [
      { display: 'Hindalco', db: 'Hindalco' },
      { display: 'Vedanta', db: 'Vedanta' },
      { display: 'NALCO', db: 'NALCO' }
    ];
    const result: { [key: string]: any } = {};

    // Fetch the latest entry for each company
    for (const company of companies) {
      console.log(`Fetching latest entry for ${company.display} (DB name: ${company.db})`);
      const latestEntry = await prisma.getquote.findFirst({
        where: {
          stockName: company.db
        },
        orderBy: {
          timestamp: 'desc'
        },
        select: {
          stockName: true,
          priceChange: true,
          timestamp: true
        }
      });

      if (latestEntry) {
        console.log(`Found latest entry for ${company.display}:`, latestEntry);
        // Store using the display name as the key
        result[company.display] = {
          ...latestEntry,
          stockName: company.display // Ensure we use the display name in the response
        };
      } else {
        console.log(`No entry found for ${company.display}`);
        result[company.display] = null;
      }
    }

    console.log('Final quotes result:', result);
    return result;
  } catch (error) {
    console.error('Error fetching latest quotes:', error);
    throw error;
  }
}

// Function to fetch the latest data for a specific company
async function fetchCompanyQuote(company: string) {
  try {
    // No need to normalize company name anymore - use as is
    let dbCompanyName = company;
    
    console.log(`Fetching quote for company: ${company} (DB name: ${dbCompanyName})`);

    const latestEntry = await prisma.getquote.findFirst({
      where: {
        stockName: dbCompanyName
      },
      orderBy: {
        timestamp: 'desc'
      },
      select: {
        stockName: true,
        priceChange: true,
        timestamp: true
      }
    });

    if (!latestEntry) {
      console.error(`No data found for company: ${company} (DB name: ${dbCompanyName})`);
      throw new Error(`No data found for company: ${company}`);
    }

    console.log(`Found latest entry for ${company}:`, latestEntry);
    return latestEntry;
  } catch (error) {
    console.error(`Error fetching data for company ${company}:`, error);
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  console.log(`Supplier quotes API request received: ${req.method} ${req.url}`);
  
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
    const action = req.query.action as string;
    const company = req.query.company as string;
    
    // If action is 'update' or not specified, fetch and process company updates
    if (!action || action === 'update') {
      // Fetch company updates from external API
      const companyUpdates = await fetchCompanyUpdates();
      
      if (companyUpdates.length === 0) {
        // Even if there are no updates, still return the latest quotes
        const latestQuotes = await fetchLatestQuotes();
        
        return res.status(200).json({
          success: true,
          message: 'No new company updates available',
          data: latestQuotes
        });
      }
      
      // Process and save the updates
      const updatedCompanies = await processAndSaveCompanyUpdates(companyUpdates);
      
      // After processing updates, fetch the latest quotes to return
      const latestQuotes = await fetchLatestQuotes();
      
      return res.status(200).json({
        success: true,
        message: updatedCompanies.length > 0 
          ? 'Company updates processed successfully' 
          : 'No companies were updated',
        data: latestQuotes,
        updatedCompanies: updatedCompanies
      });
    }
    
    // If action is 'quotes', just fetch the latest quotes without updating
    if (action === 'quotes') {
      const latestQuotes = await fetchLatestQuotes();
      
      return res.status(200).json({
        success: true,
        data: latestQuotes
      });
    }
    
    // If action is 'company', fetch data for a specific company
    if (action === 'company' && company) {
      try {
        // Check if we need to update the data first
        const shouldUpdate = req.query.update === 'true';
        
        if (shouldUpdate) {
          // Fetch updates from external API
          const companyUpdates = await fetchCompanyUpdates();
          
          if (companyUpdates.length > 0) {
            // Process and save the updates
            await processAndSaveCompanyUpdates(companyUpdates);
            console.log(`Updated company data before fetching for ${company}`);
          }
        }
        
        // Now fetch the latest data (which will include any updates we just processed)
        const companyData = await fetchCompanyQuote(company);
        
        // Return the data in the same format as the other endpoints
        const result: { [key: string]: any } = {};
        result[company] = companyData;
        
        return res.status(200).json({
          success: true,
          data: result,
          updated: shouldUpdate
        });
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: `Failed to fetch data for company: ${company}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Invalid action
    return res.status(400).json({
      success: false,
      message: 'Invalid action parameter',
      error: 'Action must be one of: "update", "quotes", or "company"'
    });
  } catch (error) {
    console.error('Error in supplier quotes API:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
}
