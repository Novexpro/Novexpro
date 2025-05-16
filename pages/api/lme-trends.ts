import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
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
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Get timestamps for current and previous trading windows
    const now = new Date();
    
    // Create today's date
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    // Create yesterday's date
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Set trading window times
    const todayStart = new Date(today);
    todayStart.setHours(9, 0, 0, 0);
    
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 30, 0, 0);

    // Previous day's trading window
    const yesterdayStart = new Date(yesterday);
    yesterdayStart.setHours(9, 0, 0, 0);
    
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 30, 0, 0);
    
    // Check if we're within trading hours
    const isWithinTradingHours = now >= todayStart && now <= todayEnd;
    const isBeforeTradingHours = now < todayStart;

    // Determine which trading window to use
    let queryStartTime = todayStart;
    let queryEndTime = todayEnd;

    if (!isWithinTradingHours) {
      if (isBeforeTradingHours) {
        // Before 9 AM, show yesterday's data
        queryStartTime = yesterdayStart;
        queryEndTime = yesterdayEnd;
      } else {
        // After 11:30 PM, show today's data
        queryStartTime = todayStart;
        queryEndTime = todayEnd;
      }
    }

    // Find aluminum data for the appropriate trading window
    const metalPrices = await prisma.metalPrice.findMany({
      where: {
        metal: 'aluminum',
        spotPrice: {
          gt: 0
        },
        lastUpdated: {
          gte: queryStartTime,
          lte: queryEndTime
        }
      },
      select: {
        metal: true,
        spotPrice: true,
        change: true,
        changePercent: true,
        lastUpdated: true, // This will be in UTC from the database
        createdAt: true,
        source: true
      },
      orderBy: {
        lastUpdated: 'asc'
      },
      take: 500
    });

    console.log(`Found ${metalPrices.length} price records for Aluminium`);
    
    if (!metalPrices || metalPrices.length === 0) {
      // Get available metals for error message
      const availableMetals = await prisma.metalPrice.groupBy({
        by: ['metal'],
        where: {
          spotPrice: {
            gt: 0
          }
        }
      });

      const timeMessage = isWithinTradingHours
        ? 'Current trading session'
        : isBeforeTradingHours
          ? 'Previous day\'s trading session (new session starts at 9:00 AM)'
          : 'Today\'s trading session (closed at 11:30 PM)';

      return res.status(404).json({ 
        error: 'No data found',
        message: `No aluminum price data found for ${timeMessage}. Available metals: ${availableMetals.map(m => m.metal).join(', ')}`
      });
    }
    
    // Calculate stats
    const prices = metalPrices.map(item => Number(item.spotPrice));
    const count = prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, val) => sum + val, 0) / count;
    const startPrice = Number(metalPrices[0].spotPrice);
    const endPrice = Number(metalPrices[metalPrices.length - 1].spotPrice);
    const totalChange = endPrice - startPrice;
    const totalChangePercent = (totalChange / startPrice) * 100;
    
    // Convert UTC to Indian Standard Time (IST = UTC+5:30) and format for chart
    const formattedData = metalPrices.map(item => {
      const price = Number(item.spotPrice);
      const utcDate = new Date(item.lastUpdated);
      
      // IST is UTC+5:30
      const istOffsetMinutes = 5 * 60 + 30; // 5 hours and 30 minutes in minutes
      
      // Create a new date with the IST time
      const istDate = new Date(utcDate.getTime() + (istOffsetMinutes * 60000));
      
      // Format time in 12-hour format with AM/PM
      const hours = istDate.getHours();
      const minutes = istDate.getMinutes();
      const hour12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayTime = `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm} IST`;
      
      // Format date
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = istDate.getMonth();
      const day = istDate.getDate();
      const year = istDate.getFullYear();
      const displayDate = `${monthNames[month]} ${day}, ${year}`;
      
      return {
        time: utcDate.toISOString(), // Keep the original UTC time for reference
        value: price,
        metal: item.metal,
        displayTime: displayTime, // Pre-formatted IST time string
        displayDate: displayDate, // Pre-formatted date string
        istTimestamp: istDate.toISOString() // IST timestamp for sorting if needed
      };
    });
    
    // Return the data
    res.status(200).json({
      data: formattedData,
      stats: {
        count,
        minPrice,
        maxPrice,
        avgPrice,
        startPrice,
        endPrice,
        totalChange,
        totalChangePercent,
      },
      metal: metalPrices[0].metal // Use the actual metal name from the data
    });
    
  } catch (error) {
    console.error('Error fetching metal price trends:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}