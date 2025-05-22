// Script to check if metal-price records exist in the database
const { PrismaClient } = require('@prisma/client');

async function checkMetalPriceRecords() {
  console.log('Checking for metal-price records in the database...');
  
  const prisma = new PrismaClient();
  
  try {
    // Query MetalPrice table for records with source 'metal-price'
    const metalPriceRecords = await prisma.metalPrice.findMany({
      where: {
        source: 'metal-price'
      },
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log('Recent metal-price records:', metalPriceRecords.length);
    console.log(JSON.stringify(metalPriceRecords, null, 2));
    
    // Get count of records
    const count = await prisma.metalPrice.count({
      where: {
        source: 'metal-price'
      }
    });
    console.log('Total metal-price records:', count);
    
    return { success: true, count, records: metalPriceRecords };
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: error.message };
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed');
  }
}

// Run the check
checkMetalPriceRecords()
  .then(result => {
    if (result.success) {
      console.log('Check completed successfully');
    } else {
      console.error('Check failed:', result.error);
    }
  })
  .catch(error => {
    console.error('Check failed with exception:', error);
  });
