// Test script to verify if price.ts is properly storing data in the database
const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPriceEndpoint() {
  try {
    console.log('Testing price.ts endpoint...');
    
    // Get current count of records in the database
    const initialCount = await prisma.lME_3Month.count();
    console.log(`Initial record count in LME_3Month table: ${initialCount}`);
    
    // First request to the API
    console.log('\n1. Making first request to fetch and store data:');
    const firstResponse = await fetch('http://localhost:3000/api/price');
    const firstData = await firstResponse.json();
    
    console.log('Response status:', firstResponse.status);
    console.log('Price data:', {
      price: firstData.price,
      change: firstData.change,
      changePercent: firstData.changePercent,
      timestamp: firstData.timestamp,
      timeSpan: firstData.timeSpan
    });
    
    // Check if data was stored in the database
    const afterFirstRequestCount = await prisma.lME_3Month.count();
    console.log(`Record count after first request: ${afterFirstRequestCount}`);
    
    if (afterFirstRequestCount > initialCount) {
      console.log('✅ New record was added to the database!');
      
      // Get the latest record
      const latestRecord = await prisma.lME_3Month.findFirst({
        orderBy: { timestamp: 'desc' }
      });
      
      console.log('\nLatest record in database:');
      console.log(latestRecord);
    } else {
      console.log('⚠️ No new record was added. This could be due to:');
      console.log('  - Duplicate detection preventing storage of identical data');
      console.log('  - An error occurred during database operation');
      
      // Check if there's a record with similar data
      const similarRecord = await prisma.lME_3Month.findFirst({
        where: {
          value: {
            gte: firstData.price - 1,
            lte: firstData.price + 1
          }
        },
        orderBy: { timestamp: 'desc' }
      });
      
      if (similarRecord) {
        console.log('\nFound similar record in database:');
        console.log(similarRecord);
      }
    }
    
    // Wait a bit to allow for potential new data
    console.log('\nWaiting 10 seconds before second request...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Second request - should potentially have new data
    console.log('\n2. Making second request to check for new data:');
    const secondResponse = await fetch('http://localhost:3000/api/price');
    const secondData = await secondResponse.json();
    
    console.log('Response status:', secondResponse.status);
    console.log('Price data:', {
      price: secondData.price,
      change: secondData.change,
      changePercent: secondData.changePercent,
      timestamp: secondData.timestamp,
      timeSpan: secondData.timeSpan
    });
    
    // Check if data was stored in the database
    const finalCount = await prisma.lME_3Month.count();
    console.log(`Final record count: ${finalCount}`);
    
    if (finalCount > afterFirstRequestCount) {
      console.log('✅ New record was added after second request!');
    } else {
      console.log('⚠️ No new record was added after second request.');
    }
    
    // Compare the API responses
    if (JSON.stringify(firstData) !== JSON.stringify(secondData)) {
      console.log('\n✅ The API returned different data on second request.');
    } else {
      console.log('\n⚠️ The API returned identical data on both requests.');
      console.log('  - This could be due to caching or no new data from source');
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    // Disconnect from the database
    await prisma.$disconnect();
  }
}

testPriceEndpoint();
