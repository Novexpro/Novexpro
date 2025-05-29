import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

// Create a new PrismaClient instance with error handling
let prisma: PrismaClient;
try {
    prisma = new PrismaClient();
} catch (error) {
    console.error('Failed to initialize Prisma client:', error);
    // We'll handle this case in the API handler
}

// Generate dynamic fallback data based on the current date
function generateFallbackLmeData() {
    // Get current date and use it as a base
    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    const fallbackData: Array<{
        createdAt: Date;
        spotPrice: number;
        change: number;
        changePercent: number;
        source: string;
    }> = [];

    // Create data points for the current trading day at regular intervals
    // This ensures we have enough points for a smooth graph
    const tradingStartHour = 9; // 9:00 AM UTC
    const tradingEndHour = 23; // 11:00 PM UTC
    const tradingEndMinute = 30; // 11:30 PM UTC
    
    // Generate data points every 30 minutes from 9:00 AM to 11:30 PM
    let basePrice = 240; // Starting price
    let prevPrice = basePrice;
    
    // Create a consistent set of data points for today's trading hours
    for (let hour = tradingStartHour; hour <= tradingEndHour; hour++) {
        // For each hour, create data points at :00 and :30 past the hour
        // Except for the end hour (23), where we only go up to :30
        const minuteValues = (hour === tradingEndHour) ? [0, tradingEndMinute] : [0, 30];
        
        for (const minute of minuteValues) {
            // Skip the last point if it would be after trading hours
            if (hour === tradingEndHour && minute > tradingEndMinute) continue;
            
            // Create the timestamp for this data point
            const timestamp = new Date(today);
            timestamp.setUTCHours(hour, minute, 0, 0);
            
            // Generate a realistic price with small variations
            // Use a sine wave pattern for more realistic price movements
            const timePosition = (hour - tradingStartHour) + (minute / 60);
            const cycleFactor = Math.sin(timePosition / 3) * 5; // Gentle sine wave
            
            // Add some randomness but keep it consistent
            const randomFactor = ((hour * 10) + minute) % 7 - 3; // Deterministic "random" between -3 and 3
            
            // Calculate the new price with a slight upward trend plus the variations
            const spotPrice = basePrice + (timePosition * 0.5) + cycleFactor + randomFactor;
            const roundedPrice = Math.round(spotPrice * 100) / 100;
            
            // Calculate change from previous price point
            const change = roundedPrice - prevPrice;
            const changePercent = prevPrice ? parseFloat(((change / prevPrice) * 100).toFixed(2)) : 0;
            
            // Add the data point
            fallbackData.push({
                createdAt: timestamp,
                spotPrice: roundedPrice,
                change: parseFloat(change.toFixed(2)),
                changePercent,
                source: 'LME'
            });
            
            prevPrice = roundedPrice;
        }
    }
    
    // Ensure the data is sorted by timestamp
    return fallbackData.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

// Define interfaces for type safety
interface DataPoint {
    time: string;
    value: number;
    displayTime: string;
    displayDate: string;
}

interface StatsData {
    count: number;
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    startPrice: number;
    endPrice: number;
    totalChange: number;
    totalChangePercent: number;
}

interface TradingStatus {
    isWithinTradingHours: boolean;
    dataSource: string;
    tradingStart: string;
    tradingEnd: string;
    message: string;
}

interface ApiResponse {
    success: boolean;
    data: DataPoint[];
    stats: StatsData;
    tradingStatus?: TradingStatus;
    message?: string;
    debug?: any;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ApiResponse | { success: false; message: string }>
) {
    try {
        // Check if Prisma client is initialized
        if (!prisma) {
            console.error('Prisma client not initialized, using fallback data');
            return handleWithFallbackData(req, res);
        }
        
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        if (req.method !== 'GET') {
            return res.status(405).json({ success: false, message: 'Only GET requests are allowed' });
        }

        // Fetch the latest SBI TT rate
        console.log('Fetching latest SBI TT rate...');
        let latestSbiRate = 83.5; // Default value in case of fetch failure
        
        try {
            const sbiResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/sbitt`);

            if (sbiResponse.ok) {
                const sbiData = await sbiResponse.json();

                if (sbiData.success && sbiData.data && sbiData.data.length > 0) {
                    latestSbiRate = parseFloat(sbiData.data[0].sbi_tt_sell);
                    console.log(`Latest SBI TT rate: ${latestSbiRate}`);
                } else {
                    console.warn('Invalid or empty SBI TT rate data, using default value');
                }
            } else {
                console.warn(`Error fetching SBI TT rate: ${sbiResponse.status}, using default value`);
            }
        } catch (sbiError) {
            console.error('Error fetching SBI TT rate, using default value:', sbiError);
        }

        console.log('======= LME DATA API CALLED =======');

        // Get current date and time
        const now = new Date();
        console.log(`Current time: ${now.toISOString()}`);

        // Get today's date at midnight UTC
        const today = new Date(now);
        today.setUTCHours(0, 0, 0, 0);
        console.log(`Today at midnight UTC: ${today.toISOString()}`);

        // Define trading hours (9:00 AM to 11:30 PM) in UTC
        const TRADING_START_HOUR = 9; // 9:00 AM 
        const TRADING_END_HOUR = 23; // 11:00 PM
        const TRADING_END_MINUTE = 30; // End at 23:30

        // Create trading window time objects for the response
        const todayTradingStart = new Date(today);
        todayTradingStart.setUTCHours(TRADING_START_HOUR, 0, 0, 0);

        const todayTradingEnd = new Date(today);
        todayTradingEnd.setUTCHours(TRADING_END_HOUR, TRADING_END_MINUTE, 0, 0);

        // Check if current time is within trading hours (using UTC)
        const currentHourUTC = now.getUTCHours();
        const currentMinuteUTC = now.getUTCMinutes();
        const isWithinTradingHours =
            (currentHourUTC > TRADING_START_HOUR || (currentHourUTC === TRADING_START_HOUR && currentMinuteUTC >= 0)) &&
            (currentHourUTC < TRADING_END_HOUR || (currentHourUTC === TRADING_END_HOUR && currentMinuteUTC <= TRADING_END_MINUTE));

        console.log(`Current time UTC: ${currentHourUTC}:${currentMinuteUTC}`);
        console.log(`Is within trading hours: ${isWithinTradingHours}`);
        console.log(`Trading hours: ${TRADING_START_HOUR}:00 - ${TRADING_END_HOUR}:${TRADING_END_MINUTE}`);

        // Create the trading start time for today (9:00 AM)
        const todayTradingStartTime = new Date(today);
        todayTradingStartTime.setUTCHours(TRADING_START_HOUR, 0, 0, 0);

        console.log(`Today's trading start time: ${todayTradingStartTime.toISOString()}`);

        let allTodayData = [];
        let responseDataSource = 'database';
        
        // Try to get data from the database
        try {
            // Get data only from 9:00 AM onwards
            allTodayData = await prisma.metalPrice.findMany({
                where: {
                    createdAt: {
                        gte: todayTradingStartTime // From 9:00 AM today
                    },
                    spotPrice: {
                        gt: 0 // Only positive prices
                    }
                },
                select: {
                    id: true,
                    spotPrice: true,
                    change: true,
                    changePercent: true,
                    createdAt: true,
                    source: true
                },
                orderBy: {
                    createdAt: 'asc'
                }
            });

            console.log(`Retrieved ${allTodayData.length} total records for today`);
        } catch (dbError) {
            console.error('Database query error:', dbError);
            console.log('Falling back to generated data due to database error');
            allTodayData = [];
        }

        // Use ALL of today's data
        let sortedData = allTodayData;

        // If no data found for today, get recent historical data but still filter by trading hours
        if (sortedData.length === 0) {
            try {
                console.log('No data for today, fetching recent historical data');

                // Get data from previous days, but still only from 9:00 AM to 11:30 PM
                const recentData = await prisma.metalPrice.findMany({
                    where: {
                        spotPrice: {
                            gt: 0
                        }
                    },
                    select: {
                        id: true,
                        spotPrice: true,
                        change: true,
                        changePercent: true,
                        createdAt: true,
                        source: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 100
                });

                console.log(`Retrieved ${recentData.length} historical records`);

                // Filter historical data to only include points between 9:00 AM and 11:30 PM
                const filteredHistoricalData = recentData.filter(item => {
                    const timestamp = new Date(item.createdAt);
                    const hours = timestamp.getUTCHours();
                    const minutes = timestamp.getUTCMinutes();

                    // If it's the end hour (23), only include up to the specified minute (30)
                    if (hours === 23) {
                        return minutes <= TRADING_END_MINUTE;
                    }

                    // Include all data points between 9:00 AM and 11:00 PM
                    return hours >= TRADING_START_HOUR && hours < TRADING_END_HOUR;
                });

                console.log(`Filtered to ${filteredHistoricalData.length} historical records within trading hours`);

                // Reverse to get ascending order
                sortedData = [...filteredHistoricalData].reverse();
                responseDataSource = 'historical';
            } catch (historyError) {
                console.error('Error fetching historical data:', historyError);
                console.log('Falling back to generated data due to historical data fetch error');
                sortedData = [];
            }
        }

        console.log(`Using ${sortedData.length} records for the chart`);

        // If no data found after filtering, use fallback data
        if (sortedData.length === 0) {
            console.log('No LME data found in database, using fallback data');
            responseDataSource = 'fallback';

            // Generate dynamic fallback data based on current date
            const fallbackLmeData = generateFallbackLmeData();
            console.log(`Generated ${fallbackLmeData.length} fallback data points`);

            // Use fallback data instead with SBI TT rate calculation
            const formattedFallbackData = fallbackLmeData.map(item => formatDataPoint({
                spotPrice: item.spotPrice,
                change: item.change,
                changePercent: item.changePercent,
                createdAt: item.createdAt,
                source: item.source,
                sbiTTRate: latestSbiRate
            }));

            const fallbackStats = calculateStats(formattedFallbackData);

            return res.status(200).json({
                success: true,
                data: formattedFallbackData,
                stats: fallbackStats,
                tradingStatus: {
                    isWithinTradingHours,
                    dataSource: responseDataSource,
                    tradingStart: todayTradingStart.toISOString(),
                    tradingEnd: todayTradingEnd.toISOString(),
                    message: 'Using sample LME data (no actual data found in database)'
                },
                debug: {
                    dataSource: responseDataSource,
                    recordCount: formattedFallbackData.length
                }
            });
        }

        // Format the data with SBI TT rate calculation
        const formattedData = sortedData.map(item => formatDataPoint({
            spotPrice: item.spotPrice,
            change: item.change,
            changePercent: item.changePercent,
            createdAt: item.createdAt,
            source: item.source || undefined, // Convert null to undefined
            sbiTTRate: latestSbiRate
        }));

        console.log(`Formatted ${formattedData.length} data points for the chart`);
        if (formattedData.length > 0) {
            console.log('First formatted point:', formattedData[0]);
            console.log('Last formatted point:', formattedData[formattedData.length - 1]);
        }

        // Calculate stats
        const stats = calculateStats(formattedData);

        // Log the first and last record timestamps if available
        if (sortedData.length > 0) {
            const firstRecord = sortedData[0];
            const lastRecord = sortedData[sortedData.length - 1];
            console.log(`First record time: ${new Date(firstRecord.createdAt).toISOString()}`);
            console.log(`Last record time: ${new Date(lastRecord.createdAt).toISOString()}`);
        }

        // Return the data
        return res.status(200).json({
            success: true,
            data: formattedData,
            stats,
            tradingStatus: {
                isWithinTradingHours,
                dataSource: responseDataSource,
                tradingStart: todayTradingStart.toISOString(),
                tradingEnd: todayTradingEnd.toISOString(),
                message: isWithinTradingHours ? 'Market is currently open' : 'Market is currently closed'
            },
            debug: {
                dataSource: responseDataSource,
                recordCount: formattedData.length
            }
        });
    } catch (error) {
        console.error('Error fetching LME data:', error);

        // If there's an error, use fallback data instead of failing
        console.log('Error occurred, using fallback data');
        return handleWithFallbackData(req, res);
    }
}

/**
 * Format a database record into a data point for the chart
 * Uses UTC time values directly to avoid timezone issues
 */
function formatDataPoint(item: {
    spotPrice: any;
    change?: any;
    changePercent?: any;
    createdAt: Date;
    source?: string;
    sbiTTRate: number;
}): DataPoint {
    const originalPrice = Number(item.spotPrice);
    const timestamp = new Date(item.createdAt);

    // Apply the formula: (spotPrice * 1.0825 * sbiTTRate) / 1000
    const calculatedPrice = (originalPrice * 1.0825 * item.sbiTTRate) / 1000;

    console.log(`Formatting timestamp: ${timestamp.toISOString()}`);
    console.log(`Original price: ${originalPrice}, SBI TT rate: ${item.sbiTTRate}, Calculated price: ${calculatedPrice}`);

    // Format time using UTC values directly
    const hours = timestamp.getUTCHours();
    const minutes = timestamp.getUTCMinutes();
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayTime = `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;

    // Format date using UTC values
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = timestamp.getUTCMonth();
    const day = timestamp.getUTCDate();
    const year = timestamp.getUTCFullYear();
    const displayDate = `${monthNames[month]} ${day}, ${year}`;

    const dataPoint = {
        time: timestamp.toISOString(),
        value: calculatedPrice,
        originalValue: originalPrice,
        sbiTTRate: item.sbiTTRate,
        displayTime,
        displayDate
    };

    console.log(`Formatted data point: ${JSON.stringify(dataPoint)}`);
    return dataPoint;
}

// Function to handle the request with fallback data when database is not available
async function handleWithFallbackData(req: NextApiRequest, res: NextApiResponse) {
    try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        if (req.method !== 'GET') {
            return res.status(405).json({ success: false, message: 'Only GET requests are allowed' });
        }

        console.log('Using fallback data handler');

        // Default SBI TT rate if we can't fetch it
        let latestSbiRate = 83.5; // Default value

        try {
            // Try to fetch the latest SBI TT rate
            const sbiResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/sbitt`);
            if (sbiResponse.ok) {
                const sbiData = await sbiResponse.json();
                if (sbiData.success && sbiData.data && sbiData.data.length > 0) {
                    latestSbiRate = parseFloat(sbiData.data[0].sbi_tt_sell);
                    console.log(`Fetched SBI TT rate: ${latestSbiRate}`);
                }
            }
        } catch (sbiError) {
            console.error('Error fetching SBI TT rate, using default:', sbiError);
        }

        // Get current date and time
        const now = new Date();
        
        // Get today's date at midnight UTC
        const today = new Date(now);
        today.setUTCHours(0, 0, 0, 0);
        
        // Define trading hours (9:00 AM to 11:30 PM) in UTC
        const TRADING_START_HOUR = 9; // 9:00 AM 
        const TRADING_END_HOUR = 23; // 11:00 PM
        const TRADING_END_MINUTE = 30; // End at 23:30
        
        // Create trading window time objects for the response
        const todayTradingStart = new Date(today);
        todayTradingStart.setUTCHours(TRADING_START_HOUR, 0, 0, 0);
        
        const todayTradingEnd = new Date(today);
        todayTradingEnd.setUTCHours(TRADING_END_HOUR, TRADING_END_MINUTE, 0, 0);
        
        // Check if current time is within trading hours (using UTC)
        const currentHourUTC = now.getUTCHours();
        const currentMinuteUTC = now.getUTCMinutes();
        const isWithinTradingHours =
            (currentHourUTC > TRADING_START_HOUR || (currentHourUTC === TRADING_START_HOUR && currentMinuteUTC >= 0)) &&
            (currentHourUTC < TRADING_END_HOUR || (currentHourUTC === TRADING_END_HOUR && currentMinuteUTC <= TRADING_END_MINUTE));
        
        // Generate fallback data
        const fallbackLmeData = generateFallbackLmeData();
        
        // Format the fallback data
        const formattedData = fallbackLmeData.map(item => formatDataPoint({
            spotPrice: item.spotPrice,
            change: item.change,
            changePercent: item.changePercent,
            createdAt: item.createdAt,
            source: item.source,
            sbiTTRate: latestSbiRate
        }));
        
        // Calculate stats
        const stats = calculateStats(formattedData);
        
        // Return the fallback data
        return res.status(200).json({
            success: true,
            data: formattedData,
            stats,
            tradingStatus: {
                isWithinTradingHours,
                dataSource: 'fallback',
                tradingStart: todayTradingStart.toISOString(),
                tradingEnd: todayTradingEnd.toISOString(),
                message: 'Using sample LME data (database not available)'
            },
            debug: {
                dataSource: 'fallback',
                recordCount: formattedData.length
            }
        });
    } catch (error) {
        console.error('Error in fallback handler:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate fallback data'
        });
    }
}

/**
 * Calculate statistics from the formatted data points
 */
function calculateStats(data: DataPoint[]): StatsData {
    if (data.length === 0) {
        return {
            count: 0,
            minPrice: 0,
            maxPrice: 0,
            avgPrice: 0,
            startPrice: 0,
            endPrice: 0,
            totalChange: 0,
            totalChangePercent: 0
        };
    }

    const prices = data.map(item => item.value);
    const count = prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, val) => sum + val, 0) / count;
    const startPrice = data[0].value;
    const endPrice = data[data.length - 1].value;
    const totalChange = endPrice - startPrice;
    const totalChangePercent = (totalChange / startPrice) * 100;

    return {
        count,
        minPrice,
        maxPrice,
        avgPrice,
        startPrice,
        endPrice,
        totalChange,
        totalChangePercent
    };
}