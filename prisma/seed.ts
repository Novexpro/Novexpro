const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.metalPrice.deleteMany({
    where: {
      metal: "LME CSP"
    }
  });

  console.log('Deleted existing LME CSP records');

  // Sample data from the user's example
  const prices = [
    { value: 2371.50, change: -25.00 },
    { value: 2372.50, change: -25.00 },
    { value: 2368.50, change: -25.00 },
    { value: 2371.00, change: -25.00 },
    { value: 2375.50, change: -25.00 },
    { value: 2368.50, change: -25.00 },
    { value: 2375.50, change: -25.00 },
    { value: 2389.50, change: -25.00 },
    { value: 2394.50, change: -25.00 }
  ];

  const baseTime = new Date();
  baseTime.setHours(5, 0, 0, 0); // Start at 5:00

  // Create records with 30-minute intervals
  for (let i = 0; i < prices.length; i++) {
    const lastUpdated = new Date(baseTime);
    lastUpdated.setMinutes(lastUpdated.getMinutes() + (i * 30));
    
    const createdAt = new Date(lastUpdated);
    createdAt.setMinutes(createdAt.getMinutes() + 5); // 5 minutes after lastUpdated
    
    await prisma.metalPrice.create({
      data: {
        metal: "LME CSP",
        spotPrice: prices[i].value,
        change: prices[i].change,
        changePercent: parseFloat((prices[i].change / prices[i].value * 100).toFixed(2)),
        lastUpdated,
        createdAt
      }
    });
  }

  console.log('Added LME CSP sample data');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }); 