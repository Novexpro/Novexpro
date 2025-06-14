const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Configuration for monitoring
const MONITOR_CONFIG = {
  LOG_FILE: './logs/db-usage.log',
  STATS_FILE: './logs/db-stats.json',
  CHECK_INTERVAL: 300000, // 5 minutes
  MAX_LOG_SIZE: 10 * 1024 * 1024, // 10MB
};

// Helper function to ensure log directory exists
async function ensureLogDir() {
  try {
    await fs.mkdir('./logs', { recursive: true });
  } catch (error) {
    console.error('Error creating logs directory:', error);
  }
}

// Log database operations with timestamp
async function logOperation(operation, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    operation,
    ...details,
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    await fs.appendFile(MONITOR_CONFIG.LOG_FILE, logLine);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

// Get current database statistics
async function getCurrentStats() {
  try {
    const stats = {
      timestamp: new Date().toISOString(),
      tables: {},
      totalRecords: 0,
      operatingHours: {
        current: isWithinOperatingHours(),
        startHour: 6,
        endHour: 18,
        weekdaysOnly: true
      }
    };
    
    // Count records in each table
    const tableCounts = await Promise.allSettled([
      prisma.mCX_3_Month.count().then(count => ({ name: 'MCX_3_Month', count })),
      prisma.metalPrice.count().then(count => ({ name: 'MetalPrice', count })),
      prisma.lME_3Month.count().then(count => ({ name: 'LME_3Month', count })),
      prisma.sBITTRate.count().then(count => ({ name: 'SBITTRate', count })),
      prisma.rBI_Rate.count().then(count => ({ name: 'RBI_Rate', count })),
      prisma.lMECashSettlement.count().then(count => ({ name: 'LMECashSettlement', count })),
      prisma.lME_West_Metal_Price.count().then(count => ({ name: 'LME_West_Metal_Price', count })),
      prisma.getquote.count().then(count => ({ name: 'getquote', count })),
      prisma.user.count().then(count => ({ name: 'User', count })),
      prisma.onboarding.count().then(count => ({ name: 'Onboarding', count }))
    ]);
    
    tableCounts.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { name, count } = result.value;
        stats.tables[name] = count;
        stats.totalRecords += count;
      }
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting database stats:', error);
    return null;
  }
}

// Check if current time is within operating hours
function isWithinOperatingHours() {
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: 'Asia/Kolkata' }));
  
  const currentHour = istTime.getHours();
  const currentDay = istTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Check if it's weekend
  if (currentDay === 0 || currentDay === 6) {
    return false;
  }
  
  // Check if within operating hours (6 AM to 6 PM)
  return currentHour >= 6 && currentHour < 18;
}

