import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ApiResponse {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  try {
    // Set cache control headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Route handler based on method and action parameter
    if (req.method === 'GET') {
      // Check if this is a scheduler request
      if (req.query.action === 'scheduler') {
        return await handleSchedulerRequest(req, res);
      }
      
      // Check if we have a cache-busting parameter
      if (req.query._t !== undefined) {
        // If we have a cache-busting parameter, recalculate the data
        await calculateAndStoreLMECashSettlement();
      }
      
      // Standard GET request - retrieve LME cash settlements using Prisma client
      const lmeCashData = await prisma.lMECashSettlement.findMany({
        orderBy: {
          date: 'desc'
        }
      });
      
      return res.status(200).json({
        success: true,
        data: lmeCashData
      });
    } else if (req.method === 'POST') {
      // Check if this is a specific data update
      if (req.query.action === 'update-lme-west') {
        return await handleLmeWestUpdate(req, res);
      } else if (req.query.action === 'update-rbi-rate') {
        return await handleRbiRateUpdate(req, res);
      }
      
      // Check if this is a data update notification
      if (req.body?.source === 'rbi_update' || req.body?.source === 'lme_west_update') {
        // Process the new data
        await processNewData();
        
        return res.status(200).json({
          success: true,
          message: `Processed new ${req.body.source} data and updated LME cash settlement if applicable`
        });
      } else {
        // Standard manual calculation
        await calculateAndStoreLMECashSettlement();
        
        return res.status(200).json({
          success: true,
          message: 'LME cash settlement calculated and stored successfully'
        });
      }
    } else if (req.method === 'PUT' && req.query.action === 'check-and-update') {
      // Check for new data in both tables and process if available
      const result = await checkForNewDataAndProcess();
      
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.processed ? { processed: true } : { processed: false }
      });
    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Handle LME West Metal Price updates
 */
async function handleLmeWestUpdate(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Extract data from request body
  const { date, price } = req.body;
  
  if (!date || !price) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: date, price'
    });
  }
  
  // Validate price
  const priceValue = parseFloat(price);
  if (isNaN(priceValue)) {
    return res.status(400).json({
      success: false,
      error: 'Price must be a valid number'
    });
  }
  
  // Create or update LME West Metal Price record
  const lmeWestRecord = await prisma.lME_West_Metal_Price.upsert({
    where: {
      date: date
    },
    update: {
      Price: priceValue
    },
    create: {
      date: date,
      Price: priceValue
    },
    select: {
      id: true,
      date: true,
      Price: true
    }
  });
  
  // Process the update immediately
  await processNewData();
  
  return res.status(200).json({
    success: true,
    message: 'LME West Metal Price updated successfully and calculation triggered',
    data: {
      lmeWestRecord
    }
  });
}

/**
 * Handle RBI Rate updates
 */
async function handleRbiRateUpdate(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Extract data from request body
  const { date, rate } = req.body;
  
  if (!date || !rate) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: date, rate'
    });
  }
  
  // Validate rate
  const rateValue = parseFloat(rate);
  if (isNaN(rateValue)) {
    return res.status(400).json({
      success: false,
      error: 'Rate must be a valid number'
    });
  }
  
  // Create or update RBI Rate record
  const rbiRateRecord = await prisma.rBI_Rate.upsert({
    where: {
      date: date
    },
    update: {
      rate: rateValue
    },
    create: {
      date: date,
      rate: rateValue
    },
    select: {
      id: true,
      date: true,
      rate: true
    }
  });
  
  // Process the update immediately
  await processNewData();
  
  return res.status(200).json({
    success: true,
    message: 'RBI Rate updated successfully and calculation triggered',
    data: {
      rbiRateRecord
    }
  });
}

/**
 * Handle scheduler requests
 */
async function handleSchedulerRequest(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Security check - verify API key
  const correctKey = process.env.SCHEDULER_KEY || 'scheduler-secret-key';
  const apiKey = req.headers['x-api-key'] || req.query.key;
  
  if (!apiKey || apiKey !== correctKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid API key'
    });
  }
  
  // Check for new data and process if available
  const result = await checkForNewDataAndProcess();
  
  return res.status(200).json({
    success: true,
    message: result.message || 'Scheduler check completed',
    data: result.processed ? { processed: true } : { processed: false }
  });
}

/**
 * Processes new data that has been added to one of the source tables
 */
