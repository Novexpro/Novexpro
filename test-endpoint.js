const http = require('http');

console.log('Testing API endpoint with a direct HTTP request...');

// Function to make a GET request to the API
function testEndpoint() {
  console.log('Sending request to http://148.135.138.22:5004/data');
  
  const options = {
    hostname: '148.135.138.22',
    port: 5004,
    path: '/data',
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log('Response Headers:', res.headers);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response received. Data:');
      try {
        const parsedData = JSON.parse(data);
        console.log(JSON.stringify(parsedData, null, 2));
        
        // Test parseRateChange if we have rate change data
        if (parsedData.success && parsedData.data && parsedData.data['Rate of Change']) {
          console.log('\nTesting parseRateChange function:');
          const rateChangeStr = parsedData.data['Rate of Change'];
          console.log(`Raw rate change string: "${rateChangeStr}"`);
          
          // Simplified version of parseRateChange function
          function parseRateChange(str) {
            let match = str.match(/^([-+]?\d+\.?\d*)\s*\(\(([-+]?\d+\.?\d*)%\)\)$/);
            if (!match) {
              match = str.match(/^([-+]?\d+\.?\d*)\s*\(([-+]?\d+\.?\d*)%\)$/);
            }
            
            if (!match) {
              console.log('Failed to parse rate change string');
              const firstNumber = parseFloat(str.split(' ')[0]);
              if (!isNaN(firstNumber)) {
                return { rateChange: firstNumber, rateChangePercent: 0 };
              }
              return { rateChange: 0, rateChangePercent: 0 };
            }
            
            return { 
              rateChange: parseFloat(match[1]), 
              rateChangePercent: parseFloat(match[2])
            };
          }
          
          const result = parseRateChange(rateChangeStr);
          console.log('Parsed values:', result);
        }
      } catch (error) {
        console.error('Error parsing response:', error);
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.end();
}

// Execute the test
testEndpoint(); 