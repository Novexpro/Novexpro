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
    const [day, month, year] = dateStr.split('-');
    const monthMap: { [key: string]: number } = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    
    const monthNum = monthMap[month] || parseInt(month) - 1;
    const parsedYear = parseInt(year);
    const parsedDay = parseInt(day);
    
    // Validate year is reasonable (not too far in past or future)
    const currentYear = new Date().getFullYear();
    if (parsedYear < currentYear - 1 || parsedYear > currentYear + 1) {
      console.warn(`Invalid year ${parsedYear} in date ${dateStr}, using current year ${currentYear}`);
      return new Date(currentYear, monthNum, parsedDay);
    }
    
    const date = new Date(parsedYear, monthNum, parsedDay);
    
    // Additional validation
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date ${dateStr}, using current date`);
      return new Date();
    }
    
    // Check if date is in the future
    if (date > new Date()) {
      console.warn(`Future date ${dateStr}, using current date`);
      return new Date();
    }
    
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
    // Check if this is a forced refresh request
    const forceRefresh = req.query.forceRefresh === 'true';
    
    // Fetch all records from the database
    const allRates = await prisma.rBI_Rate.findMany({
      orderBy: [
        { createdAt: 'desc' }
      ]
    });

    // Always try to fetch fresh data from external API first
    console.log("Checking for fresh RBI data from external API");
    const freshDataFetched = await fetchAndStoreExternalData();
    
    if (freshDataFetched) {
      // If we successfully fetched fresh data, get the updated records
      const updatedRates = await prisma.rBI_Rate.findMany({
        orderBy: [
          { createdAt: 'desc' }
        ]
      });
      
      if (updatedRates && updatedRates.length > 0) {
        const sortedRates = [...updatedRates].sort((a, b) => compareDates(b.date, a.date));
        const latestRate = sortedRates[0];
        
        console.log(`Fresh data retrieved, latest rate: ${latestRate.rate} for ${latestRate.date}`);
        
        const dateObj = parseAndValidateDate(latestRate.date);
        const formattedDate = formatDate(dateObj);
        
        const data = [{
          date: formattedDate,
          rate: latestRate.rate.toString()
        }];
        
        return res.status(200).json({ success: true, data });
      }
    }

    // If we have data, find the record with the most recent date
    if (allRates && allRates.length > 0) {
      // Sort by date to find the most recent
      const sortedRates = [...allRates].sort((a, b) => compareDates(b.date, a.date));
      const latestRate = sortedRates[0];
      
      console.log(`Retrieved RBI rates, latest by date is:`, latestRate);
      
      const dateObj = parseAndValidateDate(latestRate.date);
      const formattedDate = formatDate(dateObj);
      
      const data = [{
        date: formattedDate,
        rate: latestRate.rate.toString()
      }];
      
      return res.status(200).json({ success: true, data });
    }

    // If no data in database, fetch from external API
    console.log("No RBI rate data in database, fetching from external API");
    const success = await fetchAndStoreExternalData();
      
    if (success) {
      // Fetch all records again
      const newRates = await prisma.rBI_Rate.findMany({
        orderBy: [
          { createdAt: 'desc' }
        ]
      });
      
      if (newRates && newRates.length > 0) {
        // Sort by date to find the most recent
        const sortedRates = [...newRates].sort((a, b) => compareDates(b.date, a.date));
        const latestRate = sortedRates[0];
        
        console.log(`Retrieved new RBI rates, latest by date is:`, latestRate);
        
        const dateObj = parseAndValidateDate(latestRate.date);
        const formattedDate = formatDate(dateObj);
        
        const data = [{
          date: formattedDate,
          rate: latestRate.rate.toString()
        }];
        
        return res.status(200).json({ success: true, data });
      }
      }
      
      // If still no data, return an error
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
    
    // Updated API endpoint
    const response = await fetch("http://148.135.138.22:3232/api/rbi-data", {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Read raw response
    const text = await response.text();
    console.log("Raw API response:", text);
    
    // Try parsing JSON
    let apiData;
    try {
      apiData = JSON.parse(text);
    } catch (error) {
      console.error("Failed to parse JSON response:", error);
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
    
    if (!apiData || !apiData.date || !apiData.rate) {
      console.error("Invalid or missing data in API response");
      return false;
    }
    
    // Extract data from the new format
    const date = apiData.date; // Format: "26-Jun-2025"
    const rate = parseFloat(apiData.rate);
    
    if (isNaN(rate)) {
      console.log(`Invalid rate for ${date}, skipping`);
      return false;
    }
    
    // Parse and validate the date
    const dateObj = parseAndValidateDate(date);
    const formattedDate = formatDate(dateObj);
    
    console.log(`Processing RBI rate for date: ${formattedDate}, rate: ${rate}`);
    
    // Check if record already exists for this date
    const existingRecord = await prisma.rBI_Rate.findFirst({
      where: {
        date: formattedDate
      }
    });
    
    if (existingRecord) {
      // Update the existing record if needed
      if (Math.abs(existingRecord.rate - rate) > 0.0001) {
        await prisma.rBI_Rate.update({
          where: {
            id: existingRecord.id
          },
          data: {
            rate: rate
          }
        });
        console.log(`Updated RBI rate for ${formattedDate} from ${existingRecord.rate} to ${rate}`);
      } else {
        console.log(`No significant change in RBI rate for ${formattedDate} (${existingRecord.rate} vs ${rate}), skipping update`);
      }
    } else {
      // Create a new record
      await prisma.rBI_Rate.create({
        data: {
          date: formattedDate,
          rate: rate
        }
      });
      console.log(`Added new RBI rate for ${formattedDate}: ${rate}`);
    }
    
    return true;
  } catch (error) {
    console.error("Error fetching/storing external data:", error);
    return false;
  }
}
