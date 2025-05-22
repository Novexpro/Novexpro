// Test script to check database connection and query MetalPrice table
const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  console.log('Testing database connection...');
  
  const prisma = new PrismaClient();
  
  try {
    // Test connection
    await prisma.$connect();
    console.log('Database connection successful');
    
    // Query MetalPrice table
    const metalPrices = await prisma.metalPrice.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log('Recent MetalPrice records:', metalPrices.length);
    console.log(JSON.stringify(metalPrices, null, 2));
    
    // Get count of records
    const count = await prisma.metalPrice.count();
    console.log('Total MetalPrice records:', count);
    
    return { success: true, count, records: metalPrices };
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: error.message };
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed');
  }
}

// Run the test
testDatabaseConnection()
  .then(result => {
    if (result.success) {
      console.log('Test completed successfully');
    } else {
      console.error('Test failed:', result.error);
    }
  })
  .catch(error => {
    console.error('Test failed with exception:', error);
  });
