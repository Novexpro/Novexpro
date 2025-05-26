import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

// Define a type for the extended PrismaClient that includes our custom models
type ExtendedPrismaClient = PrismaClient & {
  lME_West_Metal_Price: {
    upsert: (params: {
      where: { date: string };
      update: { Price: number };
      create: { date: string; Price: number };
    }) => Promise<{ id: number; date: string; Price: number; createdAt: Date }>;
  };
};

const prisma = new PrismaClient() as ExtendedPrismaClient;

// Interface for cash settlement response
interface CashSettlementResponse {
  type: 'cashSettlement' | 'noData';
  cashSettlement?: number;
  dateTime?: string;
  message?: string;
  error?: string;
  success?: boolean;
}

// Interface for cash settlement data
interface CashSettlementData {
  cashSettlement: number;
  dateTime: string;
}

// Interface for external API response data
interface ExternalApiData {
  spot_price?: number | null;
  price_change?: number;
  change_percentage?: number;
  last_updated?: string;
  cash_settlement?: number | null;
  is_cash_settlement?: boolean;
}

// Cache control headers to prevent browser caching
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// Function to save cash settlement data to LME_West_Metal_Price table
async function saveLmeWestMetalPrice(price: number, dateTime: string): Promise<boolean> {
  try {
    // Format the date string properly
    const date = new Date(dateTime).toISOString();
    
    // Save to LME_West_Metal_Price table using upsert to avoid duplicates
    await prisma.lME_West_Metal_Price.upsert({
      where: {
        date: date
      },
      update: {
        Price: price
      },
      create: {
        date: date,
        Price: price
      }
    });
    
    console.log(`Saved cash settlement data: ${price} at ${dateTime}`);
    
    // Trigger LME cash settlement calculation
    try {
      const calculationResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/lmecashcal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: 'lme_west_update'
        })
      });
      
      if (calculationResponse.ok) {
        console.log('LME cash settlement calculation triggered successfully');
      } else {
        console.warn('LME cash settlement calculation trigger failed:', 
          await calculationResponse.text());
      }
    } catch (error) {
      console.error('Error triggering LME cash settlement calculation:', error);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving cash settlement data:', error);
    return false;
  }
}

// Function to fetch data from external API
async function fetchExternalCashSettlementData(): Promise<ExternalApiData> {
  try {
    // Use the correct external API URL
    const backendUrl = process.env.BACKEND_URL || 'http://148.135.138.22:3232';
    const apiEndpoint = `${backendUrl}/api/price-data`;
    
    console.log(`Attempting to fetch cash settlement data from external API: ${apiEndpoint}`);
    
    // Add timeout to avoid hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    try {
      console.log('Initiating fetch request to external API for cash settlement...');
      const response = await fetch(apiEndpoint, {
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      console.log(`External API response status for cash settlement: ${response.status}`);
    
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`External API returned status ${response.status}: ${errorText}`);
        throw new Error(`External API returned status ${response.status}: ${errorText}`);
      }
    
      // Try to parse the response as JSON
      let data: ExternalApiData;
      try {
        const responseText = await response.text();
        console.log('Raw response from external API for cash settlement:', responseText.substring(0, 500)); // Log first 500 chars
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing JSON response for cash settlement:', parseError);
        throw new Error(`Failed to parse API response as JSON: ${parseError}`);
      }
      
      console.log('Successfully fetched external API data for cash settlement:', JSON.stringify(data));
      
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("Error in inner fetch for cash settlement:", error);
      throw error;
    }
  } catch (error) {
    console.error('Error fetching cash settlement from external API:', error);
    throw error;
  }
}

