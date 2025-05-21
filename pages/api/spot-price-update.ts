import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API request received for /api/spot-price-update');
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get the data from the request body
    const { threeMonthPrice, timestamp, change: requestChange, changePercent: requestChangePercent } = req.body;
    
    if (!threeMonthPrice || isNaN(Number(threeMonthPrice))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid 3-month price provided' 
      });
    }
    
    // Format input values
    const formattedThreeMonthPrice = Number(threeMonthPrice);
    const formattedDate = new Date(timestamp || new Date());
    
    // Use only the provided change values, no fallbacks
    const change = requestChange !== undefined && !isNaN(Number(requestChange)) ? Number(requestChange) : 0;
    const changePercent = requestChangePercent !== undefined && !isNaN(Number(requestChangePercent)) ? Number(requestChangePercent) : 0;
    
    console.log(`Using provided values - change: ${change}, changePercent: ${changePercent}`);
    
    // Calculate spot price: 3-month price + change
    const calculatedSpotPrice = formattedThreeMonthPrice + change;
    
    console.log(`Calculating spot price: ${formattedThreeMonthPrice} (3-month price) + ${change} (change) = ${calculatedSpotPrice}`);
    
    // Check if this exact price already exists for today (to prevent duplicates)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingRecord = await prisma.metalPrice.findFirst({
      where: {
        source: 'spot-price-update',
        spotPrice: {
          equals: calculatedSpotPrice
        },
        change: {
          equals: change
        },
        createdAt: {
          gte: today
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (existingRecord) {
      console.log('Similar record found - price already exists for today with same change value.');
      
      return res.status(200).json({
        success: true,
        message: 'Price record already exists',
        data: {
          id: existingRecord.id,
          spotPrice: Number(existingRecord.spotPrice),
          change: Number(existingRecord.change),
          changePercent: Number(existingRecord.changePercent),
          createdAt: existingRecord.createdAt,
          source: existingRecord.source || 'spot-price-update'
        }
      });
    }
    
    // Save new record to database
    const newRecord = await prisma.metalPrice.create({
      data: {
        spotPrice: calculatedSpotPrice,
        change: change,
        changePercent: changePercent,
        source: 'spot-price-update'
      }
    });
    
    console.log(`Added new price record: ${calculatedSpotPrice}, using change: ${change}`);
    
    // Return success response with both 3-month and spot prices
    return res.status(201).json({
      success: true,
      message: 'Spot price saved to database',
      data: {
        id: newRecord.id,
        threeMonthPrice: formattedThreeMonthPrice,
        spotPrice: Number(newRecord.spotPrice),
        change: Number(newRecord.change),
        changePercent: Number(newRecord.changePercent),
        createdAt: newRecord.createdAt,
        source: newRecord.source || 'spot-price-update'
      }
    });
  } catch (error) {
    console.error('Error saving spot price to database:', error);
    
    // Return error response
    return res.status(500).json({
      success: false,
      message: 'Failed to save spot price to database',
      error: String(error)
    });
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
} 