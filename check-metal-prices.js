// Script to check if data is stored in the MetalPrice table
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMetalPrices() {
  try {
    console.log('Checking for records in the MetalPrice table...');
    
    // Get the most recent records from the MetalPrice table
    const recentRecords = await prisma.$queryRaw`
      SELECT * FROM "MetalPrice"
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;
    
    console.log(`Found ${recentRecords.length} recent records:`);
    
    // Display each record in a readable format
    recentRecords.forEach((record, index) => {
      console.log(`\nRecord #${index + 1}:`);
      console.log(`ID: ${record.id}`);
      console.log(`Metal: ${record.metal}`);
      console.log(`Spot Price: ${record.spotPrice}`);
      console.log(`Change: ${record.change}`);
      console.log(`Change Percent: ${record.changePercent}`);
      console.log(`Created At: ${record.createdAt}`);
      console.log(`Source: ${record.source}`);
    });
    
    if (recentRecords.length === 0) {
      console.log('No records found in the MetalPrice table.');
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking MetalPrice records:', error);
    await prisma.$disconnect();
  }
}

checkMetalPrices();
