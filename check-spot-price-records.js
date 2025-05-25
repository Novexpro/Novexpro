// Script to check records with source "spot-price-update"
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSpotPriceRecords() {
  try {
    console.log('Checking for records with source "spot-price-update"...');
    
    // Get the most recent records with source "spot-price-update"
    const recentRecords = await prisma.$queryRaw`
      SELECT * FROM "MetalPrice"
      WHERE "source" = 'spot-price-update'
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;
    
    console.log(`Found ${recentRecords.length} recent records with source "spot-price-update":`);
    
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
    
    // Also check for records with source "metal-price"
    const metalPriceRecords = await prisma.$queryRaw`
      SELECT * FROM "MetalPrice"
      WHERE "source" = 'metal-price'
      ORDER BY "createdAt" DESC
      LIMIT 5
    `;
    
    console.log(`\nFound ${metalPriceRecords.length} recent records with source "metal-price":`);
    
    // Display each record in a readable format
    metalPriceRecords.forEach((record, index) => {
      console.log(`\nRecord #${index + 1}:`);
      console.log(`ID: ${record.id}`);
      console.log(`Metal: ${record.metal}`);
      console.log(`Spot Price: ${record.spotPrice}`);
      console.log(`Change: ${record.change}`);
      console.log(`Change Percent: ${record.changePercent}`);
      console.log(`Created At: ${record.createdAt}`);
      console.log(`Source: ${record.source}`);
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking records:', error);
    await prisma.$disconnect();
  }
}

checkSpotPriceRecords();
