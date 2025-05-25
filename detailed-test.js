// Detailed test script to see exactly what data is coming from the API
const fetch = require('node-fetch');

async function testMetalPriceApi() {
  try {
    console.log('Testing metal-price API endpoint with detailed logging...');
    
    // Call the metal-price API endpoint
    const response = await fetch('http://localhost:3000/api/metal-price', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    // Now let's directly check what the external API is returning
    const backendUrl = process.env.BACKEND_URL || 'http://148.135.138.22:3232';
    const apiEndpoint = `${backendUrl}/api/price-data`;
    
    console.log(`\nDirectly checking external API at: ${apiEndpoint}`);
    
    try {
      const externalResponse = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (externalResponse.ok) {
        const externalData = await externalResponse.text();
        try {
          const parsedData = JSON.parse(externalData);
          console.log('External API raw response:', JSON.stringify(parsedData, null, 2));
        } catch (parseError) {
          console.log('External API raw response (not JSON):', externalData);
        }
      } else {
        console.log(`External API returned status: ${externalResponse.status}`);
      }
    } catch (externalError) {
      console.error('Error fetching from external API directly:', externalError);
    }
    
    return data;
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

// Run the test
testMetalPriceApi();
