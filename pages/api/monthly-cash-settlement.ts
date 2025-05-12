import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set cache control headers to prevent browser caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  try {
    // Get the month parameter from query, default to current month
    let targetMonth = req.query.month as string;
    let targetYear = req.query.year as string;
    
    // If no month/year specified, use current month and year
    if (!targetMonth || !targetYear) {
      const now = new Date();
      targetMonth = (now.getMonth() + 1).toString(); // JS months are 0-indexed
      targetYear = now.getFullYear().toString();
    }
    
    // Parse month and year as integers
    const month = parseInt(targetMonth, 10);
    const year = parseInt(targetYear, 10);
    
    // Validate month and year
    if (isNaN(month) || month < 1 || month > 12 || isNaN(year)) {
      return res.status(400).json({
        type: 'error',
        message: 'Invalid month or year format. Month should be 1-12, year should be a valid year'
      });
    }
    
    // Create a date representing the first day of the target month
    const monthDate = new Date(year, month - 1, 1); // JS months are 0-indexed
    
    // Calculate the first and last day of the target month
    const firstDay = startOfMonth(monthDate);
    const lastDay = endOfMonth(monthDate);
    
    // Format as ISO strings for database query
    const startDate = format(firstDay, 'yyyy-MM-dd');
    const endDate = format(lastDay, 'yyyy-MM-dd');
    
    // Query the LMECashSettlement records for the specified month
    const settlements = await prisma.lMECashSettlement.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    // Calculate the average price if there are records
    if (settlements.length > 0) {
      // Sum all prices
      const totalPrice = settlements.reduce((sum, record) => sum + record.price, 0);
      // Calculate average
      const averagePrice = totalPrice / settlements.length;
      
      // Format the month name
      const monthName = format(monthDate, 'MMMM yyyy');
      
      return res.status(200).json({
        type: 'averagePrice',
        averagePrice: averagePrice,
        monthName: monthName,
        dataPointsCount: settlements.length,
        month: month,
        year: year
      });
    } else {
      // No data found for the specified month
      return res.status(404).json({
        type: 'noData',
        message: `No cash settlement data available for ${format(monthDate, 'MMMM yyyy')}`
      });
    }
  } catch (error) {
    console.error('Error calculating monthly average cash settlement:', error);
    
    return res.status(500).json({ 
      type: 'error',
      message: "Failed to calculate monthly average cash settlement" 
    });
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
} 