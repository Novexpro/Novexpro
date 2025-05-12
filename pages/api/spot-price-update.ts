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
    // Get the 3-month price from the request body
    const { threeMonthPrice, timestamp } = req.body;
    
    if (!threeMonthPrice || isNaN(Number(threeMonthPrice))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid 3-month price provided' 
      });
    }
    
    // Format input values
    const formattedThreeMonthPrice = Number(threeMonthPrice);
    const formattedDate = new Date(timestamp || new Date());
    
    // Get the previous entry to get the change value
    const previousEntry = await prisma.metalPrice.findFirst({
      where: {
        metal: 'aluminum'
      },
      orderBy: {
        lastUpdated: 'desc'
      }
    });
    
    // Default change values if no previous entry exists
    let change = 0;
    let changePercent = 0;
    
    if (previousEntry) {
      // Use the change from the previous entry
      change = Number(previousEntry.change);
      changePercent = Number(previousEntry.changePercent);
      console.log(`Using change from previous entry: ${change} (${changePercent}%)`);
    } else {
      console.log('No previous entry found, using default change values');
    }
    
    // Calculate spot price: 3-month price + change
    const calculatedSpotPrice = formattedThreeMonthPrice + change;
    
    console.log(`Calculating spot price: ${formattedThreeMonthPrice} (3-month price) + ${change} (change) = ${calculatedSpotPrice}`);
    
    // Check if this exact price already exists for today (to prevent duplicates)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingRecord = await prisma.metalPrice.findFirst({
      where: {
        metal: 'aluminum',
        spotPrice: {
          equals: calculatedSpotPrice
        },
        lastUpdated: {
          gte: today
        }
      },
      orderBy: {
        lastUpdated: 'desc'
      }
    });
    
    if (existingRecord) {
      console.log('Similar record found - price already exists for today. Updating timestamp.');
      
      // Update timestamp of existing record instead of creating duplicate
      const updatedRecord = await prisma.metalPrice.update({
        where: { id: existingRecord.id },
        data: { lastUpdated: formattedDate }
      });
      
      return res.status(200).json({
        success: true,
        message: 'Updated timestamp of existing price record',
        data: {
          id: updatedRecord.id,
          spotPrice: Number(updatedRecord.spotPrice),
          change: Number(updatedRecord.change),
          changePercent: Number(updatedRecord.changePercent),
          lastUpdated: updatedRecord.lastUpdated
        }
      });
    }
    
    // Save new record to database
    const newRecord = await prisma.metalPrice.create({
      data: {
        metal: 'aluminum',
        spotPrice: calculatedSpotPrice,
        change: change,
        changePercent: changePercent,
        lastUpdated: formattedDate
      }
    });
    
    console.log(`Added new price record: ${calculatedSpotPrice}, using change: ${change}, timestamp: ${formattedDate}`);
    
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
        lastUpdated: newRecord.lastUpdated
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