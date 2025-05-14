import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('MCX Third Month API called with query:', req.query);

    // Get the most recent record to determine the third month label
    const latestSnapshot = await prisma.aluminumSnapshot.findFirst({
      orderBy: {
        timestamp: 'desc'
      }
    });

    if (!latestSnapshot) {
      return res.status(404).json({
        success: false,
        message: 'No aluminum snapshot data found'
      });
    }

    // Get the third month label (month3Label)
    const thirdMonthLabel = latestSnapshot.month3Label.toLowerCase();
    console.log(`Third month label: ${thirdMonthLabel}`);

    // Get date range from query parameters
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;

    // Fetch all records for the third month with date filtering
    const snapshots = await prisma.aluminumSnapshot.findMany({
      where: {
        month3Label: {
          equals: thirdMonthLabel,
          mode: 'insensitive' // Case insensitive comparison
        },
        timestamp: {
          gte: startDate || new Date(new Date().setHours(0, 0, 0, 0)),
          lte: endDate || new Date(new Date().setHours(23, 59, 59, 999))
        }
      },
      orderBy: {
        timestamp: 'asc'
      },
      select: {
        timestamp: true,
        month3Label: true,
        month3Price: true
      }
    });

    // Process data to handle duplicates while preserving 30-minute intervals
    const processedData = new Map();
    
    snapshots.forEach(snapshot => {
      const timestamp = snapshot.timestamp;
      const timestampISO = timestamp.toISOString();
      const price = parseFloat(snapshot.month3Price.toString());
      
      processedData.set(timestampISO, {
        date: timestampISO,
        value: price,
        timestamp: timestampISO
      });
    });

    // Convert Map to Array and sort by timestamp
    const dataPoints = Array.from(processedData.values()).sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate statistics
    const prices = dataPoints.map(point => point.value);
    const stats = {
      count: dataPoints.length,
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      avgPrice: prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0,
      startPrice: prices.length > 0 ? prices[0] : 0,
      endPrice: prices.length > 0 ? prices[prices.length - 1] : 0,
      totalChange: prices.length > 0 ? prices[prices.length - 1] - prices[0] : 0,
      totalChangePercent: prices.length > 0 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0
    };

    // Return the response
    return res.status(200).json({
      success: true,
      thirdMonth: thirdMonthLabel,
      data: dataPoints,
      stats,
      lastUpdated: latestSnapshot.timestamp.toISOString()
    });

  } catch (error) {
    console.error('Error fetching MCX third month data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch MCX data',
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 