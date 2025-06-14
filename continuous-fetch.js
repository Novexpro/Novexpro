const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { EventSourcePolyfill } = require('event-source-polyfill');

const prisma = new PrismaClient();

// Configuration for time restrictions
const OPERATING_HOURS = {
  START_HOUR: 6, // 6 AM
  END_HOUR: 24,  // 11:59 PM (23:59 hours, using 24 to include up to 23:59)
  TIMEZONE: 'Asia/Kolkata'
};

// Helper function to check if current time is within operating hours
function isWithinOperatingHours() {
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: OPERATING_HOURS.TIMEZONE }));
  
  const currentHour = istTime.getHours();
  const currentDay = istTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Check if it's weekend (Saturday = 6, Sunday = 0)
  if (currentDay === 0 || currentDay === 6) {
    console.log(`⏰ Skipping data storage - Weekend (${currentDay === 0 ? 'Sunday' : 'Saturday'})`);
    return false;
  }
  
  // Check if within operating hours (6 AM to 11:59 PM on weekdays)
  if (currentHour < OPERATING_HOURS.START_HOUR || currentHour >= OPERATING_HOURS.END_HOUR) {
    console.log(`⏰ Skipping data storage - Outside operating hours (${currentHour}:00 IST)`);
    return false;
  }
  
  console.log(`✅ Within operating hours - ${currentHour}:00 IST on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDay]}`);
  return true;
}

// Helper function to batch operations to reduce database connections
async function batchStoreData(dataArray) {
  if (!dataArray.length) return [];
  
  const batchSize = 10; // Process in batches of 10
  const results = [];
  
  for (let i = 0; i < dataArray.length; i += batchSize) {
    const batch = dataArray.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(data => storeData(data))
    );
    
    results.push(...batchResults.filter(r => r.status === 'fulfilled').map(r => r.value));
  }
  
  return results.flat();
}

// Helper function to parse rate change string
function parseRateChange(rateChangeStr) {
  // Format: "-0.4 (-0.17%)"
  const match = rateChangeStr.match(/^([-+]?\d+\.?\d*)\s*\(([-+]?\d+\.?\d*)%\)$/);
  
  if (!match) {
    return { rateChange: 0, rateChangePercent: 0 };
  }
  
  const rateChange = parseFloat(match[1]);
  const rateChangePercent = parseFloat(match[2]);
  
  return { rateChange, rateChangePercent };
}

// Helper function to store data in the database with connection pooling optimization
async function storeData(data) {
  const date = new Date(data.date);
  const timestamp = new Date(data.timestamp);
  const results = [];

  // Use transaction to reduce database round trips
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
    
    console.log(`📦 Batch stored/updated ${result.length} records`);
    return result;
  } catch (error) {
    console.error(`❌ Error in batch operation:`, error);
    return [];
  }
}

async function fetchAndStoreData() {
  try {
    // Check if we should operate during this time
    if (!isWithinOperatingHours()) {
      return null; // Skip data storage
    }
    
    console.log('📡 Fetching data from API...');
    
    // Set up SSE connection with shorter timeout to reduce compute usage
    const eventSource = new EventSourcePolyfill('http://148.135.138.22:5002/stream', {
      headers: {
        'Accept': 'text/event-stream'
      }
    });

    // Reduced timeout to 3 seconds to minimize compute usage
    const data = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        eventSource.close();
        reject(new Error('Timeout waiting for data'));
      }, 3000); // Reduced from 5 seconds to 3 seconds

      eventSource.onmessage = (event) => {
        clearTimeout(timeout);
        eventSource.close();
        resolve(JSON.parse(event.data));
      };

      eventSource.onerror = () => {
        clearTimeout(timeout);
        eventSource.close();
        reject(new Error('Error connecting to data stream'));
      };
    });

    // Store the received data
    const results = await storeData(data);
    console.log(`✅ Successfully stored ${results.length} records`);
    
    return results;
  } catch (error) {
    console.error('❌ Error fetching or storing data:', error);
    return null;
  }
}

// Function to run the fetch and store process with dynamic intervals
async function runContinuousFetch() {
  console.log('🚀 Starting time-restricted continuous data fetch...');
  console.log(`⚙️  Operating Hours: ${OPERATING_HOURS.START_HOUR}:00 - 23:59 IST (Monday-Friday only)`);
  
  // Function to calculate next check interval
  function getNextInterval() {
    if (isWithinOperatingHours()) {
      return 60000; // 1 minute during operating hours
    } else {
      return 300000; // 5 minutes during off hours (just to check time)
    }
  }
  
  // Initial fetch
  await fetchAndStoreData();
  
  // Dynamic interval based on operating hours
  function scheduleNext() {
    const interval = getNextInterval();
    setTimeout(async () => {
      await fetchAndStoreData();
      scheduleNext(); // Schedule the next execution
    }, interval);
  }
  
  scheduleNext();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 Gracefully shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Gracefully shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

// Run the continuous fetch
runContinuousFetch().catch(async (error) => {
  console.error('💥 Error in continuous fetch:', error);
  await prisma.$disconnect();
  process.exit(1);
}); 