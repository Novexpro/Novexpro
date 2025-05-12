import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('MCX Next Month API called with query:', req.query);

    // Get the most recent record to determine the next month label
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

    // Get the next month label (month2Label)
    const nextMonthLabel = latestSnapshot.month2Label.toLowerCase();
    console.log(`Next month label: ${nextMonthLabel}`);

    // Fetch all records for the next month
    const snapshots = await prisma.aluminumSnapshot.findMany({
      where: {
        month2Label: {
          equals: nextMonthLabel,
          mode: 'insensitive' // Case insensitive comparison
        }
      },
      orderBy: {
        timestamp: 'asc'
      },
      select: {
        timestamp: true,
        month2Label: true,
        month2Price: true
      }
    });

    // Process data to handle duplicates while preserving 30-minute intervals
    const processedData = new Map();
    let lastTimestamp = null;
    let lastPrice = null;
    
    snapshots.forEach(snapshot => {
      const timestamp = snapshot.timestamp;
      const timestampISO = timestamp.toISOString();
      const price = parseFloat(snapshot.month2Price.toString());
      
      // Always include the first and last points
      const isFirstOrLast = 
        snapshot === snapshots[0] || 
        snapshot === snapshots[snapshots.length - 1];
      
      // Calculate time difference if we have a previous timestamp
      let timeDiffMinutes = 0;
      if (lastTimestamp) {
        timeDiffMinutes = (timestamp.getTime() - lastTimestamp.getTime()) / (1000 * 60);
      }
      
      // Include the point if:
      // 1. It's the first point we're processing
      // 2. It's the last point in the dataset
      // 3. It's been at least 30 minutes since the last included point
      // 4. The price changed from the last point
      if (
        lastTimestamp === null || 
        isFirstOrLast || 
        timeDiffMinutes >= 30 || 
        price !== lastPrice
      ) {
        processedData.set(timestampISO, {
          date: timestampISO,
          value: price,
          timestamp: timestampISO
        });
        lastTimestamp = timestamp;
        lastPrice = price;
      }
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
      nextMonth: nextMonthLabel,
      data: dataPoints,
      stats,
      lastUpdated: latestSnapshot.timestamp.toISOString()
    });

  } catch (error) {
    console.error('Error fetching MCX next month data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch MCX data',
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 