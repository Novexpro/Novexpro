import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define LME Cash Settlement data interface
interface LMECashSettlementData {
  id: number;
  date: string;
  price: number;
  Dollar_Difference: number;
  INR_Difference: number;
  createdAt: Date;
  updatedAt: Date;
}

// Define response types
interface SuccessResponse {
  success: true;
  data: LMECashSettlementData | LMECashSettlementData[];
}

interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
}

type ApiResponse = SuccessResponse | ErrorResponse;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  // Set cache control headers to prevent browser caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

    // Get the limit parameter (default to 10)
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    
    // Get date parameter for specific date query
    const date = req.query.date as string | undefined;
    
    // Validate limit
    if (isNaN(limit) || limit <= 0 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter. Must be a number between 1 and 100.'
      });
    }

    // Query based on whether we have a date parameter
    let lmeSettlementData;
    
    if (date) {
      // If date is provided, fetch specific date
      lmeSettlementData = await prisma.lMECashSettlement.findUnique({
        where: {
          date: date
        }
      });
      
      if (!lmeSettlementData) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: `No LME Cash Settlement data found for date: ${date}`
        });
      }
    } else {
      // If no date, fetch latest records
      lmeSettlementData = await prisma.lMECashSettlement.findMany({
        orderBy: {
          date: 'desc'
        },
        take: limit
      });
      
      // Check if we have any data
      if (!lmeSettlementData || lmeSettlementData.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'No LME Cash Settlement data found'
        });
      }
    }

    // Validate data before returning
    const validateData = (data: any): data is LMECashSettlementData => {
      if (!data) return false;
      return (
        typeof data.id === 'number' &&
        typeof data.date === 'string' &&
        typeof data.price === 'number' &&
        typeof data.Dollar_Difference === 'number' &&
        typeof data.INR_Difference === 'number'
      );
    };

    const validateArrayData = (data: any[]): data is LMECashSettlementData[] => {
      return Array.isArray(data) && data.every(validateData);
    };

    // Perform validation
    if (Array.isArray(lmeSettlementData)) {
      if (!validateArrayData(lmeSettlementData)) {
        return res.status(500).json({
          success: false,
          error: 'Data validation failed',
          message: 'The data retrieved from the database has an invalid format'
        });
      }
    } else {
      if (!validateData(lmeSettlementData)) {
        return res.status(500).json({
          success: false,
          error: 'Data validation failed',
          message: 'The data retrieved from the database has an invalid format'
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: lmeSettlementData
    });
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