import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { EventSourcePolyfill } from 'event-source-polyfill';

const prisma = new PrismaClient();

interface PriceInfo {
  price: number;
  site_rate_change: string;
}

interface MCXData {
  date: string;
  timestamp: string;
  prices: Record<string, PriceInfo>;
}

// Helper function to validate MCX data structure
function isValidMCXData(data: unknown): data is MCXData {
  if (!data || typeof data !== 'object') return false;
  
  const d = data as Record<string, unknown>;
  
  if (typeof d.date !== 'string' || 
      typeof d.timestamp !== 'string' || 
      !d.prices || 
      typeof d.prices !== 'object') {
    return false;
  }
  
  // Validate prices structure
  for (const [, value] of Object.entries(d.prices)) {
    if (typeof value !== 'object' || !value) return false;
    const priceInfo = value as Record<string, unknown>;
    if (typeof priceInfo.price !== 'number' || 
        typeof priceInfo.site_rate_change !== 'string') {
      return false;
    }
  }
  
  return true;
}

// Helper function to parse rate change string
function parseRateChange(rateChangeStr: string): { rateChange: number; rateChangePercent: number } {
  const match = rateChangeStr.match(/^([-+]?\d+\.?\d*)\s*\(([-+]?\d+\.?\d*)%\)$/);
  
  if (!match) {
    return { rateChange: 0, rateChangePercent: 0 };
  }
  
  const rateChange = parseFloat(match[1]);
  const rateChangePercent = parseFloat(match[2]);
  
  return { rateChange, rateChangePercent };
}

// Helper function to store data in the database
async function storeData(data: MCXData) {
  const date = new Date(data.date);
  const timestamp = new Date(data.timestamp);
  const results = [];

  for (const [contractMonth, priceInfo] of Object.entries(data.prices)) {
    const { rateChange, rateChangePercent } = parseRateChange(priceInfo.site_rate_change);
    
    try {
      const result = await prisma.futuresPrice.upsert({
        where: {
          date_contractMonth: {
            date,
            contractMonth,
          },
        },
        update: {
          timestamp,
          price: priceInfo.price,
          rateChange,
          rateChangePercent,
        },
        create: {
          date,
          timestamp,
          contractMonth,
          price: priceInfo.price,
          rateChange,
          rateChangePercent,
        },
      });
      
      results.push(result);
    } catch (error) {
      console.error(`Error storing data for ${contractMonth}:`, error);
    }
  }

  return results;
}

export async function GET() {
  try {
    // First, try to fetch new data from the external API
    try {
      const eventSource = new EventSourcePolyfill('http://148.135.138.22:5002/stream', {
        headers: {
          'Accept': 'text/event-stream'
        }
      });

      const data = await new Promise<MCXData>((resolve, reject) => {
        const timeout = setTimeout(() => {
          eventSource.close();
          reject(new Error('Timeout waiting for data'));
        }, 5000);

        eventSource.onmessage = (event) => {
          clearTimeout(timeout);
          eventSource.close();
          const parsedData = JSON.parse(event.data);
          if (isValidMCXData(parsedData)) {
            resolve(parsedData);
          } else {
            reject(new Error('Invalid data structure received'));
          }
        };

        eventSource.onerror = () => {
          clearTimeout(timeout);
          eventSource.close();
          reject(new Error('Error connecting to data stream'));
        };
      });

      // Store the new data
      await storeData(data);
    } catch (error) {
      console.error('Error fetching from external API:', error);
      // Continue to fetch from database even if external API fails
    }

    // Get the latest date from the database
    const latestDate = await prisma.futuresPrice.findFirst({
      orderBy: {
        date: 'desc'
      },
      select: {
        date: true
      }
    });

    if (!latestDate) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 });
    }

    // Get all prices for the latest date
    const prices = await prisma.futuresPrice.findMany({
      where: {
        date: latestDate.date
      },
      orderBy: {
        contractMonth: 'asc'
      }
    });

    // Filter to only include current month and next two months
    const currentMonth = new Date().getMonth();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const filteredPrices = prices.filter(price => {
      const contractMonth = price.contractMonth.split(' ')[0]; // Get month name without year
      const monthIndex = months.indexOf(contractMonth);
      
      // Include current month and next two months
      return monthIndex >= currentMonth && monthIndex < currentMonth + 3;
    });

    // Format the data to match the expected structure
    const formattedData = {
      date: latestDate.date.toISOString().split('T')[0],
      time: filteredPrices[0]?.timestamp.toTimeString().split(' ')[0] || '00:00:00',
      timestamp: filteredPrices[0]?.timestamp.toISOString() || new Date().toISOString(),
      prices: filteredPrices.reduce((acc, price) => {
        acc[price.contractMonth] = {
          price: price.price,
          site_rate_change: `${price.rateChange} (${price.rateChangePercent}%)`
        };
        return acc;
      }, {} as Record<string, { price: number; site_rate_change: string }>)
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error in MCX Aluminium API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 