async function processNewData() {
  // Get the latest data from both tables
  const latestLmeWest = await prisma.lME_West_Metal_Price.findFirst({
    orderBy: {
      date: 'desc'
    }
  });
  
  const latestRbi = await prisma.rBI_Rate.findFirst({
    orderBy: {
      date: 'desc'
    }
  });
  
  if (!latestLmeWest || !latestRbi) {
    console.log('Missing latest data from one of the tables, calculation skipped');
    return;
  }
  
  // Extract date part only from the LME West date (ignoring time)
  const lmeWestDateOnly = latestLmeWest.date.split('T')[0];
  
  // Check if we have already processed this combination of data
  const existingCalculation = await prisma.lMECashSettlement.findFirst({
    where: {
      date: {
        startsWith: lmeWestDateOnly
      }
    }
  });
  
  if (existingCalculation) {
    console.log('Calculation for the latest data already exists, no update needed');
    return;
  }
  
  // We have new data in both tables that hasn't been processed yet, calculate
  await calculateAndStoreLMECashSettlement();
}

/**
 * Checks for new data in both source tables and processes it if available
 */
async function checkForNewDataAndProcess() {
  // Get the latest processed date from LMECashSettlement
  const latestProcessed = await prisma.lMECashSettlement.findFirst({
    orderBy: {
      date: 'desc'
    },
    select: {
      date: true
    }
  });
  
  // Get the latest available LME West Metal Price
  const latestLmeWest = await prisma.lME_West_Metal_Price.findFirst({
    orderBy: {
      date: 'desc'
    }
  });
  
  if (!latestLmeWest) {
    return { processed: false, message: 'No LME West Metal Price data available' };
  }
  
  // Compare dates to see if we have new data to process - use only the date part
  const processedDateOnly = latestProcessed ? latestProcessed.date.split('T')[0] : null;
  const lmeWestDateOnly = latestLmeWest.date.split('T')[0];
  
  if (!latestProcessed || processedDateOnly !== lmeWestDateOnly) {
    // We have new data that hasn't been processed yet
    await calculateAndStoreLMECashSettlement();
    return { processed: true, message: 'New data detected and processed' };
  }
  
  return { processed: false, message: 'No new data to process' };
}

/**
 * Returns a date string for the previous business day
 * @param dateStr Input date string in YYYY-MM-DD format
 * @returns Previous business day in YYYY-MM-DD format
 */
function getPreviousBusinessDay(dateStr: string): string {
  const date = new Date(dateStr);
  let dayOfWeek;
  
  // Step back one day initially
  date.setDate(date.getDate() - 1);
  dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  
  // If it's Sunday (0) or Saturday (6), keep stepping back until we get a weekday
  while (dayOfWeek === 0 || dayOfWeek === 6) {
    date.setDate(date.getDate() - 1);
    dayOfWeek = date.getDay();
  }
  
  return date.toISOString().split('T')[0];
}

/**
 * Calculate and store the LME Cash Settlement data
 * Enhanced to strictly follow present/previous day data requirement
 */
