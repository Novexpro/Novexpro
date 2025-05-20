const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to get IST date
function getISTDate(dateString: string) {
  return new Date(new Date(dateString).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

async function main() {
  // Clear existing data
  await prisma.lMECashSettlement.deleteMany({});
  console.log('Deleted existing LMECashSettlement records');

  // Sample hardcoded data
  const settlements = [
    {
      date: '2025-04-24',
      price: 2410,
      Dollar_Difference: -26,
      INR_Difference: 2590.639216499985,
      createdAt: new Date('2025-04-24T17:16:00Z'),
      updatedAt: new Date('2025-04-24T17:16:00Z')
    },
    {
      date: '2025-04-25',
      price: 2412,
      Dollar_Difference: 2,
      INR_Difference: 368.67,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      date: '2025-04-28',
      price: 2400,
      Dollar_Difference: -12,
      INR_Difference: -2094.492012,
      createdAt: new Date(),
      updatedAt: new Date('2025-04-27T10:19:00Z')
    },
    {
      date: '2025-04-29',
      price: 2430,
      Dollar_Difference: 30,
      INR_Difference: 2773.381237500056,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      date: '2025-04-30',
      price: 2405,
      Dollar_Difference: -25,
      INR_Difference: -2688.440169,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      date: '2025-05-02',
      price: 2401.5,
      Dollar_Difference: 24,
      INR_Difference: 2209.689929999993,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      date: '2025-05-01',
      price: 2377.5,
      Dollar_Difference: 19.25,
      INR_Difference: 4883.325206312467,
      createdAt: new Date('2025-05-01T07:25:00Z'),
      updatedAt: new Date('2025-05-01T07:41:00Z')
    },
    {
      date: '2025-05-06',
      price: 2404,
      Dollar_Difference: 2.5,
      INR_Difference: 2014.21770899999,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      date: '2025-05-07',
      price: 2363.5,
      Dollar_Difference: -40.5,
      INR_Difference: -3635.115267,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      date: '2025-05-08',
      price: 2363.5,
      Dollar_Difference: 0,
      INR_Difference: 748.8696571250039,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      date: '2025-05-09',
      price: 2401,
      Dollar_Difference: 37.5,
      INR_Difference: 5471.200835750002,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      date: '2025-05-12',
      price: 2468.5,
      Dollar_Difference: 67.5,
      INR_Difference: 6257.885411249998,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      date: '2025-05-13',
      price: 2470,
      Dollar_Difference: 1.5,
      INR_Difference: -1879.636005,
      createdAt: new Date(),
      updatedAt: new Date('2025-05-14T13:04:00Z')
    },
    {
      date: '2025-05-14',
      price: 2530,
      Dollar_Difference: 60,
      INR_Difference: 6634.761574999982,
      createdAt: new Date('2025-05-14T06:44:00Z'),
      updatedAt: new Date()
    },
    {
      date: '2025-05-15',
      price: 2480.5,
      Dollar_Difference: -49.5,
      INR_Difference: -3794.860117,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      date: '2025-05-16',
      price: 2473,
      Dollar_Difference: -7.5,
      INR_Difference: -750.0069316,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  for (const record of settlements) {
    await prisma.lMECashSettlement.create({
      data: record
    });
  }

  console.log('Seeded LMECashSettlement with sample data');

  // Seed LME_West_Metal_Price with provided data
  await prisma.lME_West_Metal_Price.createMany({
    data: [
      { date: '2025-04-24', Price: 2410, createdAt: getISTDate('2025-04-24T00:00:00Z') },
      { date: '2025-04-23', Price: 2384, createdAt: getISTDate('2025-04-23T00:00:00Z') },
      { date: '2025-04-22', Price: 2355.5, createdAt: getISTDate('2025-04-22T00:00:00Z') },
      { date: '2025-04-17', Price: 2327.5, createdAt: getISTDate('2025-04-17T00:00:00Z') },
      { date: '2025-04-16', Price: 2332.5, createdAt: getISTDate('2025-04-16T00:00:00Z') },
      { date: '2025-04-15', Price: 2333.5, createdAt: getISTDate('2025-04-15T00:00:00Z') },
      { date: '2025-04-25', Price: 2412, createdAt: getISTDate('2025-04-25T08:08:44.871Z') },
      { date: '2025-04-28', Price: 2400, createdAt: getISTDate('2025-04-28T15:22:44.939Z') },
      { date: '2025-04-29', Price: 2430, createdAt: getISTDate('2025-04-29T12:51:03.550Z') },
      { date: '2025-04-30', Price: 2405, createdAt: getISTDate('2025-04-30T12:28:07.436Z') },
      { date: '2025-04-30', Price: 2405, createdAt: getISTDate('2025-04-30T12:32:58.780Z') },
      { date: '2025-04-30', Price: 2405, createdAt: getISTDate('2025-04-30T12:36:16.972Z') },
      { date: '2025-05-01', Price: 2377.5, createdAt: getISTDate('2025-05-01T02:30:57.000Z') },
      { date: '2025-05-02', Price: 2401.5, createdAt: getISTDate('2025-05-02T02:30:57.392Z') },
      { date: '2025-05-06', Price: 2404, createdAt: getISTDate('2025-05-06T12:28:32.039Z') },
      { date: '2025-05-07', Price: 2363.5, createdAt: getISTDate('2025-05-07T12:37:17.885Z') },
      { date: '2025-05-08', Price: 2363.5, createdAt: getISTDate('2025-05-08T12:59:37.545Z') },
      { date: '2025-05-09', Price: 2401, createdAt: getISTDate('2025-05-09T12:30:10.640Z') },
      { date: '12-05-2025', Price: 2468.5, createdAt: getISTDate('2025-05-12T00:00:00Z') },
      { date: '13-05-2025', Price: 2470, createdAt: getISTDate('2025-05-13T00:00:00Z') },
      { date: '14-05-2025', Price: 2530, createdAt: getISTDate('2025-05-14T00:00:00Z') },
      { date: '15-05-2025', Price: 2480.5, createdAt: getISTDate('2025-05-15T00:00:00Z') },
      { date: '16-05-2025', Price: 2473, createdAt: getISTDate('2025-05-16T00:00:00Z') }
    ]
  });
  console.log('Seeded LME_West_Metal_Price with provided data');

  // Seed RBI_Rate table with provided data
  await prisma.RBI_Rate.createMany({
    data: [
      { date: '25-Apr-25', rate: 85.5788, createdAt: getISTDate('2025-04-30T00:00:00Z') },
      { date: '28-Apr-25', rate: 85.198, createdAt: getISTDate('2025-04-28T00:00:00Z') },
      { date: '29-Apr-25', rate: 85.2005, createdAt: getISTDate('2025-04-29T01:00:00Z') },
      { date: '30-Apr-25', rate: 85.0535, createdAt: getISTDate(new Date().toISOString()) },
      { date: '02-May-25', rate: 83.8568, createdAt: getISTDate('2025-05-02T00:00:00Z') },
      { date: '05-May-25', rate: 84.2369, createdAt: getISTDate(new Date().toISOString()) },
      { date: '06-May-25', rate: 84.5436, createdAt: getISTDate(new Date().toISOString()) },
      { date: '07-May-25', rate: 84.5715, createdAt: getISTDate('2025-05-07T05:00:00Z') },
      { date: '08-May-25', rate: 84.8642, createdAt: getISTDate('2025-05-08T05:00:00Z') },
      { date: '09-May-25', rate: 85.6438, createdAt: getISTDate('2025-05-09T05:00:00Z') },
      { date: '13-May-25', rate: 84.8888, createdAt: getISTDate(new Date().toISOString()) },
      { date: '14-May-25', rate: 85.2982, createdAt: getISTDate(new Date().toISOString()) },
      { date: '15-May-25', rate: 85.5871, createdAt: getISTDate(new Date().toISOString()) },
      { date: '16-May-25', rate: 85.5665, createdAt: getISTDate(new Date().toISOString()) }
    ]
  });
  console.log('Seeded RBI_Rate with provided data');
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
