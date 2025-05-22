// Test script for spot-price-update.ts API with new values
const fetch = require('node-fetch');

async function testSpotPriceUpdate() {
  console.log('Testing spot-price-update API with new values...');
  
  // Use different values to test the spot price calculation
  const testData = {
    threeMonthPrice: 2600,
    change: -15,
    changePercent: -0.58
  };
  
  console.log('Sending test data:', testData);
  console.log('Expected spot price:', testData.threeMonthPrice + testData.change);
  
  try {
    const response = await fetch('http://localhost:3000/api/spot-price-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    // Verify the spot price calculation
    if (result.success && result.data) {
      console.log('Received spot price:', result.data.spotPrice);
      console.log('Calculation correct:', result.data.spotPrice === testData.threeMonthPrice + testData.change);
    }
    
    return result;
  } catch (error) {
    console.error('Error testing spot-price-update API:', error);
    throw error;
  }
}

// Run the test
testSpotPriceUpdate()
  .then(result => {
    console.log('Test completed successfully');
  })
  .catch(error => {
    console.error('Test failed:', error);
  });
