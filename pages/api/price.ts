import { NextApiRequest, NextApiResponse } from 'next';
import { EventSourcePolyfill, MessageEvent } from 'event-source-polyfill';
import { PrismaClient } from '@prisma/client';

interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
  timeSpan: string;
}

// Cache the last successful response
let cachedData: PriceData | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5000; // 5 seconds

// Helper function to parse rate change string
function parseRateChange(rateChangeStr: string): { rateChange: number; rateChangePercent: number } {
  console.log('Parsing rate change string:', rateChangeStr);
  
  // Try first format: "-5.45 ((-0.23%))"
  let match = rateChangeStr.match(/^([-+]?\d+\.?\d*)\s*\(\(([-+]?\d+\.?\d*)%\)\)$/);
  
  if (!match) {
    // Try alternate format: "-5.45 (-0.23%)"
    match = rateChangeStr.match(/^([-+]?\d+\.?\d*)\s*\(([-+]?\d+\.?\d*)%\)$/);
  }
  
  if (!match) {
    console.log('Failed to parse rate change string:', rateChangeStr);
    // Extract just the first number if possible
    const firstNumber = parseFloat(rateChangeStr.split(' ')[0]);
    if (!isNaN(firstNumber)) {
      return { rateChange: firstNumber, rateChangePercent: 0 };
    }
    return { rateChange: 0, rateChangePercent: 0 };
  }
  
  const rateChange = parseFloat(match[1]);
  const rateChangePercent = parseFloat(match[2]);
  
  return { rateChange, rateChangePercent };
}

// Function for direct API call (fallback)
async function fetchFromDataEndpoint(): Promise<PriceData> {
  console.log('Trying direct API call to /data endpoint');
  const response = await fetch('http://148.135.138.22:5007/data', {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  console.log('Data from direct API call:', data);

  if (!data.success || !data.data) {
    throw new Error('Invalid data format from direct API');
  }

  const rawData = data.data;
  const rateChangeData = parseRateChange(rawData['Rate of Change']);

  return {
    price: parseFloat(rawData.Value.replace(/,/g, '')),
    change: rateChangeData.rateChange,
    changePercent: rateChangeData.rateChangePercent,
    timestamp: rawData.Timestamp,
    timeSpan: rawData['Time span']
  };
}

// Function to fetch data from stream
async function fetchFromStream(): Promise<PriceData> {
  console.log('Connecting to stream endpoint...');
  return new Promise((resolve, reject) => {
    try {
      const eventSource = new EventSourcePolyfill('http://148.135.138.22:5007/stream', {
        headers: {
          'Accept': 'text/event-stream'
        }
      });

      // Set a timeout in case the stream doesn't respond
      const timeout = setTimeout(() => {
        console.log('Stream connection timed out');
        eventSource.close();
        reject(new Error('Stream connection timed out'));
      }, 5000);

      eventSource.onopen = () => {
        console.log('Stream connection opened');
      };

      eventSource.onmessage = (event: MessageEvent) => {
        console.log('Received message from stream:', event.data);
        clearTimeout(timeout);
        eventSource.close();
        
        try {
          const data = JSON.parse(event.data);
          
          if (!data.success || !data.data) {
            console.error('Invalid data format from stream API:', data);
            reject(new Error('Invalid data format from stream API'));
            return;
          }
          
          const rawData = data.data;
          const rateChangeData = parseRateChange(rawData['Rate of Change']);
          
          // Process the streaming data
          const processedData: PriceData = {
            price: parseFloat(rawData.Value.replace(/,/g, '')),
            change: rateChangeData.rateChange,
            changePercent: rateChangeData.rateChangePercent,
            timestamp: rawData.Timestamp,
            timeSpan: rawData['Time span']
          };
          
          console.log('Processed data:', processedData);
          resolve(processedData);
        } catch (error) {
          console.error('Error processing stream data:', error);
          eventSource.close();
          reject(error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Stream connection error:', error);
        clearTimeout(timeout);
        eventSource.close();
        reject(error);
      };
    } catch (error) {
      console.error('Error setting up stream connection:', error);
      reject(error);
    }
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('API request received for /api/price');
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check if we have cached data that's still valid
    const now = Date.now();
    if (cachedData && (now - lastFetchTime) < CACHE_DURATION) {
      console.log('Returning cached data');
      return res.status(200).json(cachedData);
    }

    let priceData: PriceData;
    
    // First try to get data from the stream
    try {
      priceData = await fetchFromStream();
      console.log('Successfully fetched data from stream');
    } catch (streamError) {
      console.error('Stream error:', streamError);
      // If stream fails, try the direct data endpoint
      console.log('Falling back to direct data endpoint');
      priceData = await fetchFromDataEndpoint();
    }
    
    // Store in database for analytics and history
    try {
      const prisma = new PrismaClient();
      
      await prisma.lME_3_MetalPrice.create({
        data: {
          rateOfChange: String(priceData.change),
          percentage: priceData.changePercent,
          timeSpan: priceData.timeSpan,
          timestamp: new Date(priceData.timestamp),
          value: priceData.price
        }
      });
      
      console.log('Data stored in database');
      await prisma.$disconnect();
    } catch (dbError) {
      console.error('Error storing data in database:', dbError);
      // Continue even if database storage fails
    }

    // Update cache
    cachedData = priceData;
    lastFetchTime = now;

    // Return the processed data
    return res.status(200).json(priceData);
  } catch (error) {
    console.error('Error fetching price data:', error);
    
    // If we have cached data, return it even if there's an error
    if (cachedData) {
      console.log('Returning cached data due to error');
      return res.status(200).json({
        ...cachedData,
        isCached: true,
        error: 'Using cached data due to API error'
      });
    }

    // If no cached data, use fallback data
    console.log('Using fallback data');
    const fallbackData = {
      price: 2383.15,
      change: -5.45,
      changePercent: -0.23,
      timestamp: new Date().toISOString(),
      timeSpan: "Today",
      isFallback: true,
      error: 'Using fallback data due to API error'
    };

    // Return fallback data
    return res.status(200).json(fallbackData);
  }
} 