// Save statistics to file
async function saveStats(stats) {
  try {
    await fs.writeFile(MONITOR_CONFIG.STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error('Error saving stats:', error);
  }
}

// Load previous statistics
async function loadPreviousStats() {
  try {
    const data = await fs.readFile(MONITOR_CONFIG.STATS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Calculate compute usage estimation
function calculateComputeUsage(currentStats, previousStats) {
  if (!previousStats) return null;
  
  const timeDiff = new Date(currentStats.timestamp) - new Date(previousStats.timestamp);
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  const recordsAdded = currentStats.totalRecords - previousStats.totalRecords;
  
  return {
    timeElapsed: hoursDiff,
    recordsAdded,
    estimatedComputeMinutes: hoursDiff * (currentStats.operatingHours.current ? 1 : 0.1), // Less compute during off hours
    totalRecords: currentStats.totalRecords
  };
}

// Generate usage report
async function generateReport() {
  console.log('📊 Database Usage Report');
  console.log('========================');
  
  const currentStats = await getCurrentStats();
  if (!currentStats) {
    console.log('❌ Unable to generate report');
    return;
  }
  
  const previousStats = await loadPreviousStats();
  
  console.log(`📅 Report Time: ${currentStats.timestamp}`);
  console.log(`⏰ Operating Hours: ${currentStats.operatingHours.current ? 'ACTIVE' : 'INACTIVE'}`);
  console.log(`📊 Total Records: ${currentStats.totalRecords.toLocaleString()}`);
  console.log('\n📋 Table Breakdown:');
  
  Object.entries(currentStats.tables).forEach(([table, count]) => {
    console.log(`  ${table.padEnd(25)}: ${count.toLocaleString().padStart(10)} records`);
  });
  
  if (previousStats) {
    const usage = calculateComputeUsage(currentStats, previousStats);
    if (usage) {
      console.log('\n⚡ Compute Usage (since last check):');
      console.log(`  Time Elapsed: ${usage.timeElapsed.toFixed(2)} hours`);
      console.log(`  Records Added: ${usage.recordsAdded}`);
      console.log(`  Estimated Compute: ${usage.estimatedComputeMinutes.toFixed(2)} minutes`);
    }
  }
  
  // Save current stats for next comparison
  await saveStats(currentStats);
  
  // Log the report
  await logOperation('report_generated', {
    totalRecords: currentStats.totalRecords,
    operatingHours: currentStats.operatingHours.current
  });
}

// Monitor database usage continuously
async function startMonitoring() {
  console.log('🚀 Starting database usage monitoring...');
  await ensureLogDir();
  
  // Initial report
  await generateReport();
  
  // Set up interval monitoring
  setInterval(async () => {
    await generateReport();
  }, MONITOR_CONFIG.CHECK_INTERVAL);
  
  console.log(`📈 Monitoring active - Reports every ${MONITOR_CONFIG.CHECK_INTERVAL / 1000 / 60} minutes`);
}

// Check database performance
async function performanceCheck() {
  console.log('🔍 Database Performance Check');
  console.log('=============================');
  
  const startTime = Date.now();
  
  try {
    // Test simple query performance
    await prisma.$queryRaw`SELECT 1`;
    const connectionTime = Date.now() - startTime;
    
    // Test count operations
    const countStart = Date.now();
    const totalRecords = await prisma.metalPrice.count();
    const countTime = Date.now() - countStart;
    
    // Test recent data query
    const queryStart = Date.now();
    const recentData = await prisma.metalPrice.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Database Connection: ${connectionTime}ms`);
    console.log(`✅ Count Query: ${countTime}ms (${totalRecords.toLocaleString()} records)`);
    console.log(`✅ Recent Data Query: ${queryTime}ms (${recentData.length} records)`);
    
    const totalTime = Date.now() - startTime;
    console.log(`⏱️  Total Performance Check: ${totalTime}ms`);
    
    // Log performance metrics
    await logOperation('performance_check', {
      connectionTime,
      countTime,
      queryTime,
      totalTime,
      recordsCount: totalRecords
    });
    
    return {
      connectionTime,
      countTime,
      queryTime,
      totalTime,
      healthy: totalTime < 5000 // Consider healthy if under 5 seconds
    };
    
  } catch (error) {
    console.error('❌ Performance check failed:', error);
    await logOperation('performance_check_failed', { error: error.message });
    return { healthy: false, error: error.message };
  }
}

// CLI handling
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'monitor':
      startMonitoring();
      break;
    case 'report':
      generateReport().then(() => prisma.$disconnect());
      break;
    case 'performance':
      performanceCheck().then(() => prisma.$disconnect());
      break;
    case 'logs':
      // Show recent logs
      fs.readFile(MONITOR_CONFIG.LOG_FILE, 'utf8')
        .then(data => {
          const lines = data.trim().split('\n');
          console.log('📋 Recent Database Operations:');
          lines.slice(-20).forEach(line => {
            try {
              const entry = JSON.parse(line);
              console.log(`${entry.timestamp} - ${entry.operation}`);
            } catch (e) {
              console.log(line);
            }
          });
        })
        .catch(() => console.log('No logs found'))
        .finally(() => prisma.$disconnect());
      break;
    default:
      console.log('Usage: node monitor-db-usage.js [monitor|report|performance|logs]');
      console.log('  monitor     - Start continuous monitoring');
      console.log('  report      - Generate one-time usage report');
      console.log('  performance - Run performance check');
      console.log('  logs        - Show recent database operations');
      process.exit(1);
  }
}

module.exports = {
  generateReport,
  performanceCheck,
  getCurrentStats,
  isWithinOperatingHours
}; 