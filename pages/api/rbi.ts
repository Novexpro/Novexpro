import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

// Create a singleton Prisma client instance
const prisma = new PrismaClient();

type ExchangeRate = {
  date: string;
  rate: string;
};

type ApiResponse = {
  success?: boolean;
  data?: ExchangeRate[];
  error?: string;
  message?: string;
};

// Cache to prevent too frequent API calls
let lastFetchAttempt = 0;
const REFRESH_INTERVAL = 3600000; // 1 hour in milliseconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  try {
    // Check if this is a background refresh request from a scheduler/cron job
    const isBackgroundUpdate = req.query.backgroundUpdate === 'true';
    
    // Check if we should attempt to fetch fresh data
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchAttempt;
    const shouldFetchFreshData = isBackgroundUpdate || timeSinceLastFetch > REFRESH_INTERVAL;
    
    // If it's a background update or enough time has passed, fetch from external API
    if (shouldFetchFreshData) {
      lastFetchAttempt = now;
      console.log("Attempting to refresh RBI data from external API");
      await fetchAndStoreExternalData();
      
      if (isBackgroundUpdate) {
        return res.status(200).json({ 
          success: true,
          message: "Background update completed"
        });
      }
    }
    
    // For all requests, retrieve from database
    const latestRates = await prisma.rBI_Rate.findMany({
      orderBy: [
        // Sort by createdAt DESC first to get the most recently added records
        { createdAt: 'desc' },
        // Then sort by date in descending order (newest first)
        { date: 'desc' }
      ],
      take: 10 // Get the latest 10 records
    });
    
    if (latestRates && latestRates.length > 0) {
      console.log(`Retrieved ${latestRates.length} RBI rates, latest is:`, latestRates[0]);
      
      const data = latestRates.map(rate => {
        // Correct any future years in the date string
        let dateString = rate.date;
        const dateParts = dateString.split('-');
        if (dateParts.length === 3) {
          const year = parseInt(dateParts[2]);
          // If year is in the future, correct it to current year
          if (year > new Date().getFullYear()) {
            const currentYear = new Date().getFullYear();
            dateString = `${dateParts[0]}-${dateParts[1]}-${currentYear}`;
          }
        }
        
        return {
          date: dateString,
          rate: rate.rate.toString()
        };
      });
      
      return res.status(200).json({ success: true, data });
    } else {
      // If no data in database, force an API fetch
      console.log("No RBI rate data in database, forcing API fetch");
      await fetchAndStoreExternalData();
      
      // Try again to retrieve from database
      const latestRatesRetry = await prisma.rBI_Rate.findMany({
        orderBy: [
          { createdAt: 'desc' },
          { date: 'desc' }
        ],
        take: 10
      });
      
      if (latestRatesRetry && latestRatesRetry.length > 0) {
        console.log(`After fetch, retrieved ${latestRatesRetry.length} RBI rates, latest is:`, latestRatesRetry[0]);
        
        const data = latestRatesRetry.map(rate => ({
          date: rate.date,
          rate: rate.rate.toString()
        }));
        
        return res.status(200).json({ success: true, data });
      }
      
      // If still no data, return an error
      return res.status(404).json({ 
        success: false,
        error: "No RBI rate data available in database"
      });
    }
  } catch (error: unknown) {
    console.error("Error in RBI API:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    await prisma.$disconnect();
  }
}

// Separate function to fetch and store data from external API
async function fetchAndStoreExternalData() {
  try {
    console.log("Fetching from external RBI API");
    
    // Create an AbortController with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch("http://148.135.138.22:5000/scrape", {
      signal: controller.signal
    });
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const text = await response.text();
      console.error("External API error:", text);
      throw new Error(`Failed to fetch data from external API: ${response.status} ${response.statusText}`);
    }
    
    const apiResponse = await response.json();
    const data = apiResponse.data;
    
    console.log("Received data from RBI scraper:", JSON.stringify(data));
    
    // Store the data in the database
    if (data && data.length > 0) {
      console.log("Storing RBI rates in database");
      
      // Process each entry and add to database
      for (const entry of data) {
        // Check if date has correct year
        let dateString = entry.date;
        const rate = parseFloat(entry.rate);
        
        if (isNaN(rate)) {
          console.log(`Invalid rate for ${dateString}, skipping`);
          continue;
        }
        
        // Validate and correct the year if necessary
        const dateParts = dateString.split('-');
        if (dateParts.length === 3) {
          const year = parseInt(dateParts[2]);
          // If year is in the future (like 2025), correct it to current year
          if (year > new Date().getFullYear()) {
            const currentYear = new Date().getFullYear();
            dateString = `${dateParts[0]}-${dateParts[1]}-${currentYear}`;
            console.log(`Corrected future year in date: ${entry.date} -> ${dateString}`);
          }
        }
        
        console.log(`Processing RBI rate for date: ${dateString}, rate: ${rate}`);
        
        // Check if record already exists for this date
        const existingRecord = await prisma.rBI_Rate.findUnique({
          where: {
            date: dateString
          }
        });
        
        if (existingRecord) {
          // Update the existing record if needed
          if (Math.abs(existingRecord.rate - rate) > 0.0001) {
            await prisma.rBI_Rate.update({
              where: {
                date: dateString
              },
              data: {
                rate: rate
              }
            });
            console.log(`Updated RBI rate for ${dateString} from ${existingRecord.rate} to ${rate}`);
          } else {
            console.log(`No change in RBI rate for ${dateString}, skipping update`);
          }
        } else {
          // Create a new record
          await prisma.rBI_Rate.create({
            data: {
              date: dateString,
              rate: rate
            }
          });
          console.log(`Added new RBI rate for ${dateString}: ${rate}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error fetching/storing external data:", error);
    return false;
  }
}
