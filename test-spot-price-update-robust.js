// Robust test script for spot-price-update.ts API with better error handling
const fetch = require('node-fetch');

async function testSpotPriceUpdate() {
  console.log('Testing spot-price-update API with robust error handling...');
  
  // Use a different test value each time to avoid duplicate detection
  const randomChange = Math.floor(Math.random() * 20) - 10; // Random number between -10 and 10
  
  const testData = {
    threeMonthPrice: 2500 + Math.floor(Math.random() * 10), // Random base price
    change: randomChange,
    changePercent: (randomChange / 2500 * 100).toFixed(2),
    timestamp: new Date().toISOString()
  };
  
  console.log('Sending test data:', testData);
  
  // Check if server is running first
  try {
    console.log('Checking if Next.js server is running...');
    await checkServerStatus();
    console.log('Server is running, proceeding with test');
  } catch (error) {
    console.error('Server check failed:', error.message);
    console.log('\nIMPORTANT: Please start the Next.js development server with:');
    console.log('npm run dev\n');
    process.exit(1);
  }
  
  try {
    const response = await fetch('http://localhost:3000/api/spot-price-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData),
      // Add timeout to prevent hanging
      timeout: 10000
    });
    
    let responseText;
    try {
      responseText = await response.text();
      console.log('Raw response:', responseText);
      
      const result = JSON.parse(responseText);
      console.log('Response status:', response.status);
      console.log('Response body:', JSON.stringify(result, null, 2));
      
      // Validate the response
      if (result.success) {
        console.log('✅ Test PASSED: API returned success response');
        
        // Check if data was saved or skipped due to duplicate prevention
        if (result.skipped) {
          console.log('ℹ️ Note: Data was not saved due to duplicate prevention');
          console.log('Reason:', result.reason);
        } else {
          console.log('✅ New data was successfully saved to database');
        }
        
        // Validate data structure
        if (result.data && result.data.spotPrice) {
          console.log('✅ Response contains valid spot price data');
        } else {
          console.log('⚠️ Warning: Response data structure is unexpected');
        }
      } else {
        console.log('❌ Test FAILED: API returned error response');
        console.log('Error:', result.message);
      }
      
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

// Helper function to check if the server is running
async function checkServerStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('http://localhost:3000/api/health', {
      method: 'GET',
      signal: controller.signal
    }).catch(error => {
      // Try alternative endpoint if health endpoint doesn't exist
      return fetch('http://localhost:3000', {
        method: 'GET',
        signal: controller.signal
      });
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    throw new Error('Next.js server is not running');
  }
}

// Run the test
testSpotPriceUpdate()
  .then(result => {
    console.log('Test completed successfully');
  })
  .catch(error => {
    console.error('Test failed:', error.message);
    
    // Provide helpful error messages based on error type
    if (error.code === 'ECONNREFUSED') {
      console.log('\nERROR: Connection refused. Make sure the Next.js server is running with:');
      console.log('npm run dev\n');
    } else if (error.type === 'request-timeout') {
      console.log('\nERROR: Request timed out. The server might be overloaded or unresponsive.\n');
    }
  });
