const { EventSourcePolyfill } = require('event-source-polyfill');

console.log('Starting stream test...');
console.log('Connecting to http://148.135.138.22:5004/stream');

const eventSource = new EventSourcePolyfill('http://148.135.138.22:5004/stream', {
  headers: {
    'Accept': 'text/event-stream'
  }
});

// Set a timeout to close the connection after 10 seconds
const timeout = setTimeout(() => {
  console.log('Test completed - closing connection after 10 seconds');
  eventSource.close();
  process.exit(0);
}, 10000);

eventSource.onopen = () => {
  console.log('Stream connection opened successfully');
};

eventSource.onmessage = (event) => {
  console.log('Received message from stream:');
  try {
    const data = JSON.parse(event.data);
    console.log(JSON.stringify(data, null, 2));
    
    // Test the parseRateChange function with the received data
    if (data.success && data.data && data.data['Rate of Change']) {
      console.log('\nTesting parseRateChange function:');
      const rateChangeStr = data.data['Rate of Change'];
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
    console.error('Error parsing stream data:', error);
  }
};

eventSource.onerror = (error) => {
  console.error('Stream connection error:', error);
  clearTimeout(timeout);
  eventSource.close();
  process.exit(1);
};

console.log('Waiting for stream data (will close after 10 seconds)...'); 