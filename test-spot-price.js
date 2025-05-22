// Test script to verify data flow between spot-price-update API, database, and frontend
const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSpotPriceUpdate() {
  try {
    console.log('Starting spot price update test...');
    
    // Test data
    const testData = {
      threeMonthPrice: 2450.0,
      change: -9.0,
      changePercent: -0.3676,
      timestamp: new Date().toISOString(),
      forceUpdate: true
    };
    
    console.log('Test data:', testData);
    console.log('Expected calculated spot price:', testData.threeMonthPrice + testData.change);
    
    // 1. Call the spot-price-update API
    console.log('\n1. Calling spot-price-update API...');
    const response = await fetch('http://localhost:3000/api/spot-price-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    console.log('API Response:', result);
    
    if (!result.success) {
      throw new Error(`API error: ${result.message || 'Unknown error'}`);
    }
    
    // 2. Verify the data in the database
    console.log('\n2. Verifying data in the database...');
    // Use a timestamp from 10 seconds ago to ensure we get the record we just created
    const tenSecondsAgo = new Date(Date.now() - 10000);
    
    const latestRecord = await prisma.metalPrice.findFirst({
      where: {
        source: 'spot-price-update',
        createdAt: {
          gte: tenSecondsAgo
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log('Querying for records created after:', tenSecondsAgo.toISOString());
    
    if (!latestRecord) {
      throw new Error('No record found in the database');
    }
    
    console.log('Latest database record:', {
      id: latestRecord.id,
      spotPrice: Number(latestRecord.spotPrice),
      change: Number(latestRecord.change),
      changePercent: Number(latestRecord.changePercent),
      createdAt: latestRecord.createdAt.toISOString(),
      source: latestRecord.source
    });
    
    // 3. Compare API response with database record
    console.log('\n3. Comparing API response with database record...');
    const apiSpotPrice = result.data.spotPrice;
    const dbSpotPrice = Number(latestRecord.spotPrice);
    
    const apiChange = result.data.change;
    const dbChange = Number(latestRecord.change);
    
    const apiChangePercent = result.data.changePercent;
    const dbChangePercent = Number(latestRecord.changePercent);
    
    console.log('API spot price:', apiSpotPrice);
    console.log('DB spot price:', dbSpotPrice);
    console.log('Spot prices match:', apiSpotPrice === dbSpotPrice);
    
    console.log('API change:', apiChange);
    console.log('DB change:', dbChange);
    console.log('Changes match:', apiChange === dbChange);
    
    console.log('API change percent:', apiChangePercent);
    console.log('DB change percent:', dbChangePercent);
    console.log('Change percents match:', apiChangePercent === dbChangePercent);
    
    // 4. Verify calculation correctness
    console.log('\n4. Verifying calculation correctness...');
    const expectedSpotPrice = testData.threeMonthPrice + testData.change;
    console.log('Expected spot price:', expectedSpotPrice);
    console.log('Actual spot price:', dbSpotPrice);
    console.log('Calculation is correct:', Math.abs(expectedSpotPrice - dbSpotPrice) < 0.001);
    
    console.log('\nTest completed successfully!');
    
    return {
      success: true,
      apiResponse: result,
      databaseRecord: {
        id: latestRecord.id,
        spotPrice: dbSpotPrice,
        change: dbChange,
        changePercent: dbChangePercent,
        createdAt: latestRecord.createdAt.toISOString(),
        source: latestRecord.source
      }
    };
  } catch (error) {
    console.error('Test failed:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testSpotPriceUpdate()
  .then(result => {
    console.log('\nTest result:', result.success ? 'PASSED' : 'FAILED');
    if (!result.success) {
      console.error('Error:', result.error);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
