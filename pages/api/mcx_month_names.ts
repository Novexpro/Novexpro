import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('MCX Month Names API called with query:', req.query);

    // Get the most recent record to determine the month labels
    const latestSnapshot = await prisma.mCX_3_Month.findFirst({
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
        message: 'No MCX data found'
      });
    }

    // Extract the month labels
    const currentMonthLabel = latestSnapshot.month1Label;
    const nextMonthLabel = latestSnapshot.month2Label;
    const thirdMonthLabel = latestSnapshot.month3Label;

    // Format the month names for display (e.g., "MCX May")
    const formatMonthName = (label: string) => {
      // If the label is '0', return an empty string
      if (label === '0') {
        return '';
      }
      
      // Extract only the month name without the year
      // The label might be in formats like "May'25" or "May 25"
      const monthMatch = label.match(/^([a-zA-Z]+)/);
      if (monthMatch && monthMatch[1]) {
        return `MCX ${monthMatch[1]}`;
      }
      
      // If we can't extract the month, just return the original label
      return `MCX ${label}`;
    };

    // Format the month names
    const currentMonth = formatMonthName(currentMonthLabel);
    const nextMonth = formatMonthName(nextMonthLabel);
    const thirdMonth = formatMonthName(thirdMonthLabel);

    // Return the formatted month names
    return res.status(200).json({
      success: true,
      data: {
        currentMonth,
        nextMonth,
        thirdMonth,
        rawLabels: {
          currentMonthLabel,
          nextMonthLabel,
          thirdMonthLabel
        }
      }
    });
  } catch (error) {
    console.error('Error fetching MCX month names:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch MCX month names',
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await prisma.$disconnect();
  }
}