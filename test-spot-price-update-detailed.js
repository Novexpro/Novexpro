// Detailed test script for spot-price-update.ts API
const fetch = require('node-fetch');

async function testSpotPriceUpdate() {
  console.log('Testing spot-price-update API with detailed logging...');
  
  // Use a different test value each time to avoid duplicate detection
  const randomChange = Math.floor(Math.random() * 20) - 10; // Random number between -10 and 10
  
  const testData = {
    threeMonthPrice: 2500 + Math.floor(Math.random() * 10), // Random base price
    change: randomChange,
    changePercent: (randomChange / 2500 * 100).toFixed(2)
  };
  
  console.log('Sending test data:', testData);
  
  try {
    const response = await fetch('http://localhost:3000/api/spot-price-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    let responseText;
    try {
      responseText = await response.text();
      console.log('Raw response:', responseText);
      
      const result = JSON.parse(responseText);
      console.log('Response status:', response.status);
      console.log('Response body:', JSON.stringify(result, null, 2));
      
      return result;
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      console.log('Raw response text:', responseText);
      throw new Error('Failed to parse response');
    }
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
