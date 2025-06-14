import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { EventSourcePolyfill } from 'event-source-polyfill';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool configuration
  __internal: {
    engine: {
      connectionLimit: 5,
      poolTimeout: 10000,
      idleTimeout: 30000,
    },
  },
});

// Time restriction function
function isWithinOperatingHours() {
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: 'Asia/Kolkata' }));
  
  const currentHour = istTime.getHours();
  const currentDay = istTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Check if it's weekend
  if (currentDay === 0 || currentDay === 6) {
    return { 
      allowed: false, 
      reason: `Weekend (${currentDay === 0 ? 'Sunday' : 'Saturday'})`,
      currentTime: istTime.toISOString()
    };
  }
  
  // Check if within operating hours (6 AM to 6 PM)
  if (currentHour < 6 || currentHour >= 18) {
    return { 
      allowed: false, 
      reason: `Outside operating hours (${currentHour}:00 IST)`,
      currentTime: istTime.toISOString()
    };
  }
  
  return { 
    allowed: true, 
    reason: `Within operating hours (${currentHour}:00 IST)`,
    currentTime: istTime.toISOString()
  };
}

// Helper function to parse rate change string
function parseRateChange(rateChangeStr) {
  const match = rateChangeStr.match(/^([-+]?\d+\.?\d*)\s*\(([-+]?\d+\.?\d*)%\)$/);
  
  if (!match) {
    return { rateChange: 0, rateChangePercent: 0 };
  }
  
  const rateChange = parseFloat(match[1]);
  const rateChangePercent = parseFloat(match[2]);
  
  return { rateChange, rateChangePercent };
}

// Store data function optimized for serverless
async function storeData(data) {
  const date = new Date(data.date);
  const timestamp = new Date(data.timestamp);
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      const operations = [];
      
      for (const [contractMonth, priceInfo] of Object.entries(data.prices)) {
        const { rateChange, rateChangePercent } = parseRateChange(priceInfo.site_rate_change);
        
        operations.push(
          tx.futuresPrice.upsert({
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
          })
        );
      }
      
      return await Promise.all(operations);
    });
    
    return result;
  } catch (error) {
    console.error('Error in batch operation:', error);
    throw error;
  }
}

export async function GET(request) {
  const startTime = Date.now();
  
  try {
    // Check operating hours first
    const timeCheck = isWithinOperatingHours();
    
    if (!timeCheck.allowed) {
      return NextResponse.json({ 
        success: false, 
        message: `Data fetching restricted: ${timeCheck.reason}`,
        currentTime: timeCheck.currentTime,
        operatingHours: {
          start: '06:00 IST',
          end: '18:00 IST',
          days: 'Monday-Friday'
        }
      });
    }
    
    console.log('✅ Within operating hours, fetching data...');
    
    // Fetch data from external API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch('http://148.135.138.22:5002/stream', {
        headers: { 'Accept': 'text/event-stream' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // For SSE, we'll read the first event
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let eventData = '';
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        eventData += chunk;
        
        // Look for complete event
        if (eventData.includes('data: ') && eventData.includes('\n\n')) {
          const dataMatch = eventData.match(/data: (.+?)(?:\n\n|$)/);
          if (dataMatch) {
            const jsonData = JSON.parse(dataMatch[1]);
            
            // Store the data
            const results = await storeData(jsonData);
            
            const processingTime = Date.now() - startTime;
            
            return NextResponse.json({ 
              success: true, 
              message: `Data fetched and stored successfully`,
              recordsStored: results.length,
              processingTime: `${processingTime}ms`,
              timestamp: new Date().toISOString(),
              operatingStatus: timeCheck.reason
            });
          }
        }
        
        attempts++;
      }
      
      reader.releaseLock();
      throw new Error('No valid data received from stream');
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout - external API took too long to respond');
      }
      throw fetchError;
    }
    
  } catch (error) {
    console.error('Error in fetch-data API:', error);
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
    
  } finally {
    await prisma.$disconnect();
  }
}

// Optional: Add POST method for manual triggers
export async function POST(request) {
  // Optional: Add authentication
  const cronSecret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Same logic as GET
  return GET(request);
} 