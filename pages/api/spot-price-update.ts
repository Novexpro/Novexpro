import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API request received for /api/spot-price-update');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Test database connection
    try {
      await prisma.$connect();
      console.log('Database connection successful');
    } catch (connectionError) {
      console.error('Database connection failed:', connectionError);
      throw new Error('Failed to connect to database');
    }

    // Get the data from the request body
    const { threeMonthPrice, change: requestChange, changePercent: requestChangePercent } = req.body;
    
    // Validate required fields
    if (!threeMonthPrice) {
      console.error('Missing threeMonthPrice in request body');
      return res.status(400).json({ 
        success: false, 
        message: '3-month price is required' 
      });
    }

    // Parse and validate numeric values
    const formattedThreeMonthPrice = Number(threeMonthPrice);
    if (isNaN(formattedThreeMonthPrice) || formattedThreeMonthPrice <= 0) {
      console.error('Invalid threeMonthPrice:', threeMonthPrice);
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid 3-month price provided' 
      });
    }
    
    // Parse and validate change values
    const change = requestChange !== undefined ? Number(requestChange) : 0;
    const changePercent = requestChangePercent !== undefined ? Number(requestChangePercent) : 0;
    
    if (isNaN(change) || isNaN(changePercent)) {
      console.error('Invalid change values:', { change, changePercent });
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid change values provided' 
      });
    }
    
    console.log('Validated input values:', {
      threeMonthPrice: formattedThreeMonthPrice,
      change,
      changePercent
    });
    
    // Calculate spot price: 3-month price + change
    const calculatedSpotPrice = formattedThreeMonthPrice + change;
    
    console.log('Calculated values:', {
      threeMonthPrice: formattedThreeMonthPrice,
      change,
      calculatedSpotPrice,
      changePercent
    });

    try {
      // Simple duplicate prevention that won't interfere with core functionality
      
      // Get the most recent record with the same spot price
      const mostRecentRecord = await prisma.metalPrice.findFirst({
        where: {
          source: 'spot-price-update',
          spotPrice: {
            equals: new Prisma.Decimal(calculatedSpotPrice)
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      if (mostRecentRecord) {
        console.log('Found record with same spot price:', {
          id: mostRecentRecord.id,
          spotPrice: mostRecentRecord.spotPrice,
          createdAt: mostRecentRecord.createdAt
        });
        
        // Only prevent duplicates if the record was created within the last 5 seconds
        // This prevents rapid duplicates without interfering with normal operation
        const fiveSecondsAgo = new Date(Date.now() - 5 * 1000);
        
        if (mostRecentRecord.createdAt > fiveSecondsAgo) {
          console.log('Record was created within the last 5 seconds, preventing duplicate');
          
          return res.status(200).json({
            success: true,
            message: 'Duplicate prevented: same spot price found within last 5 seconds',
            data: {
              id: mostRecentRecord.id,
              threeMonthPrice: formattedThreeMonthPrice,
              spotPrice: Number(mostRecentRecord.spotPrice),
              change: Number(mostRecentRecord.change),
              changePercent: Number(mostRecentRecord.changePercent),
              createdAt: mostRecentRecord.createdAt,
              source: mostRecentRecord.source
            }
          });
        } else {
          console.log('Record is older than 5 seconds, allowing new entry');
        }
      } else {
        console.log('No previous records found with same spot price');
      }
    
      console.log('Creating new record with values:', {
        spotPrice: calculatedSpotPrice,
        change,
        changePercent,
        source: 'spot-price-update'
      });

      // If no duplicate spot price found, create new record
    const newRecord = await prisma.metalPrice.create({
      data: {
        spotPrice: new Prisma.Decimal(calculatedSpotPrice),
        change: new Prisma.Decimal(change),
        changePercent: new Prisma.Decimal(changePercent),
        source: 'spot-price-update'
      }
    });
    
      console.log('Successfully created new record:', {
        id: newRecord.id,
        spotPrice: newRecord.spotPrice,
        change: newRecord.change,
        changePercent: newRecord.changePercent,
        createdAt: newRecord.createdAt
      });
      
    return res.status(201).json({
      success: true,
        message: 'New spot price saved to database',
      data: {
        id: newRecord.id,
        threeMonthPrice: formattedThreeMonthPrice,
        spotPrice: Number(newRecord.spotPrice),
        change: Number(newRecord.change),
        changePercent: Number(newRecord.changePercent),
        createdAt: newRecord.createdAt,
          source: newRecord.source
        }
      });
    } catch (dbError: unknown) {
      const error = dbError as Error | PrismaClientKnownRequestError;
      console.error('Database operation error:', {
        error,
        message: error.message,
        code: error instanceof PrismaClientKnownRequestError ? error.code : undefined,
        stack: error.stack,
        details: error instanceof PrismaClientKnownRequestError ? error.meta : undefined
      });
      throw new Error(`Database operation failed: ${error.message}`);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error in spot-price-update API:', {
      error: err,
      message: err.message,
      stack: err.stack
    });
    
    // Return detailed error response
    return res.status(500).json({
      success: false,
      message: 'Failed to process spot price update',
      error: err.message
    });
  } finally {
    // Disconnect Prisma client
    try {
    await prisma.$disconnect();
      console.log('Database connection closed successfully');
    } catch (disconnectError) {
      console.error('Error disconnecting from database:', disconnectError);
    }
  }
} 