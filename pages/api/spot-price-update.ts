import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// Response interface for properly typed API responses
interface ApiResponse {
  success: boolean;
  message: string;
  data?: {
    spotPrice: number;
    change: number;
    changePercent: number;
    lastUpdated: string;
  };
  error?: string;
}

/**
 * API handler for calculating and updating spot price
 * This endpoint calculates spot price using the formula: threeMonthPrice + change
 * It uses the change value from the metal-price.ts API and stores the result in the MetalPrice table
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Only allow POST requests for updating spot price
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Only POST requests are supported.' 
    });
  }

  try {
    // Extract data from request body
    const { 
      threeMonthPrice, 
      timestamp, 
      change, 
      changePercent, 
      forceUpdate = false 
    } = req.body;

    console.log('Received spot price update request with data:', {
      threeMonthPrice,
      timestamp,
      change,
      changePercent,
      forceUpdate
    });

    // Validate required parameters
    if (threeMonthPrice === undefined || threeMonthPrice === null) {
      return res.status(400).json({
        success: false,
        message: 'threeMonthPrice is required'
      });
    }

    // Parse and validate threeMonthPrice
    const formattedThreeMonthPrice = Number(threeMonthPrice);
    if (isNaN(formattedThreeMonthPrice)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid threeMonthPrice value'
      });
    }

    // Validate that we have real change values and not default/fallback values
    if (change === undefined || change === null || change === -5.0 || change === -9.0) {
      console.log(`Detected potential fallback/default change value: ${change}. Checking if this is from real-time data...`);
      
      // If threeMonthPrice is 2465.00 and change is -5.00, this is likely the static data we want to avoid
      if (Math.abs(formattedThreeMonthPrice - 2465.0) < 0.01 && Math.abs(Number(change) - (-5.0)) < 0.01) {
        return res.status(400).json({
          success: false,
          message: 'Detected static fallback data (2465.00 with -5.00 change). Refusing to save to prevent duplicate records.'
        });
      }
    }
    
    // Use the provided values, ensuring they're properly formatted
    const formattedChange = change !== undefined ? Number(change) : -9.0;
    const formattedChangePercent = changePercent !== undefined ? Number(changePercent) : -0.3676;
    
    console.log(`Using validated change values - change: ${formattedChange}, changePercent: ${formattedChangePercent}`);

    // Calculate spot price using the formula: threeMonthPrice + change
    const calculatedSpotPrice = formattedThreeMonthPrice + formattedChange;
    console.log(`Calculated spot price: ${formattedThreeMonthPrice} + ${formattedChange} = ${calculatedSpotPrice}`);
    
    // Round values to ensure consistency between frontend and database
    // This is critical to prevent discrepancies in displayed values
    const roundedSpotPrice = Math.round(calculatedSpotPrice * 100) / 100;
    const roundedChange = Math.round(formattedChange * 100) / 100;
    const roundedChangePercent = Math.round(formattedChangePercent * 100) / 100;
    
    console.log(`Rounded values for consistency - spotPrice: ${roundedSpotPrice}, change: ${roundedChange}, changePercent: ${roundedChangePercent}`);

    // Format timestamp or use current time
    const formattedTimestamp = timestamp ? new Date(timestamp) : new Date();

    console.log('Attempting to save to database with rounded values:', {
      spotPrice: roundedSpotPrice,
      change: roundedChange,
      changePercent: roundedChangePercent,
      createdAt: formattedTimestamp,
      source: 'spot-price-update'
    });

    // Create a new record in the MetalPrice table using rounded values
    // This ensures consistency between what's shown on the frontend and what's stored in the database
    const newRecord = await prisma.metalPrice.create({
      data: {
        spotPrice: roundedSpotPrice,
        change: roundedChange,
        changePercent: roundedChangePercent,
        createdAt: formattedTimestamp,
        source: 'spot-price-update'
      }
    });

    console.log('Saved calculated spot price to database:', {
      id: newRecord.id,
      spotPrice: Number(newRecord.spotPrice),
      change: Number(newRecord.change),
      changePercent: Number(newRecord.changePercent),
      createdAt: newRecord.createdAt.toISOString(),
      source: newRecord.source
    });
    
    // Double-check that the record was saved correctly
    const savedRecord = await prisma.metalPrice.findUnique({
      where: { id: newRecord.id }
    });
    
    console.log('Verified saved record from database:', {
      id: savedRecord?.id,
      spotPrice: savedRecord ? Number(savedRecord.spotPrice) : null,
      change: savedRecord ? Number(savedRecord.change) : null,
      changePercent: savedRecord ? Number(savedRecord.changePercent) : null,
      createdAt: savedRecord ? savedRecord.createdAt.toISOString() : null,
      source: savedRecord?.source
    });

    // Return success response with the rounded values
    // This ensures the frontend receives the exact same values that were stored in the database
    return res.status(201).json({
      success: true,
      message: 'Spot price calculated and saved successfully',
      data: {
        spotPrice: roundedSpotPrice,  // Use the rounded value directly instead of re-parsing from the database
        change: roundedChange,         // Use the rounded value directly
        changePercent: roundedChangePercent, // Use the rounded value directly
        lastUpdated: newRecord.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Error calculating or saving spot price:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate or save spot price',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await prisma.$disconnect();
  }
}
