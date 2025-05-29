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

    // Generate data points for today at different times
    for (let i = 0; i < 15; i++) {
        // Alternate between 9 AM and 12 PM for different days
        const hour = i % 2 === 0 ? 9 : 12;

        // Go back by the appropriate number of days
        const date = new Date(today);
        date.setUTCDate(today.getUTCDate() - Math.floor(i / 2));
        date.setUTCHours(hour, 0, 0, 0);

        // Generate a price with some variation
        const basePrice = 240 - (i * 2);
        const change = i === 0 ? 0 : Math.floor(Math.random() * 5) + 1;
        const prevPrice = i === 0 ? basePrice : fallbackData[i - 1].spotPrice;
        const spotPrice = i === 0 ? basePrice : prevPrice + change;
        const changePercent = i === 0 ? 0 : parseFloat(((change / prevPrice) * 100).toFixed(2));

        fallbackData.push({
            createdAt: date,
            spotPrice,
            change,
            changePercent,
            source: 'LME'
        });
    }

    // Reverse the array so it's in ascending date order
    return fallbackData.reverse();
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
        const sbiResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/sbitt`);

        if (!sbiResponse.ok) {
            console.error(`Error fetching SBI TT rate: ${sbiResponse.status} ${sbiResponse.statusText}`);
            return res.status(500).json({ success: false, message: 'Failed to fetch SBI TT rate' });
        }

        const sbiData = await sbiResponse.json();

        if (!sbiData.success || !sbiData.data || sbiData.data.length === 0) {
            console.error('Invalid or empty SBI TT rate data:', sbiData);
            return res.status(500).json({ success: false, message: 'Invalid SBI TT rate data' });
        }

        const latestSbiRate = parseFloat(sbiData.data[0].sbi_tt_sell);
        console.log(`Latest SBI TT rate: ${latestSbiRate}`);

        console.log('======= LME DATA API CALLED =======');

        // Get current date and time
        const now = new Date();
        console.log(`Current time: ${now.toISOString()}`);
        console.log(`Current time (Local): ${now.toString()}`);

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
        console.log(`Trading hours: ${todayTradingStart.toISOString()} to ${todayTradingEnd.toISOString()}`);

        console.log('Using approach from lme-trends.ts to get ALL data for today');

        // Create the trading start time for today (9:00 AM)
        const todayTradingStartTime = new Date(today);
        todayTradingStartTime.setUTCHours(TRADING_START_HOUR, 0, 0, 0);

        console.log(`Today's trading start time: ${todayTradingStartTime.toISOString()}`);

        // Get data only from 9:00 AM onwards
        const allTodayData = await prisma.metalPrice.findMany({
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

        // Log all records to understand what data we have
        if (allTodayData.length > 0) {
            console.log('First few records:');
            allTodayData.slice(0, 3).forEach((record, index) => {
                console.log(`Record ${index}:`, {
                    id: record.id,
                    time: new Date(record.createdAt).toISOString(),
                    localTime: new Date(record.createdAt).toString(),
                    spotPrice: Number(record.spotPrice)
                });
            });
        } else {
            console.log('No records found in the database!');
        }

        // Use ALL of today's data
        const metalPrices = allTodayData;
        console.log(`Using all ${metalPrices.length} records for today`);

        // Determine data source for the response
        let responseDataSource = 'today-all';

        // If no data found for today, get recent historical data but still filter by trading hours
        let sortedData = metalPrices;

        if (metalPrices.length === 0) {
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

/**
 * Calculate statistics from the formatted data points
 */
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