// Function to get latest cash settlement from database
async function getLatestCashSettlementFromDb(): Promise<{ id: number; date: string; Price: number; createdAt: Date } | null> {
  try {
    return await prisma.lME_West_Metal_Price.findFirst({
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  } catch (error) {
    console.error('Error retrieving cash settlement from database:', error);
    return null;
  }
}

// Function to get today's cash settlement from database
async function getTodayCashSettlementFromDb(): Promise<{ id: number; date: string; Price: number; createdAt: Date } | null> {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    const todayStart = today + 'T00:00:00.000Z';
    const todayEnd = today + 'T23:59:59.999Z';
    
    console.log(`Searching for cash settlement data between ${todayStart} and ${todayEnd}`);
    
    // Find cash settlement data for today
    return await prisma.lME_West_Metal_Price.findFirst({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    });
  } catch (error) {
    console.error('Error retrieving today\'s cash settlement from database:', error);
    return null;
  }
}

// Function to check if we have fresh data for today
async function hasFreshDataForToday(): Promise<boolean> {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    const todayStart = today + 'T00:00:00.000Z';
    const todayEnd = today + 'T23:59:59.999Z';
    
    // Check if we have data created today (using createdAt field)
    const freshData = await prisma.lME_West_Metal_Price.findFirst({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd
        },
        createdAt: {
          gte: new Date(today)
        }
      }
    });
    
    // If we have data created today, it's considered fresh
    return !!freshData;
  } catch (error) {
    console.error('Error checking for fresh data:', error);
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CashSettlementResponse>
) {
  // Define these variables at the top of the handler for use throughout the function
  const bypassCache = req.query._t !== undefined;
  const forceToday = req.query.forceToday === 'true';
  const requestedDate = req.query.date as string | undefined;
  
  // Get today's date in YYYY-MM-DD format for consistent use throughout the handler
  const todayDate = new Date().toISOString().split('T')[0];
  const formattedTodayDate = todayDate + 'T00:00:00.000Z';
  // Set cache control headers to prevent browser caching
  res.setHeader('Cache-Control', noCacheHeaders['Cache-Control']);
  res.setHeader('Pragma', noCacheHeaders['Pragma']);
  res.setHeader('Expires', noCacheHeaders['Expires']);
  
  // Get the latest cash settlement data
  try {
    
    // If forcing today's data, first check if we have today's data in the database
    if (forceToday) {
      console.log('Requesting today\'s cash settlement data');
      
      // Check if we have fresh data for today
      const hasFreshData = await hasFreshDataForToday();
      
      // Try to get today's data from the database first
      const todaySettlement = await getTodayCashSettlementFromDb();
      
      // If we have today's data in the database and it's fresh, return it
      if (todaySettlement && hasFreshData) {
        console.log('Found today\'s cash settlement data in database:', todaySettlement);
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: todaySettlement.Price,
          dateTime: formattedTodayDate, // Use proper ISO format with today's date
          success: true
        });
      }
      
      // If we have data but it's not fresh (from a previous day), show no data available
      if (todaySettlement && !hasFreshData) {
        console.log('Found data for today but it\'s not fresh, waiting for new data');
        return res.status(404).json({
          type: 'noData',
          message: 'Waiting for today\'s cash settlement data',
          success: false
        });
      }
      
      // If we don't have today's data in the database, fetch from external API
      console.log('No today\'s cash settlement data found in database, fetching from external API');
      
      // Fetch from external API
      const externalData = await fetchExternalCashSettlementData();
      
      // If we have valid data, return it
      if (externalData.cash_settlement !== null && externalData.cash_settlement !== undefined) {
        // Format the date to today's date
        const formattedDate = formattedTodayDate;
        
        // Save to database with today's date - this will be considered fresh data
        await saveLmeWestMetalPrice(externalData.cash_settlement, formattedDate);
        
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: externalData.cash_settlement,
          dateTime: formattedDate,
          success: true
        });
      }
      
      // If we're forcing today's data and there's no fresh data, don't create mock entries
      // Instead, return a 404 to indicate we're waiting for today's data
      return res.status(404).json({
        type: 'noData',
        message: 'Waiting for today\'s cash settlement data',
        success: false
      });
    }
    
    // If not forcing today's data and not bypassing cache, try to get from database first
    if (!bypassCache && !forceToday) {
      const latestSettlement = await getLatestCashSettlementFromDb();
      
      // If we have the data in our database, return it directly
      if (latestSettlement) {
        // Check if this data is for today
        const dataDate = new Date(latestSettlement.date).toISOString().split('T')[0];
        const isToday = dataDate === todayDate;
        
        // If it's not today's data, check if we have fresh data
        if (isToday) {
          const hasFreshData = await hasFreshDataForToday();
          
          // If it's not fresh, return 404
          if (!hasFreshData) {
            return res.status(404).json({
              type: 'noData',
              message: 'Waiting for today\'s cash settlement data',
              success: false
            });
          }
        }
        
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: latestSettlement.Price,
          dateTime: latestSettlement.date,
          success: true
        });
      }
    }
    
    // If bypassing cache or no data in database, fetch from external API
    const externalData = await fetchExternalCashSettlementData();
    
    // Check for cash settlement data
    if (externalData.is_cash_settlement === true && externalData.cash_settlement !== null && externalData.cash_settlement !== undefined) {
      // Save to database
      await saveLmeWestMetalPrice(externalData.cash_settlement, externalData.last_updated || new Date().toISOString());
      
      // Return data
      return res.status(200).json({
        type: 'cashSettlement',
        cashSettlement: externalData.cash_settlement,
        dateTime: externalData.last_updated,
        success: true
      });
    } else if (externalData.cash_settlement !== null && externalData.cash_settlement !== undefined) {
      // Handle case where is_cash_settlement flag is not present but cash_settlement is
      await saveLmeWestMetalPrice(externalData.cash_settlement, externalData.last_updated || new Date().toISOString());
      
      return res.status(200).json({
        type: 'cashSettlement',
        cashSettlement: externalData.cash_settlement,
        dateTime: externalData.last_updated,
        success: true
      });
    } else {
      // No cash settlement data available from external API, check database as fallback
      const latestSettlement = await getLatestCashSettlementFromDb();
      
      if (latestSettlement) {
        // If forceToday is true, use today's date in the response
        const responseDate = forceToday 
          ? formattedTodayDate
          : latestSettlement.date;
          
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: latestSettlement.Price,
          dateTime: responseDate,
          message: 'Using cached data as no new cash settlement data is available',
          success: true
        });
      }
      
      // No data available at all
      return res.status(404).json({
        type: 'noData',
        message: 'No cash settlement data available',
        success: false
      });
    }
  } catch (error) {
    console.error('Error fetching or storing cash settlement data:', error);
    
    // If error occurs, try to get the latest data from the database
    try {
      const latestSettlement = await getLatestCashSettlementFromDb();
      
      if (latestSettlement) {
        // If forceToday is true, use today's date in the response
        const responseDate = forceToday 
          ? formattedTodayDate
          : latestSettlement.date;
          
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: latestSettlement.Price,
          dateTime: responseDate,
          message: 'Using cached data due to backend error',
          success: true
        });
      }
    } catch (dbError) {
      console.error('Error retrieving data from database:', dbError);
    }
    
    // If no database data is available, return an error status
    return res.status(503).json({ 
      type: 'noData',
      error: "Service temporarily unavailable", 
      message: "No cash settlement data available at this time",
      success: false
    });
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}
