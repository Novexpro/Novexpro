import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define interfaces for type safety
interface DataPoint {
  time: string;
  value: number;
  displayTime: string;
  displayDate: string;
}

interface StatsData {
  count: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  startPrice: number;
  endPrice: number;
  totalChange: number;
  totalChangePercent: number;
}

interface TradingStatus {
  isWithinTradingHours: boolean;
  dataSource: string;
  tradingStart: string;
  tradingEnd: string;
  message: string;
}

interface ApiResponse {
  success: boolean;
  data: DataPoint[];
  stats: StatsData;
  tradingStatus: TradingStatus;
  debug?: any;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse | { error: string; message: string }>
) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed', message: 'Only GET requests are allowed' });
    }
    
    console.log('======= LME TRENDS API CALLED =======');
    
    // Get current date and time
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Current time (Local): ${now.toString()}`);
    
    // Get today's date at midnight UTC
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    console.log(`Today at midnight UTC: ${today.toISOString()}`);
    
    // SUPER SIMPLE APPROACH: Get ALL data for today
    console.log('Using super simple approach to get ALL data for today');
    
    // First, let's get ALL data for today regardless of time
    const allTodayData = await prisma.metalPrice.findMany({
      where: {
        createdAt: {
          gte: today // From the start of today
        },
        spotPrice: {
          gt: 0 // Only positive prices
        }
      },
      select: {
        id: true,
        spotPrice: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    console.log(`Retrieved ${allTodayData.length} total records for today`);
    
    // Log all records to understand what data we have
    if (allTodayData.length > 0) {
      console.log('All records for today:');
      allTodayData.forEach((record, index) => {
        console.log(`Record ${index}:`, {
          id: record.id,
          time: new Date(record.createdAt).toISOString(),
          localTime: new Date(record.createdAt).toString(),
          spotPrice: Number(record.spotPrice)
        });
      });
    }
    
    // Define trading hours (9:00 AM to 11:30 PM) in UTC
    // We'll use these for both information and filtering
    const TRADING_START_HOUR = 9; // 9:00 AM 
    const TRADING_END_HOUR = 23; // 11:00 PM
    const TRADING_END_MINUTE = 30; // End at 23:30
    
    // Create trading window time objects for the response
    const todayTradingStart = new Date(today);
    todayTradingStart.setUTCHours(TRADING_START_HOUR, 0, 0, 0);
    
    const todayTradingEnd = new Date(today);
    todayTradingEnd.setUTCHours(TRADING_END_HOUR, TRADING_END_MINUTE, 0, 0);
    
    // Check if current time is within trading hours (using UTC)
    const currentHourUTC = now.getUTCHours();
    const currentMinuteUTC = now.getUTCMinutes();
    const isWithinTradingHours = 
      (currentHourUTC > TRADING_START_HOUR || (currentHourUTC === TRADING_START_HOUR && currentMinuteUTC >= 0)) &&
      (currentHourUTC < TRADING_END_HOUR || (currentHourUTC === TRADING_END_HOUR && currentMinuteUTC <= TRADING_END_MINUTE));
    
    console.log(`Current time UTC: ${currentHourUTC}:${currentMinuteUTC}`);
    console.log(`Is within trading hours: ${isWithinTradingHours}`);
    console.log(`Trading hours: ${TRADING_START_HOUR}:00 - ${TRADING_END_HOUR}:${TRADING_END_MINUTE}`);
    console.log(`Trading hours: ${todayTradingStart.toISOString()} to ${todayTradingEnd.toISOString()}`);
    
    // Use ALL of today's data
    const metalPrices = allTodayData;
    console.log(`Using all ${metalPrices.length} records for today`);
    
    // Determine data source for the response
    const dataSource = 'today-all';
    
    // Log the first and last record timestamps if available
    if (metalPrices.length > 0) {
      const firstRecord = metalPrices[0];
      const lastRecord = metalPrices[metalPrices.length - 1];
      console.log(`First record time: ${new Date(firstRecord.createdAt).toISOString()}`);
      console.log(`Last record time: ${new Date(lastRecord.createdAt).toISOString()}`);
    }
    
    // If no data found, return an error
    if (metalPrices.length === 0) {
      // Try to get the most recent 50 records regardless of time
      const recentData = await prisma.metalPrice.findMany({
        where: {
          spotPrice: {
            gt: 0
          }
        },
        select: {
          id: true,
          spotPrice: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50
      });
      
      console.log(`No recent data, retrieved ${recentData.length} historical records`);
      
      if (recentData.length === 0) {
        return res.status(404).json({
          error: 'No data found',
          message: 'No price data found in the database.'
        });
      }
      
      // Reverse the order to have ascending order for the chart
      const sortedData = [...recentData].reverse();
      
      // Format the data
      const formattedData = sortedData.map(item => formatDataPoint(item));
      
      // Calculate stats
      const stats = calculateStats(formattedData);
      
      // Return the data
      return res.status(200).json({
        success: true,
        data: formattedData,
        stats,
        tradingStatus: {
          isWithinTradingHours: false,
          dataSource: 'historical',
          tradingStart: todayTradingStart.toISOString(),
          tradingEnd: todayTradingEnd.toISOString(),
          message: 'Showing historical data (no recent data available)'
        },
        debug: {
          dataSource: 'historical',
          recordCount: recentData.length
        }
      });
    }
    
    // Step 4: Filter to only include data points between trading hours (9:00 to 23:30)
    const filteredData = metalPrices.filter(item => {
      const timestamp = new Date(item.createdAt);
      const hours = timestamp.getUTCHours();
      const minutes = timestamp.getUTCMinutes();
      
      // If it's the end hour (23), only include up to the specified minute (30)
      if (hours === TRADING_END_HOUR) {
        return minutes <= TRADING_END_MINUTE;
      }
      
      return hours >= TRADING_START_HOUR && hours < TRADING_END_HOUR;
    });
    
    console.log(`After time filtering: ${filteredData.length} data points between ${TRADING_START_HOUR}:00 and ${TRADING_END_HOUR}:${TRADING_END_MINUTE}`);
    
    // Format the filtered data
    const formattedData = filteredData.map(item => formatDataPoint(item));
    
    // Calculate stats
    const stats = calculateStats(formattedData);
    
    // Return the data with trading status and debug info
    res.status(200).json({
      success: true,
      data: formattedData,
      stats,
      tradingStatus: {
        isWithinTradingHours,
        dataSource,
        tradingStart: todayTradingStart.toISOString(),
        tradingEnd: todayTradingEnd.toISOString(),
        message: `Showing data between ${TRADING_START_HOUR}:00 and ${TRADING_END_HOUR}:${TRADING_END_MINUTE}`
      },
      debug: {
        dataSource,
        recordCount: metalPrices.length,
        timeRange: {
          start: today.toISOString(),
          end: now.toISOString()
        }
      }
    });
  } catch (error) {
    console.error('Error in LME trends API:', error);
    
    // If we're in development, use mock data instead of failing
    if (process.env.NODE_ENV !== 'production') {
      console.log('Error occurred, using mock data in development environment');
      return res.status(200).json(generateMockLMEData());
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Please try refreshing the data'
    });
  }
}

// Function to generate mock LME data for development environment
function generateMockLMEData(): ApiResponse {
  const today = new Date();
  today.setUTCHours(9, 0, 0, 0); // Start at 9 AM UTC
  
  const data: DataPoint[] = [];
  
  // Generate data points for every 30 minutes from 9 AM to 11:30 PM
  for (let i = 0; i < 30; i++) {
    const pointTime = new Date(today);
    pointTime.setMinutes(today.getUTCMinutes() + i * 30);
    
    // Stop if we reach 11:30 PM
    if (pointTime.getUTCHours() === 23 && pointTime.getUTCMinutes() > 30) {
      break;
    }
    
    // Generate a somewhat realistic price curve with some volatility
    // Base price around 2500 with some up and down movement
    let baseValue = 2500;
    
    // Add a trend during the day (increasing in morning, decreasing in afternoon)
    const hourOfDay = pointTime.getUTCHours();
    if (hourOfDay < 14) {
      // Morning trend up
      baseValue += (hourOfDay - 9) * 15;
    } else {
      // Afternoon trend slightly down
      baseValue += 75 - (hourOfDay - 14) * 5;
    }
    
    // Add some randomness for realism
    const randomVariation = Math.random() * 40 - 20; // +/- $20
    const value = baseValue + randomVariation;
    
    // Format the time for display (using UTC to avoid timezone issues)
    const displayTime = `${pointTime.getUTCHours().toString().padStart(2, '0')}:${pointTime.getUTCMinutes().toString().padStart(2, '0')}`;
    const displayDate = pointTime.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    data.push({
      time: pointTime.toISOString(),
      value: Math.round(value * 100) / 100, // Round to 2 decimal places
      displayTime,
      displayDate
    });
  }
  
  // Calculate stats from the generated data
  const prices = data.map(item => item.value);
  const count = prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((sum, val) => sum + val, 0) / count;
  const startPrice = data[0].value;
  const endPrice = data[data.length - 1].value;
  const totalChange = endPrice - startPrice;
  const totalChangePercent = (totalChange / startPrice) * 100;
  
  const stats: StatsData = {
    count,
    minPrice,
    maxPrice,
    avgPrice,
    startPrice,
    endPrice,
    totalChange,
    totalChangePercent,
  };
  
  // Define trading hours (9:00 AM to 11:30 PM) in UTC
  const TRADING_START_HOUR = 9; // 9:00 AM 
  const TRADING_END_HOUR = 23; // 11:00 PM
  const TRADING_END_MINUTE = 30; // End at 23:30
  
  // Create trading window time objects for the response
  const todayTradingStart = new Date();
  todayTradingStart.setUTCHours(TRADING_START_HOUR, 0, 0, 0);
  
  const todayTradingEnd = new Date();
  todayTradingEnd.setUTCHours(TRADING_END_HOUR, TRADING_END_MINUTE, 0, 0);
  
  return {
    success: true,
    data,
    stats,
    tradingStatus: {
      isWithinTradingHours: true,
      dataSource: 'mock-data',
      tradingStart: todayTradingStart.toISOString(),
      tradingEnd: todayTradingEnd.toISOString(),
      message: 'Using mock data for local development'
    }
  };
}

/**
 * Format a database record into a data point for the chart
 * Uses UTC time values directly to avoid timezone issues
 */
function formatDataPoint(item: { spotPrice: any; createdAt: Date }): DataPoint {
  const price = Number(item.spotPrice);
  const timestamp = new Date(item.createdAt);
  
  // Format time using UTC values directly
  const hours = timestamp.getUTCHours();
  const minutes = timestamp.getUTCMinutes();
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayTime = `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  
  // Format date using UTC values
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = timestamp.getUTCMonth();
  const day = timestamp.getUTCDate();
  const year = timestamp.getUTCFullYear();
  const displayDate = `${monthNames[month]} ${day}, ${year}`;
  
  return {
    time: timestamp.toISOString(),
    value: price,
    displayTime,
    displayDate
  };
}

/**
 * Calculate statistics from the formatted data points
 */
function calculateStats(data: DataPoint[]): StatsData {
  if (data.length === 0) {
    return {
      count: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      startPrice: 0,
      endPrice: 0,
      totalChange: 0,
      totalChangePercent: 0
    };
  }
  
  const prices = data.map(item => item.value);
  const count = prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((sum, val) => sum + val, 0) / count;
  const startPrice = data[0].value;
  const endPrice = data[data.length - 1].value;
  const totalChange = endPrice - startPrice;
  const totalChangePercent = (totalChange / startPrice) * 100;
  
  return {
    count,
    minPrice,
    maxPrice,
    avgPrice,
    startPrice,
    endPrice,
    totalChange,
    totalChangePercent
  };
}
