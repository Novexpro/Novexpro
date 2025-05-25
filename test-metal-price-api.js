// Simple script to test the metal-price API endpoint
const fetch = require('node-fetch');

async function testMetalPriceApi() {
  try {
    console.log('Testing metal-price API endpoint...');
    
    // Call the metal-price API endpoint
    const response = await fetch('http://localhost:3000/api/metal-price', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

// Run the test
testMetalPriceApi();
