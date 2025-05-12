import { NextResponse } from "next/server";
import prisma from "../../../prisma/client";

export async function POST(req: Request) {
  try {
    // Clear existing data
    await prisma.metalPrice.deleteMany({
      where: {
        metal: "LME CSP"
      }
    });

    console.log('Deleted existing LME CSP records');

    // Generate realistic price data
    const data = generateRealisticPriceData();
    console.log(`Generated ${data.length} realistic price points`);

    // Insert all price data in a transaction
    const result = await prisma.$transaction(
      data.map(item => 
        prisma.metalPrice.create({
          data: item
        })
      )
    );

    return NextResponse.json({ 
      success: true,
      message: `Added ${result.length} price records to the database`,
      count: result.length 
    });
  } catch (error) {
    console.error("Error seeding data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to seed data" },
      { status: 500 }
    );
  }
}

// Generate realistic price movement data with volatility and trends
function generateRealisticPriceData() {
  const metalPrices: Array<{
    metal: string;
    spotPrice: number;
    change: number;
    changePercent: number;
    lastUpdated: Date;
    createdAt: Date;
  }> = [];
  const basePrice = 2370.00;
  const volatility = 10; // Standard deviation of price moves
  
  // Create data for the last 3 days (72 hours)
  const hoursBack = 72;
  const now = new Date();
  
  // Generate base timestamps for 30-minute intervals going back
  const timestamps = Array.from({ length: hoursBack * 2 }, (_, i) => {
    const date = new Date(now);
    date.setMinutes(Math.floor(date.getMinutes() / 30) * 30, 0, 0); // Round to nearest 30-min interval
    date.setTime(date.getTime() - (i * 30 * 60 * 1000)); // Go back in 30-min increments
    return date;
  }).reverse(); // Sort from oldest to newest
  
  // Generate price with realistic movements (trending with random walks)
  let currentPrice = basePrice;
  let trend = 0.3; // Small upward trend initially
  
  for (let i = 0; i < timestamps.length; i++) {
    // Adjust trend occasionally to simulate market sentiment shifts
    if (i % 16 === 0) { // Every 8 hours, change trend direction
      trend = (Math.random() * 2 - 1) * 0.5; // Random trend between -0.5 and 0.5
    }
    
    // Add some volatility and trend
    const randomMove = (Math.random() * 2 - 1) * volatility;
    const trendMove = trend * (Math.random() * 2);
    currentPrice += randomMove + trendMove;
    
    // Round to 2 decimal places
    currentPrice = parseFloat(currentPrice.toFixed(2));
    
    // Ensure price doesn't go below a certain level
    if (currentPrice < 2300) currentPrice = 2300 + (Math.random() * 20);
    
    // Calculate daily change
    const change: number = i === 0 ? 0 : currentPrice - metalPrices[i-1].spotPrice;
    
    // Create 1-5 price points within each 30-min interval to simulate activity
    const numPoints = Math.floor(Math.random() * 5) + 1;
    
    for (let j = 0; j < numPoints; j++) {
      // Create a timestamp within the 30-min window
      const pointTime = new Date(timestamps[i]);
      const minutesOffset = j === 0 ? 0 : Math.floor(Math.random() * 28) + 1; // First point at interval start
      pointTime.setMinutes(pointTime.getMinutes() + minutesOffset);
      
      // Small random adjustment to price
      const microAdjustment = (Math.random() * 2 - 1) * 2;
      const pointPrice = parseFloat((currentPrice + microAdjustment).toFixed(2));
      
      metalPrices.push({
        metal: "LME CSP",
        spotPrice: pointPrice,
        change: parseFloat(change.toFixed(2)),
        changePercent: parseFloat(((change / pointPrice) * 100).toFixed(2)),
        lastUpdated: pointTime,
        createdAt: new Date(pointTime.getTime() + 60000) // 1 minute after lastUpdated
      });
    }
  }
  
  return metalPrices;
} 