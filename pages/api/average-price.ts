import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Response interface for properly typed API responses
interface ApiResponse {
  type: 'averagePrice' | 'noData';
  averagePrice?: number;
  change?: number;
  changePercent?: number;
  lastUpdated?: string;
  dataPointsCount?: number;
  lastCashSettlementPrice?: number;
  error?: string;
  message?: string;
}

// Interface for average price data
interface AveragePriceData {
  averagePrice: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  dataPointsCount: number;
  lastCashSettlementPrice?: number;
}

// Cache control headers to prevent browser caching
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// Function to calculate estimated CSP from the latest LME Cash Settlement datapoint onwards
async function calculateEstimatedCSP(): Promise<AveragePriceData | null> {
  try {
    // Get the latest cash settlement price from LME_West_Metal_Price table
    const latestCashSettlement = await prisma.lME_West_Metal_Price.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('Latest cash settlement:', latestCashSettlement);
    
    if (!latestCashSettlement) {
      console.log('No cash settlement price found');
      return {
        averagePrice: 0,
        change: 0,
        changePercent: 0,
        lastUpdated: new Date().toISOString(),
        dataPointsCount: 0,
        lastCashSettlementPrice: 0
      };
    }

    // Get all metal price records created AFTER the latest LME_West_Metal_Price entry
    const recordsAfterSettlement = await prisma.metalPrice.findMany({
      where: {
        createdAt: {
          gt: latestCashSettlement.createdAt // Use 'gt' (greater than) instead of 'gte'
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    console.log(`Found ${recordsAfterSettlement.length} metal price records after latest LME Cash Settlement (${latestCashSettlement.createdAt})`);
    
    // If no records found after the latest settlement, return zero values
    if (recordsAfterSettlement.length === 0) {
      console.log('No metal price records found after latest LME Cash Settlement');
      return {
        averagePrice: 0,
        change: 0,
        changePercent: 0,
        lastUpdated: latestCashSettlement.createdAt.toISOString(),
        dataPointsCount: 0,
        lastCashSettlementPrice: latestCashSettlement.Price || 0
      };
    }

    // Calculate the average of spot prices after the settlement
    let totalSpotPrice = 0;
    let validRecordsCount = 0;

    // Process all records, calculating the average spot price
    for (const record of recordsAfterSettlement) {
      const spotPrice = Number(record.spotPrice);
      // Only include positive spot prices (ignore zero values)
      if (spotPrice > 0) {
        validRecordsCount++;
        totalSpotPrice += spotPrice;
        console.log(`Including price: ${spotPrice} from ${record.createdAt}`);
      } else {
        console.log(`Skipping zero/invalid price: ${spotPrice} from ${record.createdAt}`);
      }
    }
    
    // Get the last record to use its timestamp
    const lastRecord = recordsAfterSettlement[recordsAfterSettlement.length - 1];
    
    // If no valid spot prices were found, return zero values
    if (validRecordsCount === 0) {
      console.log('No valid spot prices found after latest LME Cash Settlement');
      return {
        averagePrice: 0,
        change: 0,
        changePercent: 0,
        lastUpdated: lastRecord.createdAt.toISOString(),
        dataPointsCount: recordsAfterSettlement.length,
        lastCashSettlementPrice: latestCashSettlement.Price || 0
      };
    }
    
    const avgSpotPrice = totalSpotPrice / validRecordsCount;
    
    // Calculate change based on the latest cash settlement price
    const lastCashSettlementPrice = latestCashSettlement.Price || 0;
    const change = lastCashSettlementPrice > 0 ? avgSpotPrice - lastCashSettlementPrice : 0;
    const changePercent = lastCashSettlementPrice > 0 ? (change / lastCashSettlementPrice) * 100 : 0;
    
    console.log(`Calculated estimated CSP: ${avgSpotPrice} from ${validRecordsCount} valid records after LME Cash Settlement`);
    console.log(`Latest cash settlement price: ${lastCashSettlementPrice}`);
    console.log(`Change from cash settlement: ${change}`);
    console.log(`Change percent: ${changePercent}%`);
    console.log(`Settlement timestamp: ${latestCashSettlement.createdAt}`);
    console.log(`Records found after settlement: ${recordsAfterSettlement.length}, Valid: ${validRecordsCount}`);
    
    return {
      averagePrice: avgSpotPrice,
      change: change,
      changePercent: changePercent,
      lastUpdated: lastRecord.createdAt.toISOString(),
      dataPointsCount: validRecordsCount, // Return count of valid records used
      lastCashSettlementPrice: lastCashSettlementPrice
    };
  } catch (error) {
    console.error('Error calculating estimated CSP:', error);
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(`Average price API request received: ${req.method} ${req.url}`);
  console.log('Query parameters:', req.query);
  
  // Set cache control headers to prevent browser caching
  res.setHeader('Cache-Control', noCacheHeaders['Cache-Control']);
  res.setHeader('Pragma', noCacheHeaders['Pragma']);
  res.setHeader('Expires', noCacheHeaders['Expires']);
  
  try {
    console.log('Calculating estimated CSP from latest LME Cash Settlement datapoint onwards...');
    
    // Calculate the estimated CSP from the latest LME Cash Settlement onwards
    const averageData = await calculateEstimatedCSP();
    
    if (!averageData) {
      console.log('Failed to calculate average price');
      return res.status(404).json({
        type: 'noData',
        error: 'No data available',
        message: 'Could not calculate average price'
      });
    }
    
    // Return the average price data
    return res.status(200).json({
      type: 'averagePrice',
      averagePrice: averageData.averagePrice,
      change: averageData.change,
      changePercent: averageData.changePercent,
      lastUpdated: averageData.lastUpdated,
      dataPointsCount: averageData.dataPointsCount,
      lastCashSettlementPrice: averageData.lastCashSettlementPrice
    });
  } catch (error) {
    console.error('Error in average price API:', error);
    
    return res.status(500).json({
      type: 'noData',
      error: 'Server error',
      message: 'Failed to calculate average price'
    });
  } finally {
    await prisma.$disconnect();
  }
}
