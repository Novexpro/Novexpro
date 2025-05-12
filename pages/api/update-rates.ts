import { NextApiRequest, NextApiResponse } from "next";

/**
 * API endpoint to trigger background update of exchange rates
 * This can be called by a cron job to keep the data fresh
 * 
 * Example cron setup:
 * - Use a service like Vercel Cron Jobs or standalone cron service
 * - Set to run every hour
 * - Call this endpoint with a secret key for verification
 */

const API_KEY = process.env.UPDATE_RATES_API_KEY || "default-secure-key";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Security check
    const key = req.query.key || req.headers['x-api-key'];
    if (key !== API_KEY) {
      console.log("Unauthorized update attempt with incorrect API key");
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    console.log("Starting background update of exchange rates...");
    
    // Trigger RBI update
    let rbiSuccess = false;
    try {
      const rbiResponse = await fetch(`${getBaseUrl()}/api/rbi?backgroundUpdate=true`);
      const rbiResult = await rbiResponse.json();
      rbiSuccess = rbiResult.success || false;
      console.log("RBI update result:", rbiSuccess ? "Success" : "Failed");
    } catch (error) {
      console.error("Error updating RBI rates:", error);
    }
    
    // Trigger SBI TT update
    let sbiSuccess = false;
    try {
      const sbiResponse = await fetch(`${getBaseUrl()}/api/sbitt?backgroundUpdate=true`);
      const sbiResult = await sbiResponse.json();
      sbiSuccess = sbiResult.success || false;
      console.log("SBI TT update result:", sbiSuccess ? "Success" : "Failed");
    } catch (error) {
      console.error("Error updating SBI TT rates:", error);
    }
    
    return res.status(200).json({
      success: rbiSuccess || sbiSuccess, // Consider success if at least one update worked
      message: `Updates completed. RBI: ${rbiSuccess ? "Success" : "Failed"}, SBI TT: ${sbiSuccess ? "Success" : "Failed"}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in update-rates API:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating rates",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Helper function to get the base URL for self-referential API calls
function getBaseUrl() {
  // In production, use the VERCEL_URL environment variable
  // In development, use localhost
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
  return baseUrl;
} 