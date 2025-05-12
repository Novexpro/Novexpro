import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('MCX Month Names API called with query:', req.query);

    // Get the most recent record to determine the current and next month labels
    const latestSnapshot = await prisma.aluminumSnapshot.findFirst({
      orderBy: {
        timestamp: 'desc'
      },
      select: {
        month1Label: true,
        month2Label: true,
        month3Label: true
      }
    });

    if (!latestSnapshot) {
      return res.status(404).json({
        success: false,
        message: 'No aluminum snapshot data found'
      });
    }

    // Extract the month labels
    const currentMonthLabel = latestSnapshot.month1Label;
    const nextMonthLabel = latestSnapshot.month2Label;
    const thirdMonthLabel = latestSnapshot.month3Label;

    // Return the month names
    return res.status(200).json({
      success: true,
      data: {
        currentMonth: currentMonthLabel,
        nextMonth: nextMonthLabel,
        thirdMonth: thirdMonthLabel
      }
    });

  } catch (error) {
    console.error('Error fetching MCX month names:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch MCX month names',
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 