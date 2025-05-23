import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

// Use type assertion to ensure TypeScript recognizes the getquote model
const prisma = new PrismaClient() as PrismaClient & {
  getquote: {
    findFirst: (args: any) => Promise<any>,
    findMany: (args: any) => Promise<any[]>
  }
};

interface ApiResponse {
  success: boolean;
  data?: {
    [key: string]: {
      stockName: string;
      priceChange: number;
      timestamp: string;
    } | null;
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Define companies with both display names and database names
    const companies = [
      { display: 'Hindalco', db: 'Hindalco' },
      { display: 'Vedanta', db: 'Vedanta' },
      { display: 'NALCO', db: 'Nalco' }
    ];
    const result: { [key: string]: any } = {};

    // Fetch the latest entry for each company
    for (const company of companies) {
      const latestEntry = await prisma.getquote.findFirst({
        where: {
          stockName: company.db
        },
        orderBy: {
          timestamp: 'desc'
        },
        select: {
          stockName: true,
          priceChange: true,
          timestamp: true
        }
      });

      // Store using the display name as the key
      result[company.display] = latestEntry;
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching latest quotes:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch latest quotes'
    });
  } finally {
    await prisma.$disconnect();
  }
}
