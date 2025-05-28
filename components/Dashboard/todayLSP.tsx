import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

// Define a type for the extended PrismaClient
type ExtendedPrismaClient = PrismaClient & {
  lME_West_Metal_Price: {
    create: (params: {
      data: { date: string; Price: number };
    }) => Promise<{ id: number; date: string; Price: number; createdAt: Date }>;
  };
};

const prisma = new PrismaClient() as ExtendedPrismaClient;

// Interface for API response (matching frontend expectations)
interface CashSettlementResponse {
  type: 'cashSettlement' | 'noData';
  cashSettlement?: number;
  dateTime?: string;
  message?: string;
  error?: string;
  success?: boolean;
}

// Interface for external API response data (matching your actual API)
interface ExternalApiData {
  date?: string;
  price?: number;
  time?: string;
  last_updated?: string;
}

// Function to save cash settlement data to database
async function saveLmeWestMetalPrice(price: number, dateTime: string): Promise<boolean> {
  try {
    const date = new Date(dateTime).toISOString();
    
    console.log(`Saving cash settlement: ${price} at ${date}`);
    
    const result = await prisma.lME_West_Metal_Price.create({
      data: {
        date: date,
        Price: price
      }
    });
    
    console.log(`Successfully saved cash settlement data:`, result);
    return true;
  } catch (error) {
    console.error('Error saving cash settlement data:', error);
    return false;
  }
}

// Function to fetch data from external API
async function fetchExternalCashSettlementData(): Promise<ExternalApiData> {
  try {
    // Fixed API endpoint URL to match your requirement
    const apiEndpoint = 'http://148.135.138.22:3232/api/cash-settlement';
    
    console.log(`Fetching cash settlement data from: ${apiEndpoint}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(apiEndpoint, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Accept': 'application/json',
        'User-Agent': 'NextJS-API-Client'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`External API returned status ${response.status}`);
    }
    
    const responseText = await response.text();
    
    if (!responseText.trim()) {
      throw new Error('Empty response from external API');
    }
    
    const data = JSON.parse(responseText);
    console.log('External API data received:', data);
    
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Request to external API timed out');
      throw new Error('Request to external API timed out');
    }
    console.error('Error fetching from external API:', error);
    throw error;
  }
}

// Helper function to validate cash settlement value
function isValidCashSettlement(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value) && value > 0;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CashSettlementResponse>
) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log('API wLME called with query:', req.query);
    
    // Fetch data from external API
    const externalData = await fetchExternalCashSettlementData();
    
    // Extract cash settlement value (your API returns 'price')
    let cashSettlementValue: number | null = null;
    
    if (isValidCashSettlement(externalData.price)) {
      cashSettlementValue = externalData.price;
      console.log('Using price value:', cashSettlementValue);
    }
    
    if (cashSettlementValue !== null) {
      // Use the last_updated from API or construct from date and time
      let dateToUse: string;
      
      if (externalData.last_updated) {
        // Convert "2025-05-28 12:58:29" to ISO format
        dateToUse = new Date(externalData.last_updated).toISOString();
      } else if (externalData.date && externalData.time) {
        // Combine date and time: "2025-05-28" + "12:58:29"
        dateToUse = new Date(`${externalData.date} ${externalData.time}`).toISOString();
      } else {
        dateToUse = new Date().toISOString();
      }
      
      console.log('Using date:', dateToUse);
      
      // Save to database
      const saveSuccess = await saveLmeWestMetalPrice(cashSettlementValue, dateToUse);
      
      if (saveSuccess) {
        console.log('Returning success response to frontend');
        // Return data to frontend
        return res.status(200).json({
          type: 'cashSettlement',
          cashSettlement: cashSettlementValue,
          dateTime: dateToUse,
          success: true
        });
      } else {
        console.error('Database save failed');
        return res.status(500).json({
          type: 'noData',
          error: 'Failed to save data to database',
          success: false
        });
      }
    } else {
      console.log('No valid cash settlement data found');
      return res.status(404).json({
        type: 'noData',
        message: 'No valid cash settlement data found',
        success: false
      });
    }
  } catch (error) {
    console.error('Error in cash settlement handler:', error);
    
    return res.status(503).json({
      type: 'noData',
      error: 'Service temporarily unavailable',
      message: 'Failed to fetch cash settlement data',
      success: false
    });
  } finally {
    await prisma.$disconnect();
  }
}
