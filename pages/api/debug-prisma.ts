import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

// Create a new instance of the PrismaClient
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get today's date with time set to 00:00:00 UTC
    const today = new Date();
    const startOfToday = new Date(today);
    startOfToday.setUTCHours(0, 0, 0, 0);
    
    // Get today's date with time set to 23:59:59 UTC
    const endOfToday = new Date(today);
    endOfToday.setUTCHours(23, 59, 59, 999);
    
    // Find the latest 20 aluminum snapshots
    const latestSnapshots = await prisma.aluminumSnapshot.findMany({
      take: 20,
      orderBy: {
        timestamp: 'desc'
      },
      select: {
        id: true,
        timestamp: true,
        month1Label: true,
        month1Price: true,
        createdAt: true
      }
    });
    
    // Find today's snapshots
    const todaySnapshots = await prisma.aluminumSnapshot.findMany({
      where: {
        timestamp: {
          gte: startOfToday,
          lte: endOfToday
        }
      },
      orderBy: {
        timestamp: 'asc'
      },
      select: {
        id: true,
        timestamp: true,
        month1Label: true,
        month1Price: true
      }
    });
    
    // Count records by hour
    const hourCounts = {};
    todaySnapshots.forEach(snapshot => {
      const hour = snapshot.timestamp.getUTCHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    // Format timestamps for easier reading
    const formattedLatestSnapshots = latestSnapshots.map(snapshot => {
      // Convert to IST with +6.5 hours adjustment (5.5 for IST + 1 hour adjustment)
      const istTimestamp = new Date(snapshot.timestamp.getTime() + (6.5 * 60 * 60 * 1000));
      const formattedISTTime = istTimestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      return {
        id: snapshot.id,
        timestamp: snapshot.timestamp.toISOString(),
        formattedTime: snapshot.timestamp.toLocaleTimeString(),
        formattedISTTime: formattedISTTime,
        month1Label: snapshot.month1Label,
        month1Price: snapshot.month1Price.toString(),
        utcHour: snapshot.timestamp.getUTCHours(),
        utcMinute: snapshot.timestamp.getUTCMinutes(),
        istHour: istTimestamp.getHours(),
        istMinute: istTimestamp.getMinutes()
      };
    });
    
    const formattedTodaySnapshots = todaySnapshots.map(snapshot => {
      // Convert to IST with +6.5 hours adjustment (5.5 for IST + 1 hour adjustment)
      const istTimestamp = new Date(snapshot.timestamp.getTime() + (6.5 * 60 * 60 * 1000));
      const formattedISTTime = istTimestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      return {
        id: snapshot.id,
        timestamp: snapshot.timestamp.toISOString(),
        formattedTime: snapshot.timestamp.toLocaleTimeString(),
        formattedISTTime: formattedISTTime,
        month1Label: snapshot.month1Label,
        month1Price: snapshot.month1Price.toString(),
        utcHour: snapshot.timestamp.getUTCHours(),
        utcMinute: snapshot.timestamp.getUTCMinutes(),
        istHour: istTimestamp.getHours(),
        istMinute: istTimestamp.getMinutes()
      };
    });

    res.status(200).json({
      success: true,
      currentTime: new Date().toISOString(),
      today: {
        start: startOfToday.toISOString(),
        end: endOfToday.toISOString(),
        count: todaySnapshots.length,
        hourCounts: hourCounts
      },
      latestSnapshots: formattedLatestSnapshots,
      todaySnapshots: formattedTodaySnapshots
    });
  } catch (error) {
    console.error('API Debug Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await prisma.$disconnect();
  }
} 