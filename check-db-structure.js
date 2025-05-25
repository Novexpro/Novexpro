// Script to check the database structure
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabaseStructure() {
  try {
    // Get table information from PostgreSQL
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'MetalPrice'
      ORDER BY ordinal_position
    `;
    
    console.log('MetalPrice table structure:');
    console.log(tableInfo);
    
    // Try to get a sample record
    const sampleRecord = await prisma.metalPrice.findFirst();
    console.log('Sample record:', sampleRecord);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error checking database structure:', error);
    await prisma.$disconnect();
  }
}

checkDatabaseStructure();
