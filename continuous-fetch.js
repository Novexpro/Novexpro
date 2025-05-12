const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { EventSourcePolyfill } = require('event-source-polyfill');

const prisma = new PrismaClient();

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

// Helper function to store data in the database
async function storeData(data) {
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
      
      console.log(`Stored/updated data for ${contractMonth}: ${result.price}`);
      results.push(result);
    } catch (error) {
      console.error(`Error storing data for ${contractMonth}:`, error);
    }
  }

  return results;
}

async function fetchAndStoreData() {
  try {
    console.log('Fetching data from API...');
    
    // Set up SSE connection
    const eventSource = new EventSourcePolyfill('http://148.135.138.22:5002/stream', {
      headers: {
        'Accept': 'text/event-stream'
      }
    });

    // Wait for the first message
    const data = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        eventSource.close();
        reject(new Error('Timeout waiting for data'));
      }, 5000); // 5 second timeout

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
    console.log(`Successfully stored ${results.length} records`);
    
    // Check the database to confirm data was stored
    const count = await prisma.futuresPrice.count();
    console.log(`Total records in database: ${count}`);
    
    return results;
  } catch (error) {
    console.error('Error fetching or storing data:', error);
    return null;
  }
}

// Function to run the fetch and store process every minute
async function runContinuousFetch() {
  console.log('Starting continuous data fetch...');
  
  // Initial fetch
  await fetchAndStoreData();
  
  // Set up interval for continuous fetching
  setInterval(async () => {
    await fetchAndStoreData();
  }, 60000); // 60 seconds
}

// Run the continuous fetch
runContinuousFetch().catch(error => {
  console.error('Error in continuous fetch:', error);
  process.exit(1);
}); 