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

// Helper function to format date consistently
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Helper function to parse and validate date
function parseAndValidateDate(dateStr: string): Date {
  try {
    console.log(`Parsing date: ${dateStr}`);
    const [day, month, year] = dateStr.split('-');
    const monthMap: { [key: string]: number } = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const monthNum = monthMap[month];
    let parsedYear = parseInt(year);
    const parsedDay = parseInt(day);
    
    // Fix 2-digit year issue: convert 25 → 2025, 24 → 2024, etc.
    if (parsedYear < 100) {
      if (parsedYear < 50) {
        parsedYear += 2000; // 00-49 → 2000-2049
      } else {
        parsedYear += 1900; // 50-99 → 1950-1999
      }
    }
    
    console.log(`Parsed components: day=${parsedDay}, month=${month} (${monthNum}), year=${parsedYear} (original: ${year})`);
    
    // Validate components
    if (isNaN(parsedDay) || isNaN(parsedYear) || monthNum === undefined) {
      console.error(`Invalid date components in ${dateStr}`);
      return new Date();
    }
    
    const date = new Date(parsedYear, monthNum, parsedDay);
    
    // Additional validation
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date ${dateStr}, using current date`);
      return new Date();
    }
    
    console.log(`Successfully parsed date: ${date.toISOString()}`);
    return date;
  } catch (error) {
    console.error(`Error parsing date ${dateStr}:`, error);
    return new Date();
  }
}

// Helper function to compare dates in dd-MMM-yyyy format
function compareDates(date1: string, date2: string): number {
  const d1 = parseAndValidateDate(date1);
  const d2 = parseAndValidateDate(date2);
  return d1.getTime() - d2.getTime();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  try {
    console.log("RBI API handler called");
    
    // Fetch all records from the database
    const allRates = await prisma.rBI_Rate.findMany({
      orderBy: [
        { createdAt: 'desc' }
      ]
    });

    console.log(`Found ${allRates.length} existing RBI rates in database`);

    // Always try to fetch new data first, then return the latest
    console.log("Checking for new data from external API");
    const fetchSuccess = await fetchAndStoreExternalData();
    
    if (fetchSuccess) {
      console.log("New data fetched, re-querying database");
      // Re-fetch data after potential updates
      const updatedRates = await prisma.rBI_Rate.findMany({
        orderBy: [{ createdAt: 'desc' }]
      });
      
      if (updatedRates && updatedRates.length > 0) {
        const sortedRates = [...updatedRates].sort((a, b) => compareDates(b.date, a.date));
        const latestRate = sortedRates[0];
        
        console.log(`Retrieved updated RBI rates, latest by date is:`, latestRate);
        
        const data = [{
          date: latestRate.date,
          rate: latestRate.rate.toString()
        }];
        
        return res.status(200).json({ success: true, data });
      }
    }

    // If we have existing data but no new data was fetched
    if (allRates && allRates.length > 0) {
      // Sort by date to find the most recent
      const sortedRates = [...allRates].sort((a, b) => compareDates(b.date, a.date));
      const latestRate = sortedRates[0];
      
      console.log(`Retrieved existing RBI rates, latest by date is:`, latestRate);
      
      // Use the original date format from the database
      const data = [{
        date: latestRate.date,
        rate: latestRate.rate.toString()
      }];
      
      return res.status(200).json({ success: true, data });
    }

    // If still no data after fetching, return an error
    return res.status(404).json({ 
      success: false,
      error: "No RBI rate data available"
    });
  } catch (error: unknown) {
    console.error("Error in RBI API:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    await prisma.$disconnect();
  }
}

// Function to fetch and store data from external API
async function fetchAndStoreExternalData() {
  try {
    console.log("Fetching from external RBI API");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch("http://148.135.138.22:5000/scrape", {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data from external API: ${response.status}`);
    }
    
    const apiResponse = await response.json();
    console.log("API Response:", JSON.stringify(apiResponse, null, 2));
    
    // Check if the response has the expected structure
    if (!apiResponse.success || !apiResponse.data || !Array.isArray(apiResponse.data)) {
      console.error("Invalid API response structure:", apiResponse);
      return false;
    }
    
    const data = apiResponse.data;
    
    if (data && data.length > 0) {
      // Process all entries, not just the first one
      let processedCount = 0;
      
      for (const entry of data) {
        console.log(`Processing entry:`, entry);
        
        if (!entry.date || !entry.rate) {
          console.log(`Invalid entry missing date or rate:`, entry);
          continue;
        }
        
        const rate = parseFloat(entry.rate);
        
        if (isNaN(rate)) {
          console.log(`Invalid rate for ${entry.date}: ${entry.rate}, skipping`);
          continue;
        }
        
        // Use the original date string as stored in the database
        const originalDate = entry.date;
        console.log(`Processing RBI rate for date: ${originalDate}, rate: ${rate}`);
        
        // Check if record already exists for this date
        const existingRecord = await prisma.rBI_Rate.findFirst({
          where: {
            date: originalDate
          }
        });
        
        if (existingRecord) {
          // Update the existing record if rate is different
          if (Math.abs(existingRecord.rate - rate) > 0.0001) {
            await prisma.rBI_Rate.update({
              where: {
                id: existingRecord.id
              },
              data: {
                rate: rate
              }
            });
            console.log(`Updated RBI rate for ${originalDate} from ${existingRecord.rate} to ${rate}`);
            processedCount++;
          } else {
            console.log(`No change in RBI rate for ${originalDate}, skipping update`);
          }
        } else {
          // Create a new record
          await prisma.rBI_Rate.create({
            data: {
              date: originalDate,
              rate: rate
            }
          });
          console.log(`Added new RBI rate for ${originalDate}: ${rate}`);
          processedCount++;
        }
      }
      
      console.log(`Processed ${processedCount} RBI rate entries`);
      return processedCount > 0;
    }
    
    console.log("No data received from API");
    return false;
  } catch (error) {
    console.error("Error fetching/storing external data:", error);
    return false;
  }
}
