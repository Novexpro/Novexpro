// Test script for spot-price-update.ts API
const fetch = require('node-fetch');

async function testSpotPriceUpdate() {
  console.log('Testing spot-price-update API...');
  
  const testData = {
    threeMonthPrice: 2500,
    change: 10,
    changePercent: 0.4
  };
  
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
