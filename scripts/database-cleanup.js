const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

// Configuration for data retention
const RETENTION_CONFIG = {
  // Keep data for only 30 days
  DAYS_TO_KEEP: 30,
  // Archive data before deletion (optional)
  ENABLE_ARCHIVAL: true,
  ARCHIVE_DIR: './data-archive',
  // Batch size for deletions to avoid timeouts
  BATCH_SIZE: 1000
};

// Helper function to create archive directory
async function ensureArchiveDir() {
  if (RETENTION_CONFIG.ENABLE_ARCHIVAL) {
    try {
      await fs.mkdir(RETENTION_CONFIG.ARCHIVE_DIR, { recursive: true });
    } catch (error) {
      console.error('Error creating archive directory:', error);
    }
  }
}

// Archive data before deletion
async function archiveData(tableName, data) {
  if (!RETENTION_CONFIG.ENABLE_ARCHIVAL || !data.length) return;
  
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${tableName}-${timestamp}.json`;
    const filepath = path.join(RETENTION_CONFIG.ARCHIVE_DIR, filename);
    
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    console.log(`📁 Archived ${data.length} records to ${filename}`);
  } catch (error) {
    console.error(`Error archiving ${tableName} data:`, error);
  }
}

// Clean old data from a specific model
async function cleanOldData(model, tableName, dateField = 'createdAt') {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_CONFIG.DAYS_TO_KEEP);
  
  console.log(`🧹 Cleaning ${tableName} data older than ${cutoffDate.toISOString()}`);
  
  try {
    // First, get the data to be deleted for archival
    const oldData = await model.findMany({
      where: {
        [dateField]: {
          lt: cutoffDate
        }
      }
    });
    
    if (oldData.length === 0) {
      console.log(`✅ No old data found in ${tableName}`);
      return 0;
    }
    
    // Archive the data
    await archiveData(tableName, oldData);
    
    // Delete old data in batches
    let totalDeleted = 0;
    const totalToDelete = oldData.length;
    
    for (let i = 0; i < totalToDelete; i += RETENTION_CONFIG.BATCH_SIZE) {
      const batch = oldData.slice(i, i + RETENTION_CONFIG.BATCH_SIZE);
      const ids = batch.map(item => item.id);
      
      const deleteResult = await model.deleteMany({
        where: {
          id: {
            in: ids
          }
        }
      });
      
      totalDeleted += deleteResult.count;
      console.log(`🗑️  Deleted batch ${Math.ceil((i + 1) / RETENTION_CONFIG.BATCH_SIZE)} - ${deleteResult.count} records from ${tableName}`);
    }
    
    console.log(`✅ Total deleted from ${tableName}: ${totalDeleted} records`);
    return totalDeleted;
    
  } catch (error) {
    console.error(`❌ Error cleaning ${tableName}:`, error);
    return 0;
  }
}

// Main cleanup function
async function performDatabaseCleanup() {
  console.log('🚀 Starting database cleanup...');
  console.log(`📅 Keeping data from last ${RETENTION_CONFIG.DAYS_TO_KEEP} days`);
  
  await ensureArchiveDir();
  
  let totalDeleted = 0;
  
  try {
    // Clean different tables based on your schema
    const cleanupTasks = [
      { model: prisma.mCX_3_Month, name: 'MCX_3_Month', dateField: 'createdAt' },
      { model: prisma.metalPrice, name: 'MetalPrice', dateField: 'createdAt' },
      { model: prisma.lME_3Month, name: 'LME_3Month', dateField: 'createdAt' },
      { model: prisma.sBITTRate, name: 'SBITTRate', dateField: 'createdAt' },
      { model: prisma.rBI_Rate, name: 'RBI_Rate', dateField: 'createdAt' },
      { model: prisma.lMECashSettlement, name: 'LMECashSettlement', dateField: 'createdAt' },
      { model: prisma.lME_West_Metal_Price, name: 'LME_West_Metal_Price', dateField: 'createdAt' },
      { model: prisma.getquote, name: 'getquote' }
    ];
    
    for (const task of cleanupTasks) {
      if (task.model) {
        const deleted = await cleanOldData(task.model, task.name, task.dateField);
        totalDeleted += deleted;
      }
    }
    
    // Run VACUUM to reclaim space (PostgreSQL specific)
    console.log('🔧 Running database optimization...');
    await prisma.$executeRaw`VACUUM ANALYZE;`;
    
    console.log(`✅ Database cleanup completed! Total records deleted: ${totalDeleted}`);
    
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Database statistics function
async function getDatabaseStats() {
  try {
    console.log('📊 Database Statistics:');
    
    const stats = await Promise.allSettled([
      prisma.mCX_3_Month.count(),
      prisma.metalPrice.count(),
      prisma.lME_3Month.count(),
      prisma.sBITTRate.count(),
      prisma.rBI_Rate.count(),
      prisma.lMECashSettlement.count(),
      prisma.lME_West_Metal_Price.count(),
      prisma.getquote.count()
    ]);
    
    const tables = ['MCX_3_Month', 'MetalPrice', 'LME_3Month', 'SBITTRate', 'RBI_Rate', 'LMECashSettlement', 'LME_West_Metal_Price', 'getquote'];
    
    stats.forEach((stat, index) => {
      if (stat.status === 'fulfilled') {
        console.log(`  ${tables[index]}: ${stat.value} records`);
      }
    });
    
  } catch (error) {
    console.error('Error getting database stats:', error);
  }
}

// CLI handling
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'cleanup':
      performDatabaseCleanup();
      break;
    case 'stats':
      getDatabaseStats().then(() => prisma.$disconnect());
      break;
    default:
      console.log('Usage: node database-cleanup.js [cleanup|stats]');
      console.log('  cleanup - Remove old data and optimize database');
      console.log('  stats   - Show database statistics');
      process.exit(1);
  }
}

module.exports = {
  performDatabaseCleanup,
  getDatabaseStats,
  cleanOldData
}; 