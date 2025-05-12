import { NextResponse } from "next/server";
import prisma from "../../../prisma/client";

export async function GET(req: Request) {
  try {
    // Get metal prices from the database, ordered by lastUpdated
    const metalPrices = await prisma.metalPrice.findMany({
      where: {
        metal: "LME CSP"
      },
      orderBy: {
        lastUpdated: "asc"
      },
      select: {
        spotPrice: true,
        change: true,
        lastUpdated: true,
        createdAt: true
      }
    });

    console.log("Metal prices fetched from DB:", metalPrices.length);
    
    // Always return database data, even if it's empty
    const formattedData = metalPrices.map((price) => {
      return {
        time: formatTime(price.lastUpdated),
        value: parseFloat(price.spotPrice.toString()),
        change: parseFloat(price.change.toString()),
        lastUpdated: price.lastUpdated,
        createdAt: price.createdAt
      };
    });

    console.log("Returning data:", formattedData.length, "records");

    return NextResponse.json({ 
      success: true, 
      data: formattedData 
    });
  } catch (error) {
    console.error("Error fetching metal trend data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trend data" },
      { status: 500 }
    );
  }
}

// Helper function to format the time for display
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
} 