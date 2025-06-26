import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

// Create a singleton Prisma client instance
const prisma = new PrismaClient();

// Define response types
type ApiResponse = {
  success: boolean;
  data?: {
    sbi_tt_sell: string;
    sbi_tt_buy: string | null;
    timestamp: string;
  }[];
  error?: string;
  message?: string;
};

// Helper function to validate date
const isValidDate = (date: any): boolean => {
  if (!date) return false;
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
};

// Cache to prevent too frequent API calls
let lastFetchAttempt = 0;
const REFRESH_INTERVAL = 1800000; // 30 minutes in milliseconds

// Separate function to fetch and store data from external API
async function fetchAndStoreExternalData(): Promise<boolean> {
  try {
    console.log("Fetching from external SBI TT API");
    
    // Create an AbortController with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Updated API endpoint
    const response = await fetch("http://148.135.138.22:3232/api/sbi-data", {
      signal: controller.signal
    });

    // Clear the timeout
    clearTimeout(timeoutId);

    // Read raw response
    const text = await response.text();

    // Debugging log
    console.log("🔍 Raw response from API:", text);

    // Check if response is empty or invalid
    if (!text || text.trim() === '') {
      console.error("Empty response from external API");
      return false;
    }

    // Try parsing JSON
    let apiData;
    try {
      apiData = JSON.parse(text);
      console.log("Parsed JSON data:", JSON.stringify(apiData, null, 2));
    } catch (error) {
      console.error("🔻 Failed to parse JSON response:", error);
      return false;
    }
        
    // Check if API response is OK
    if (!response.ok) {
      console.error(`API error: ${response.status} - ${response.statusText}`);
      if (apiData && apiData.error) {
        console.error(`API error message: ${apiData.error}`);
      }
      return false;
    }
    
    // Check for error in response even if status is 200
    if (apiData && apiData.error) {
      console.error(`API returned error: ${apiData.error}`);
      return false;
    }
    
    // Check if the response has the expected structure
    if (!apiData || !apiData.rate || !apiData.date) {
      console.error("API response missing required fields");
      return false;
    }
    
    // Extract data from the new format
    const rate = parseFloat(apiData.rate);
    const apiDate = apiData.date; // Format: "2025-06-26"
    
    if (isNaN(rate)) {
      console.log("Invalid rate received, skipping update");
      return false;
    }
    
    // Parse the date from the API
    let timestamp;
    if (apiDate && typeof apiDate === 'string') {
      console.log("Found date in API response:", apiDate);
      
      // Parse YYYY-MM-DD format
      timestamp = new Date(apiDate);
      if (!isValidDate(timestamp)) {
        console.log("Could not parse date, using current date");
        timestamp = new Date();
      } else {
        console.log("Parsed date from API:", timestamp.toISOString());
      }
    } else {
      timestamp = new Date();
      console.log("No valid date in API data, using current date:", timestamp);
    }
            
    console.log("Checking database connection...");
    try {
      await prisma.$connect();
      console.log("Database connection successful");
    } catch (connErr) {
      console.error("Database connection error:", connErr);
      return false;
    }
    
    // Log the data we're about to save
    console.log("Attempting to save data with:", {
      date: timestamp.toISOString(),
      rate: rate,
      originalDate: apiDate
    });
    
    // Check if we already have data for this specific date
    let existingData;
    try {
      existingData = await prisma.sBITTRate.findFirst({
        where: {
          date: {
            // Use exact date matching instead of date range
            equals: timestamp,
          },
        },
      });
      console.log("Database query result:", existingData ? "Found existing record" : "No existing record found");
    } catch (queryErr) {
      console.error("Error querying database:", queryErr);
      return false;
    }
          
    try {
      if (existingData) {
        // Update the existing record if the rate has changed
        if (Math.abs(existingData.rate - rate) > 0.0001) {
          const updatedRecord = await prisma.sBITTRate.update({
            where: { id: existingData.id },
            data: { 
              rate: rate,
            }
          });
          console.log("✅ SBI TT rate updated in database:", updatedRecord);
        } else {
          console.log("⏭️ SBI TT rate unchanged, skipping update");
        }
      } else {
        // Create a new record
        const newRecord = await prisma.sBITTRate.create({
          data: {
            date: timestamp,
            rate: rate,
          },
        });
        console.log("✅ SBI TT rate saved to database (new entry):", newRecord);
      }
      
      // Verify data was saved
      const verifyRecord = await prisma.sBITTRate.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      console.log("Verification - latest record in database:", verifyRecord);
      
      return true;
    } catch (dbErr) {
      console.error("Database operation error:", dbErr);
      return false;
    }
  } catch (error) {
    console.error("🚨 Error fetching/storing SBI TT external data:", error);
    return false;
  }
}

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
      console.log("Attempting to refresh SBI TT data from external API");
      const fetchSuccess = await fetchAndStoreExternalData();
      
      if (isBackgroundUpdate) {
        return res.status(200).json({ 
          success: fetchSuccess,
          message: fetchSuccess ? "Background update completed" : "Background update failed"
        });
      }
    }
    
    // For all requests, retrieve from database
    const latestRates = await prisma.sBITTRate.findMany({
      orderBy: [
        // Sort by createdAt DESC first to get the most recently added records
        { createdAt: 'desc' },
        // Then sort by date in descending order (newest first)
        { date: 'desc' }
      ],
      take: 5 // Get the latest 5 records
    });
    
    if (latestRates && latestRates.length > 0) {
      console.log("SBI TT Rate from DB:", latestRates[0]);
      
      const data = latestRates.map(rate => ({
        sbi_tt_sell: rate.rate.toString(),
        sbi_tt_buy: null,
        timestamp: rate.date.toISOString()
      }));
      
      return res.status(200).json({ 
        success: true, 
        data 
      });
    } else {
      // If no data in database, force an API fetch
      console.log("No SBI TT rate data in database, forcing API fetch");
      await fetchAndStoreExternalData();
      
      // Try again to retrieve from database
      const latestRatesRetry = await prisma.sBITTRate.findMany({
        orderBy: [
          { createdAt: 'desc' },
          { date: 'desc' }
        ],
        take: 5
      });
      
      if (latestRatesRetry && latestRatesRetry.length > 0) {
        console.log("After fetch, SBI TT Rate from DB:", latestRatesRetry[0]);
        
        const data = latestRatesRetry.map(rate => ({
          sbi_tt_sell: rate.rate.toString(),
          sbi_tt_buy: null,
          timestamp: rate.date.toISOString()
        }));
        
        return res.status(200).json({ 
          success: true, 
          data 
        });
      }
      
      // If still no data, return an error
      return res.status(404).json({ 
        success: false,
        error: "No SBI TT rate data available in database"
      });
    }
  } catch (error: unknown) {
    console.error("🚨 Error in SBI TT API:", error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await prisma.$disconnect();
  }
}
