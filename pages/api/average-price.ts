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
}

// Cache control headers to prevent browser caching
const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

// Function to calculate daily average price for today
async function calculateDailyAverage(): Promise<AveragePriceData | null> {
  try {
    // Get the start of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    // Get all records for today
    const todayRecords = await prisma.metalPrice.findMany({
      where: {
        createdAt: {
          gte: startOfToday
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // If no records found for today, we can't calculate an average
    if (todayRecords.length === 0) {
      console.log('No records found for today, cannot calculate average');
      return {
        averagePrice: 0,
        change: 0,
        changePercent: 0,
        lastUpdated: new Date().toISOString(),
        dataPointsCount: 0
      };
    }

    // Calculate the average of spot prices for today
    let totalSpotPrice = 0;
    let validRecordsCount = 0;
    let totalChange = 0;

    // Process all records, calculating the average spot price and change
    for (const record of todayRecords) {
      const spotPrice = Number(record.spotPrice);
      // Only include non-zero spot prices
      if (spotPrice > 0) {
        validRecordsCount++;
        totalSpotPrice += spotPrice;
      }
      totalChange += Number(record.change);
    }
    
    // Get the last record to use its timestamp
    const lastRecord = todayRecords[todayRecords.length - 1];
    
    // Calculate average change
    const avgChange = totalChange / todayRecords.length;

    // If no valid spot prices were found, we can't calculate a meaningful average
    if (validRecordsCount === 0) {
      console.log('No valid spot prices found for today');
      return {
        averagePrice: 0,
        change: avgChange,
        changePercent: 0,
        lastUpdated: lastRecord.createdAt.toISOString(),
        dataPointsCount: todayRecords.length
      };
    }
    
    const avgSpotPrice = totalSpotPrice / validRecordsCount;
    
    console.log(`Calculated average price: ${avgSpotPrice} from ${validRecordsCount} valid records`);
    console.log(`Average change: ${avgChange}`);
    
    return {
      averagePrice: avgSpotPrice,
      change: avgChange,
      changePercent: avgSpotPrice > 0 ? (avgChange / avgSpotPrice) * 100 : 0,
      lastUpdated: lastRecord.createdAt.toISOString(),
      dataPointsCount: todayRecords.length
    };
  } catch (error) {
    console.error('Error calculating average price:', error);
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
    console.log('Calculating average price...');
    
    // Calculate the daily average
    const averageData = await calculateDailyAverage();
    
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
      dataPointsCount: averageData.dataPointsCount
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