async function calculateAndStoreLMECashSettlement() {
  try {
    // Get all LME West Metal Price records ordered by date
    const lmeWestPrices = await prisma.lME_West_Metal_Price.findMany({
      orderBy: {
        date: 'desc'
      }
    });

    if (lmeWestPrices.length < 2) {
      throw new Error('Insufficient data: Need at least two LME West Metal Price records');
    }

    // Get all RBI rate records ordered by date
    const rbiRates = await prisma.rBI_Rate.findMany({
      orderBy: {
        date: 'desc'
      }
    });

    if (rbiRates.length < 1) {
      throw new Error('Insufficient data: Need at least one RBI Rate record');
    }

    // Latest data (today)
    const today_record = lmeWestPrices[0];
    const price_today = Number(today_record.Price);
    const today_date_full = today_record.date;
    const today_date_only = today_date_full.toString().split('T')[0];
    
    // Calculate the expected previous business day
    const expected_previous_date = getPreviousBusinessDay(today_date_only);
    
    console.log(`Processing LME Cash Settlement for ${today_date_only}`);
    console.log(`Expected previous business day: ${expected_previous_date}`);
    
    // Find the RBI rate for today's date (exact match)
    let rbi_today_record = rbiRates.find((rate) => 
      rate.date.toString().split('T')[0] === today_date_only
    );
    
    // If no exact match for today, use the most recent available rate as fallback
    if (!rbi_today_record) {
      // Sort rates by date (newest to oldest)
      const sortedRbiRates = [...rbiRates].sort((a, b) => 
        new Date(b.date.toString()).getTime() - new Date(a.date.toString()).getTime()
      );
      
      // Find the most recent rate that's on or before today
      const todayDate = new Date(today_date_only);
      
      for (const rate of sortedRbiRates) {
        const rbiDate = new Date(rate.date.toString().split('T')[0]);
        if (rbiDate <= todayDate) {
          rbi_today_record = rate;
          const fallback_date = rate.date.toString().split('T')[0];
          console.log(`FALLBACK: Using RBI rate from ${fallback_date} for today's calculation (${today_date_only})`);
          break;
        }
      }
      
      if (!rbi_today_record) {
        throw new Error('Could not find a suitable RBI rate for today');
      }
    }
    
    const rbi_today = Number(rbi_today_record.rate);
    console.log(`Today's RBI rate (${rbi_today_record.date.toString().split('T')[0]}): ${rbi_today}`);

    // Try to find exactly previous business day's LME record first
    let previous_lme_record = lmeWestPrices.find((lme) => 
      lme.date.toString().split('T')[0] === expected_previous_date
    );
    
    // If previous business day not found, get the most recent LME record before today
    if (!previous_lme_record) {
      console.log(`FALLBACK: Previous business day (${expected_previous_date}) LME price not found, searching for most recent previous record`);
      
      // Convert today's date to a Date object for comparison
      const todayDate = new Date(today_date_only);
      
      // Find the most recent record that's before today
      for (const record of lmeWestPrices) {
        const recordDate = new Date(record.date.toString().split('T')[0]);
        if (recordDate < todayDate && record.date.toString().split('T')[0] !== today_date_only) {
          previous_lme_record = record;
          const fallback_date = previous_lme_record.date.toString().split('T')[0];
          console.log(`FALLBACK: Using LME price from ${fallback_date} as previous record`);
          break;
        }
      }
    }
  
    if (!previous_lme_record) {
      throw new Error('Could not find a previous LME West Metal Price record');
    }
  
    const price_previous = Number(previous_lme_record.Price);
    const previous_date_only = previous_lme_record.date.toString().split('T')[0];
    console.log(`Previous LME price (${previous_date_only}): ${price_previous}`);
  
    // Find the RBI rate for the previous LME date (exact match)
    let rbi_previous_record = rbiRates.find((rate) => 
      rate.date.toString().split('T')[0] === previous_date_only
    );
  
    // If no exact match for previous date, find the most recent RBI rate before or on that date
    if (!rbi_previous_record) {
      console.log(`FALLBACK: RBI rate for previous LME date (${previous_date_only}) not found, searching for most recent previous rate`);
      
      // Convert previous LME date to a Date object for comparison
      const previousLmeDate = new Date(previous_date_only);
      
      // Sort RBI rates by date (newest to oldest)
      const sortedRbiRates = [...rbiRates].sort((a, b) => 
        new Date(b.date.toString()).getTime() - new Date(a.date.toString()).getTime()
      );
      
      // Find the most recent RBI rate that's on or before the previous LME date
      for (const rate of sortedRbiRates) {
        const rbiDate = new Date(rate.date.toString().split('T')[0]);
        if (rbiDate <= previousLmeDate) {
          rbi_previous_record = rate;
          const fallback_date = rate.date.toString().split('T')[0];
          console.log(`FALLBACK: Using RBI rate from ${fallback_date} for LME date ${previous_date_only}`);
          break;
        }
      }
    }
    
    if (!rbi_previous_record) {
      throw new Error('Could not find a suitable previous RBI rate');
    }
    
    const rbi_previous = Number(rbi_previous_record.rate);
    console.log(`Previous RBI rate (${rbi_previous_record.date.toString().split('T')[0]}): ${rbi_previous}`);

    // Log the data being used for calculation
    console.log(`Calculation data summary:
      Today(${today_date_only}): LME Price = ${price_today}, RBI Rate = ${rbi_today}
      Previous(${previous_date_only}): LME Price = ${price_previous}, RBI Rate = ${rbi_previous}
    `);

    // Calculate differences
    // Dollar Difference = price_today - price_previous
    const dollarDifference = price_today - price_previous;

    // INR Difference = (price_today × RBI_today × 1.0825) - (price_previous × rbi_previous × 1.0825)
    const inrDifference = (price_today * rbi_today * 1.0825) - (price_previous * rbi_previous * 1.0825);
    
    console.log(`Calculation results:
      Dollar Difference: ${dollarDifference.toFixed(2)}
      INR Difference: ${inrDifference.toFixed(2)}
    `);

    // Check if record for this date already exists (using date part only)
    const existingRecord = await prisma.lMECashSettlement.findFirst({
      where: {
        date: {
          startsWith: today_date_only
        }
      }
    });

    if (existingRecord) {
      // Update existing record
      console.log(`Updating existing LME Cash Settlement record for ${today_date_only}`);
      return await prisma.lMECashSettlement.update({
        where: {
          id: existingRecord.id
        },
        data: {
          price: price_today,
          Dollar_Difference: dollarDifference,
          INR_Difference: inrDifference
        }
      });
    } else {
      // Create new record
      console.log(`Creating new LME Cash Settlement record for ${today_date_only}`);
      return await prisma.lMECashSettlement.create({
        data: {
          date: today_date_full.toString(),
          price: price_today,
          Dollar_Difference: dollarDifference,
          INR_Difference: inrDifference
        }
      });
    }
  } catch (error) {
    console.error('Error in calculateAndStoreLMECashSettlement:', error);
    throw error;
  }
}