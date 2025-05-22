// Test script for metal-price.ts API
const fetch = require('node-fetch');

async function testMetalPrice() {
  console.log('Testing metal-price API...');
  
  try {
    // Test the GET endpoint to fetch the latest price
    const response = await fetch('http://localhost:3000/api/metal-price', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    return result;
  } catch (error) {
    console.error('Error testing metal-price API:', error);
    throw error;
  }
}

// Run the test
testMetalPrice()
  .then(result => {
    console.log('Test completed successfully');
  })
  .catch(error => {
    console.error('Test failed:', error);
  });
