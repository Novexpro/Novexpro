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
    console.log('MCX Current Month API called');

    // Step 1: Get the most recent record to determine the current month label
    const latestSnapshot = await prisma.mCX_3_Month.findFirst({
      orderBy: {
        timestamp: 'desc'  // Use timestamp instead of createdAt
      }
    });

    if (!latestSnapshot) {
      return res.status(404).json({
        success: false,
        message: 'No MCX data found'
      });
    }

    const currentMonthLabel = latestSnapshot.month1Label;
    console.log(`Current month label: ${currentMonthLabel}`);

    // Step 2: Get today's date in UTC (database timezone)
    const today = new Date();
    
    // Create today's date with time set to 00:00:00 UTC
    const startOfToday = new Date(today);
    startOfToday.setUTCHours(0, 0, 0, 0);
    
    // Create today's date with time set to 23:59:59 UTC
    const endOfToday = new Date(today);
    endOfToday.setUTCHours(23, 59, 59, 999);
    
    console.log(`Today's date range: ${startOfToday.toISOString()} to ${endOfToday.toISOString()}`);

    // Step 3: Fetch all records for today with the current month label
    // Ignore records where month1Label is '0'
    const todaySnapshots = await prisma.mCX_3_Month.findMany({
      where: {
        month1Label: {
          equals: currentMonthLabel,
          not: '0', // Ignore if month1Label is '0'
          mode: 'insensitive' // Case insensitive comparison
        },
        timestamp: {  // Use timestamp instead of createdAt
          gte: startOfToday,
          lte: endOfToday
        }
      },
      orderBy: {
        timestamp: 'asc'  // Use timestamp instead of createdAt
      },
      select: {
        timestamp: true,  // Select timestamp
        createdAt: true,  // Keep createdAt for reference
        month1Label: true,
        month1Price: true
      }
    });

    console.log(`Found ${todaySnapshots.length} total snapshots for today`);

    // Step 4: Filter to only include snapshots between trading hours (9:00 to 23:30)
    const filteredSnapshots = todaySnapshots.filter(snapshot => {
      const hours = snapshot.timestamp.getUTCHours();  // Use timestamp instead of createdAt
      const minutes = snapshot.timestamp.getUTCMinutes();  // Use timestamp instead of createdAt
      
      // If it's the end hour (23), only include up to the specified minute (30)
      if (hours === TRADING_END_HOUR) {
        return minutes <= TRADING_END_MINUTE;
      }
      
      return hours >= TRADING_START_HOUR && hours < TRADING_END_HOUR;
    });

    console.log(`After time filtering: ${filteredSnapshots.length} snapshots between ${TRADING_START_HOUR}:00 and ${TRADING_END_HOUR}:00`);

    if (filteredSnapshots.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No data available for today within trading hours',
        currentMonth: currentMonthLabel,
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
        lastUpdated: latestSnapshot.timestamp.toISOString()  // Use timestamp
      });
    }

    // Step 5: Format the data for the frontend
    const formattedData = filteredSnapshots.map(snapshot => {
      const { timestamp, month1Price } = snapshot;  // Use timestamp instead of createdAt
      const price = parseFloat(month1Price.toString());
      
      // Use the raw UTC values directly to ensure consistency across environments
      // This addresses the timezone inconsistency issue mentioned in the memory
      const hours = timestamp.getUTCHours();  // Use timestamp instead of createdAt
      const minutes = timestamp.getUTCMinutes();  // Use timestamp instead of createdAt
      
      // Convert to 12-hour format for display
      const hour12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayTime = `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      
      return {
        createdAt: timestamp.toISOString(),  // Keep the field name but use timestamp value
        date: timestamp.toISOString(),  // Use timestamp instead of createdAt
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
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      avgPrice: prices.reduce((sum, price) => sum + price, 0) / prices.length
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
      currentMonth: currentMonthLabel,
      data: formattedData,
      stats,
      tradingStatus: {
        isWithinTradingHours: isWithinTradingHours(new Date()),
        tradingHours: `${TRADING_START_HOUR}:00 - ${TRADING_END_HOUR}:00`
      },
      lastUpdated: latestSnapshot.timestamp.toISOString()  // Use timestamp
    });

  } catch (error) {
    console.error('Error fetching MCX current month data:', error);
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