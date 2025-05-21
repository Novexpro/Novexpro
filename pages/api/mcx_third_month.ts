import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define trading hours in 24-hour format
const TRADING_START_HOUR = 9;
const TRADING_END_HOUR = 23;
const TRADING_END_MINUTE = 30; // End at 23:30

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('MCX Third Month API called');

    // Step 1: Get the most recent record to determine the third month label
    const latestSnapshot = await prisma.mCX_3_Month.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!latestSnapshot) {
      return res.status(404).json({
        success: false,
        message: 'No MCX data found'
      });
    }

    // Get the third month label (month3Label)
    const thirdMonthLabel = latestSnapshot.month3Label;
    console.log(`Third month label: ${thirdMonthLabel}`);

    // Step 2: Get today's date in UTC (database timezone)
    const today = new Date();
    
    // Create today's date with time set to 00:00:00 UTC
    const startOfToday = new Date(today);
    startOfToday.setUTCHours(0, 0, 0, 0);
    
    // Create today's date with time set to 23:59:59 UTC
    const endOfToday = new Date(today);
    endOfToday.setUTCHours(23, 59, 59, 999);
    
    console.log(`Today's date range: ${startOfToday.toISOString()} to ${endOfToday.toISOString()}`);

    // Step 3: Fetch all records for today with the third month label
    // Ignore records where month3Label is '0'
    const todaySnapshots = await prisma.mCX_3_Month.findMany({
      where: {
        month3Label: {
          equals: thirdMonthLabel,
          not: '0', // Ignore if month3Label is '0'
          mode: 'insensitive' // Case insensitive comparison
        },
        createdAt: {
          gte: startOfToday,
          lte: endOfToday
        }
      },
      orderBy: {
        createdAt: 'asc'
      },
      select: {
        createdAt: true,
        month3Label: true,
        month3Price: true
      }
    });

    console.log(`Found ${todaySnapshots.length} total snapshots for today`);

    // Step 4: Filter to only include snapshots between trading hours (9:00 to 23:30)
    const filteredSnapshots = todaySnapshots.filter(snapshot => {
      const hours = snapshot.createdAt.getUTCHours();
      const minutes = snapshot.createdAt.getUTCMinutes();
      
      // If it's the end hour (23), only include up to the specified minute (30)
      if (hours === TRADING_END_HOUR) {
        return minutes <= TRADING_END_MINUTE;
      }
      
      return hours >= TRADING_START_HOUR && hours < TRADING_END_HOUR;
    });

    console.log(`After time filtering: ${filteredSnapshots.length} snapshots between ${TRADING_START_HOUR}:00 and ${TRADING_END_HOUR}:${TRADING_END_MINUTE}`);

    if (filteredSnapshots.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No data available for today within trading hours',
        thirdMonth: thirdMonthLabel,
        data: [],
        stats: {
          count: 0,
          minPrice: 0,
          maxPrice: 0,
          avgPrice: 0
        },
        tradingStatus: {
          isWithinTradingHours: isWithinTradingHours(new Date()),
          tradingHours: `${TRADING_START_HOUR}:00 - ${TRADING_END_HOUR}:${TRADING_END_MINUTE}`
        },
        lastUpdated: latestSnapshot.createdAt.toISOString()
      });
    }

    // Step 5: Format the data for the frontend
    const formattedData = filteredSnapshots.map(snapshot => {
      const { createdAt, month3Price } = snapshot;
      const price = parseFloat(month3Price.toString());
      
      // Use the raw UTC values directly to ensure consistency across environments
      // This addresses the timezone inconsistency issue mentioned in the memory
      const hours = createdAt.getUTCHours();
      const minutes = createdAt.getUTCMinutes();
      
      // Convert to 12-hour format for display
      const hour12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayTime = `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      
      return {
        createdAt: createdAt.toISOString(),
        date: createdAt.toISOString(),
        value: price,
        displayTime: displayTime,
        istHour: hours,
        istMinute: minutes
      };
    });

    // Step 6: Calculate statistics
    const prices = formattedData.map(item => item.value);
    const stats = {
      count: prices.length,
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      avgPrice: prices.length > 0 ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0,
      startPrice: prices.length > 0 ? prices[0] : 0,
      endPrice: prices.length > 0 ? prices[prices.length - 1] : 0,
      totalChange: prices.length > 0 ? prices[prices.length - 1] - prices[0] : 0,
      totalChangePercent: prices.length > 0 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0
    };

    // Log a sample of the data for debugging
    if (formattedData.length > 0) {
      const firstDataPoint = formattedData[0];
      const originalTime = new Date(firstDataPoint.createdAt);
      
      console.log(`Sample data point: ${JSON.stringify(firstDataPoint)}`);
      console.log(`First data point UTC time: ${originalTime.toUTCString()}`);
      console.log(`First data point local time: ${originalTime.toLocaleString()}`);
      console.log(`First data point converted time: ${firstDataPoint.istHour}:${firstDataPoint.istMinute} (${firstDataPoint.displayTime})`);
      console.log(`Last data point time: ${formattedData[formattedData.length-1].displayTime}`);
    }

    // Return the response
    return res.status(200).json({
      success: true,
      thirdMonth: thirdMonthLabel,
      data: formattedData,
      stats,
      tradingStatus: {
        isWithinTradingHours: isWithinTradingHours(new Date()),
        tradingHours: `${TRADING_START_HOUR}:00 - ${TRADING_END_HOUR}:${TRADING_END_MINUTE}`
      },
      lastUpdated: latestSnapshot.timestamp.toISOString()
    });

  } catch (error) {
    console.error('Error fetching MCX third month data:', error);
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
  const minutes = date.getUTCMinutes();
  
  // If it's the end hour (23), only include up to the specified minute (30)
  if (hours === TRADING_END_HOUR) {
    return minutes <= TRADING_END_MINUTE; // Only until 23:30:00
  }
  
  // For hours between start and end (9-22), always return true
  return hours >= TRADING_START_HOUR && hours < TRADING_END_HOUR;
}