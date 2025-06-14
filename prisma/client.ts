import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

// Optimized Prisma client with connection pooling and timeouts
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool configuration to reduce compute usage
  __internal: {
    engine: {
      // Connection pool settings
      connectionLimit: 5, // Limit concurrent connections
      poolTimeout: 10000, // 10 seconds timeout
      idleTimeout: 30000, // 30 seconds idle timeout
    },
  },
  // Query timeout settings
  transactionOptions: {
    timeout: 5000, // 5 seconds transaction timeout
  },
  // Log configuration for monitoring
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Graceful shutdown function
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

// Connection health check
export async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Batch operation helper to reduce database calls
export async function batchUpsert<T>(
  model: any,
  data: T[],
  batchSize: number = 10
) {
  const results = [];
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => model.upsert(item))
    );
    results.push(...batchResults.filter(r => r.status === 'fulfilled').map(r => r.value));
  }
  return results;
}

export default prisma; 