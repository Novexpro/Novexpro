// Simple test script to verify the spot-price-update API functionality
const fetch = require('node-fetch');

async function testSpotPriceAPI() {
  try {
    console.log('Testing spot-price-update API...');
    
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
    
    // Call the spot-price-update API
    console.log('\nCalling spot-price-update API...');
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
    
    // Verify the calculation is correct
    const expectedSpotPrice = testData.threeMonthPrice + testData.change;
    const actualSpotPrice = result.data.spotPrice;
    
    console.log('\nVerifying calculation correctness:');
    console.log('Expected spot price:', expectedSpotPrice);
    console.log('Actual spot price from API:', actualSpotPrice);
    console.log('Calculation is correct:', Math.abs(expectedSpotPrice - actualSpotPrice) < 0.001);
    
    console.log('\nTest completed successfully!');
    
    return {
      success: true,
      apiResponse: result,
      calculationCorrect: Math.abs(expectedSpotPrice - actualSpotPrice) < 0.001
    };
  } catch (error) {
    console.error('Test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
testSpotPriceAPI()
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
