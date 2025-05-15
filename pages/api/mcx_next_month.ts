import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define trading hours in 24-hour format
const TRADING_START_HOUR = 9;
const TRADING_END_HOUR = 23;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('MCX Next Month API called');

    // Step 1: Get the most recent record to determine the next month label
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
    const nextMonthLabel = latestSnapshot.month2Label;
    console.log(`Next month label: ${nextMonthLabel}`);

    // Step 2: Get today's date in UTC (database timezone)
    const today = new Date();
    
    // Create today's date with time set to 00:00:00 UTC
    const startOfToday = new Date(today);
    startOfToday.setUTCHours(0, 0, 0, 0);
    
    // Create today's date with time set to 23:59:59 UTC
    const endOfToday = new Date(today);
    endOfToday.setUTCHours(23, 59, 59, 999);
    
    console.log(`Today's date range: ${startOfToday.toISOString()} to ${endOfToday.toISOString()}`);

    // Step 3: Fetch all records for today with the next month label
    const todaySnapshots = await prisma.aluminumSnapshot.findMany({
      where: {
        month2Label: {
          equals: nextMonthLabel,
          mode: 'insensitive' // Case insensitive comparison
        },
        timestamp: {
          gte: startOfToday,
          lte: endOfToday
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

    console.log(`Found ${todaySnapshots.length} total snapshots for today`);

    // Step 4: Filter to only include snapshots between 9:00 and 23:00
    const filteredSnapshots = todaySnapshots.filter(snapshot => {
      const hours = snapshot.timestamp.getUTCHours();
      return hours >= TRADING_START_HOUR && hours <= TRADING_END_HOUR;
    });

    console.log(`After time filtering: ${filteredSnapshots.length} snapshots between ${TRADING_START_HOUR}:00 and ${TRADING_END_HOUR}:00`);

    if (filteredSnapshots.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No data available for today within trading hours',
        nextMonth: nextMonthLabel,
        data: [],
        stats: {
          count: 0,
          minPrice: 0,
          maxPrice: 0,
          avgPrice: 0
        },
        tradingStatus: {
          isWithinTradingHours: isWithinTradingHours(new Date()),
          tradingHours: `${TRADING_START_HOUR}:00 - ${TRADING_END_HOUR}:00`
        },
        lastUpdated: latestSnapshot.timestamp.toISOString()
      });
    }

    // Step 5: Format the data for the frontend
    const formattedData = filteredSnapshots.map(snapshot => {
      const timestamp = snapshot.timestamp;
      const price = parseFloat(snapshot.month2Price.toString());
      
      // Convert UTC to IST by adding 6:30 hours (5:30 for IST + 1 hour adjustment)
      const istTimestamp = new Date(timestamp.getTime() + (6.5 * 60 * 60 * 1000));
      
      // Format display time for UI in 12-hour format
      const displayTime = istTimestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      return {
        timestamp: timestamp.toISOString(),
        date: timestamp.toISOString(),
        value: price,
        displayTime: displayTime,
        istHour: istTimestamp.getHours(),
        istMinute: istTimestamp.getMinutes()
      };
    });

    // Step 6: Calculate statistics
    const prices = formattedData.map(item => item.value);
    const stats = {
      count: prices.length,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      avgPrice: prices.reduce((sum, price) => sum + price, 0) / prices.length
    };

    // Log a sample of the data for debugging
    if (formattedData.length > 0) {
      const firstDataPoint = formattedData[0];
      const originalTime = new Date(firstDataPoint.timestamp);
      
      console.log(`Sample data point: ${JSON.stringify(firstDataPoint)}`);
      console.log(`First data point UTC time: ${originalTime.toUTCString()}`);
      console.log(`First data point local time: ${originalTime.toLocaleString()}`);
      console.log(`First data point converted IST time: ${firstDataPoint.istHour}:${firstDataPoint.istMinute} (${firstDataPoint.displayTime})`);
      console.log(`Last data point IST time: ${formattedData[formattedData.length-1].displayTime}`);
    }

    // Return the response
    return res.status(200).json({
      success: true,
      nextMonth: nextMonthLabel,
      data: formattedData,
      stats,
      tradingStatus: {
        isWithinTradingHours: isWithinTradingHours(new Date()),
        tradingHours: `${TRADING_START_HOUR}:00 - ${TRADING_END_HOUR}:00`
      },
      lastUpdated: latestSnapshot.timestamp.toISOString()
    });

  } catch (error) {
    console.error('Error fetching MCX next month data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch MCX data',
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to check if current time is within trading hours
function isWithinTradingHours(date: Date): boolean {
  const hours = date.getUTCHours();
  return hours >= TRADING_START_HOUR && hours <= TRADING_END_HOUR;
} 