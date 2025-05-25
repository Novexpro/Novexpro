// Simple test script to verify if 3_month_mcx.ts is properly storing data
const fetch = require('node-fetch');

async function testMcxEndpoint() {
  try {
    console.log('Testing 3_month_mcx.ts endpoint...');
    
    // First request - should fetch and store new data
    console.log('\n1. Making first request to fetch and store data:');
    const firstResponse = await fetch('http://localhost:3000/api/3_month_mcx');
    const firstData = await firstResponse.json();
    
    console.log('Response status:', firstResponse.status);
    console.log('Success:', firstData.success);
    console.log('Total records in DB:', firstData.pagination.total);
    console.log('First record timestamp:', firstData.data[0]?.timestamp);
    
    // Wait a bit to allow for potential new data
    console.log('\nWaiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Second request - should have potentially new data
    console.log('\n2. Making second request to check for new data:');
    const secondResponse = await fetch('http://localhost:3000/api/3_month_mcx');
    const secondData = await secondResponse.json();
    
    console.log('Response status:', secondResponse.status);
    console.log('Success:', secondData.success);
    console.log('Total records in DB:', secondData.pagination.total);
    console.log('First record timestamp:', secondData.data[0]?.timestamp);
    
    // Compare the results
    if (secondData.pagination.total > firstData.pagination.total) {
      console.log('\n✅ TEST PASSED: New records were added to the database!');
    } else if (firstData.data[0]?.timestamp !== secondData.data[0]?.timestamp) {
      console.log('\n✅ TEST PASSED: Data was updated in the database!');
    } else {
      console.log('\n⚠️ No new data was stored, but this could be normal if:');
      console.log('  - No new data was available from the source API');
      console.log('  - Duplicate detection prevented storing identical data');
      console.log('  - There was an issue connecting to the external API');
    }
    
    // Check the actual data structure
    console.log('\n3. Sample data structure from the database:');
    if (secondData.data[0]) {
      const sample = secondData.data[0];
      console.log(JSON.stringify(sample, null, 2));
    } else {
      console.log('No data available');
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testMcxEndpoint();
