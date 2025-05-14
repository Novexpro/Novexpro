import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define trading hours (9:00 AM to 23:00 PM IST)
const TRADING_START_HOUR = 9;
const TRADING_START_MINUTE = 0;
const TRADING_END_HOUR = 23;
const TRADING_END_MINUTE = 0; // Changed to 23:00 instead of 23:30

// Check if a given date is within trading hours
function isWithinTradingHours(date: Date): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  // Check if time is between 9:00 and 23:00
  if (hours > TRADING_START_HOUR && hours < TRADING_END_HOUR) {
    return true;
  } else if (hours === TRADING_START_HOUR && minutes >= TRADING_START_MINUTE) {
    return true;
  } else if (hours === TRADING_END_HOUR && minutes <= TRADING_END_MINUTE) {
    return true;
  }
  
  return false;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('MCX Current Month API called with query:', req.query);

    // Get the most recent record to determine the current month label
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

    // Get the current month label (month1Label)
    const currentMonthLabel = latestSnapshot.month1Label;
    console.log(`Current month label: ${currentMonthLabel}`);

    // Get date range from query parameters or use today's date in Indian timezone
    let startDate, endDate;
    
    if (req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate as string);
      endDate = new Date(req.query.endDate as string);
    } else {
      // Default to today in Indian timezone (IST)
      const today = new Date();
      const indianDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      // Log the current time for debugging
      console.log(`Current time (IST): ${indianDate.toLocaleTimeString()}`);
      
      // Get today's date string in YYYY-MM-DD format
      const todayDateString = indianDate.toISOString().split('T')[0];
      
      // Create a proper 9:00 AM timestamp for today in IST
      // First create a UTC date at midnight
      const todayMidnight = new Date(todayDateString + 'T00:00:00.000Z');
      
      // Then add 9 hours to get 9:00 AM in IST (which is UTC+5:30)
      // We need to account for the UTC to IST offset (5 hours and 30 minutes)
      const todayAt9AM = new Date(todayMidnight.getTime() + ((TRADING_START_HOUR - 5.5) * 60 * 60 * 1000));
      
      console.log(`Today at 9:00 AM IST: ${todayAt9AM.toISOString()}`);
      
      // Set the start date to 9:00 AM today
      startDate = todayAt9AM;
      
      // Set the end date to the end of today
      endDate = new Date(indianDate.setHours(23, 59, 59, 999));
      
      console.log(`Using date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    }
    
    // Check if current time is within trading hours
    const currentTime = new Date();
    const indianCurrentTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const isTrading = isWithinTradingHours(indianCurrentTime);
    console.log(`Current time (IST): ${indianCurrentTime.toLocaleTimeString()}, Is within trading hours: ${isTrading}`);
    
    // Add trading hours status to response
    const tradingStatus = {
      isWithinTradingHours: isTrading,
      currentTime: indianCurrentTime.toISOString(),
      tradingHours: `${TRADING_START_HOUR}:${TRADING_START_MINUTE} - ${TRADING_END_HOUR}:${TRADING_END_MINUTE}`
    };


    // Fetch all records for the current month with date filtering
    const snapshots = await prisma.aluminumSnapshot.findMany({
      where: {
        month1Label: {
          equals: currentMonthLabel,
          mode: 'insensitive' // Case insensitive comparison
        },
        timestamp: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        timestamp: 'asc'
      },
      select: {
        timestamp: true,
        month1Label: true,
        month1Price: true
      }
    });

    console.log(`Found ${snapshots.length} raw snapshots for today`);

    if (snapshots.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No data available for the selected date range',
        currentMonth: currentMonthLabel,
        data: [],
        stats: {
          count: 0,
          minPrice: 0,
          maxPrice: 0,
          avgPrice: 0,
          startPrice: 0,
          endPrice: 0,
          totalChange: 0,
          totalChangePercent: 0
        },
        tradingStatus,
        lastUpdated: latestSnapshot.timestamp.toISOString()
      });
    }

    // Process data to handle duplicates while preserving timestamps
    const processedData = new Map();
    
    // Log the number of snapshots found
    console.log(`Processing ${snapshots.length} snapshots`);
    
    // Get today's date string
    const todayDateString = indianCurrentTime.toISOString().split('T')[0];
    
    // Create exact 9:00 AM and 23:00 PM cutoff times for today
    const today9AM = new Date(`${todayDateString}T09:00:00`);
    const today2300PM = new Date(`${todayDateString}T23:00:00`);
    
    console.log(`Filtering data between ${today9AM.toLocaleTimeString()} and ${today2300PM.toLocaleTimeString()}`);
    
    // Count how many data points we're filtering out
    let totalPoints = 0;
    let filteredOutPoints = 0;
    let includedPoints = 0;
    
    snapshots.forEach(snapshot => {
      totalPoints++;
      const { timestamp, month1Price } = snapshot;
      const timestampISO = timestamp.toISOString();
      const price = parseFloat(month1Price.toString());
      
      // Skip invalid prices
      if (isNaN(price) || price <= 0) {
        filteredOutPoints++;
        return;
      }
      
      // Get the data point's time components for filtering
      const dataPointTime = new Date(timestamp);
      const hours = dataPointTime.getHours();
      const minutes = dataPointTime.getMinutes();
      
      // STRICT TIME FILTERING: Only include data points between 9:00 AM and 23:00 PM
      const isAfter9AM = (hours > 9) || (hours === 9 && minutes >= 0);
      const isBefore2300PM = (hours < 23); // Strictly before 23:00
      
      // Check if this data point is within our strict time window
      if (!isAfter9AM || !isBefore2300PM) {
        filteredOutPoints++;
        console.log(`Filtered out data point at ${hours}:${minutes} - outside 9:00-23:30 window`);
        return; // Skip this data point entirely
      }
      
      // Get the date part for filtering
      const dataDate = dataPointTime.toISOString().split('T')[0];
      const isToday = dataDate === todayDateString;
      
      // Only include data points from today
      if (!isToday) {
        filteredOutPoints++;
        console.log(`Filtered out data point from ${dataDate} - not today`);
        return; // Skip this data point entirely
      }
      
      // If we get here, the data point is from today and within our time window
      includedPoints++;
      console.log(`Including data point at ${hours}:${minutes} with value ${price}`);
      
      processedData.set(timestampISO, {
        value: price,
        timestamp: timestampISO
      });
    });
    
    console.log(`Filtering summary: ${includedPoints} included, ${filteredOutPoints} filtered out of ${totalPoints} total`);

    // Convert Map to Array and sort by timestamp
    const dataPoints = Array.from(processedData.values()).sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // We only want data points from today, starting at 9:00 AM
    console.log(`Total data points before filtering: ${dataPoints.length}`);
    
    // We've already filtered the data during processing, so we don't need to do it again here
    
    // Use the already filtered data points
    const finalDataPoints = dataPoints;
    
    console.log(`After double-checking: ${finalDataPoints.length} data points remaining`);
    
    console.log(`Returning ${finalDataPoints.length} data points after processing`);
    
    // Log a sample of the data points to verify format
    if (dataPoints.length > 0) {
      console.log('Sample data point:', JSON.stringify(dataPoints[0]));
    }

    // Calculate statistics
    const prices = dataPoints.map((point: any) => point.value);
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
      currentMonth: currentMonthLabel,
      data: finalDataPoints,
      stats,
      tradingStatus,
      lastUpdated: latestSnapshot.timestamp.toISOString()
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