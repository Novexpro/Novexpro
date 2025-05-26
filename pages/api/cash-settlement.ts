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

// New interface for cash settlement format
interface CashSettlementData {
  cashSettlement: number;
  dateTime: string;
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set cache control headers to prevent browser caching
  res.setHeader('Cache-Control', noCacheHeaders['Cache-Control']);
  res.setHeader('Pragma', noCacheHeaders['Pragma']);
  res.setHeader('Expires', noCacheHeaders['Expires']);
  
  // Get the latest cash settlement data
  try {
    // Check if we should bypass the database cache
    const bypassCache = req.query._t !== undefined;

    // If not bypassing cache, try to get from database first
    if (!bypassCache) {
      // Check if we're getting the latest settlement from the database first
      const latestSettlement = await prisma.lME_West_Metal_Price.findFirst({
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      
      // If we have the data in our database, return it directly
      if (latestSettlement) {
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: latestSettlement.Price,
          dateTime: latestSettlement.date
        });
      }
    }
    
    // If bypassing cache or no data in database, check the backend server
    const backendUrl = process.env.BACKEND_URL || 'http://148.135.138.22:3232';
    const response = await fetch(`${backendUrl}/api/price-data`, {
      // Add cache-busting parameter to prevent server-side caching
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch price data from backend: ${response.status} ${response.statusText}`);
    }
    
    const rawData = await response.json();
    
    // Check for cash settlement data
    if ('is_cash_settlement' in rawData && rawData.is_cash_settlement === true && rawData.cash_settlement !== null) {
      // Save to database
      await saveLmeWestMetalPrice(rawData.cash_settlement, rawData.last_updated);
      
      // Return data
      return res.status(200).json({
        type: 'cashSettlement',
        cashSettlement: rawData.cash_settlement,
        dateTime: rawData.last_updated
      });
    } else if ('cashSettlement' in rawData && 'dateTime' in rawData) {
      // Handle original cash settlement format
      const cashData = rawData as CashSettlementData;
      
      // Save to database
      await saveLmeWestMetalPrice(cashData.cashSettlement, cashData.dateTime);
      
      // Return data
      return res.status(200).json({
        type: 'cashSettlement',
        cashSettlement: cashData.cashSettlement,
        dateTime: cashData.dateTime
      });
    } else {
      // No cash settlement data available
      return res.status(404).json({
        type: 'noData',
        message: 'No cash settlement data available'
      });
    }
  } catch (error) {
    console.error('Error fetching or storing cash settlement data:', error);
    
    // If error occurs, try to get the latest data from the database
    try {
      const latestSettlement = await prisma.lME_West_Metal_Price.findFirst({
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      
      if (latestSettlement) {
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: latestSettlement.Price,
          dateTime: latestSettlement.date,
          message: 'Using cached data due to backend error'
        });
      }
    } catch (dbError) {
      console.error('Error retrieving data from database:', dbError);
    }
    
    // If no database data is available, return an error status
    res.status(503).json({ 
      error: "Service temporarily unavailable", 
      message: "No cash settlement data available at this time" 
    });
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
} 