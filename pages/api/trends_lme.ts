import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        console.log('Trends API called with query:', req.query);

        // Get query parameters or use defaults
        const {
            days = 7, // Default to 7 days of data
            limit = 1000 // Increase default limit to ensure we get all data
        } = req.query;

        // Calculate the date range (last X days) with timezone handling
        const endDate = new Date();
        // Set end date to end of current day to include all today's data
        endDate.setHours(23, 59, 59, 999);
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - Number(days));
        // Set start date to beginning of that day to include all data
        startDate.setHours(0, 0, 0, 0);

        // Log the received parameters
        console.log(`Fetching trends data, days: ${days}, limit: ${limit}, date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

        // First, check what data is available in the database
        const totalRecords = await prisma.metalPrice.count({
            where: {
                metal: 'LME CSP'
            }
        });
        
        console.log(`Total 'LME CSP' records in database: ${totalRecords}`);
        
        // Check date range of available data
        const oldestRecord = await prisma.metalPrice.findFirst({
            where: {
                metal: 'LME CSP'
            },
            orderBy: {
                lastUpdated: 'asc'
            },
            select: {
                lastUpdated: true
            }
        });
        
        const newestRecord = await prisma.metalPrice.findFirst({
            where: {
                metal: 'LME CSP'
            },
            orderBy: {
                lastUpdated: 'desc'
            },
            select: {
                lastUpdated: true
            }
        });
        
        console.log(`Available data range: ${oldestRecord?.lastUpdated?.toISOString() || 'none'} to ${newestRecord?.lastUpdated?.toISOString() || 'none'}`);
        
        // Check how many records match our date filter
        const matchingRecordsCount = await prisma.metalPrice.count({
            where: {
                metal: 'LME CSP',
                lastUpdated: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });
        
        console.log(`Records matching date filter: ${matchingRecordsCount}`);
        
        // Fetch price data from database with date filtering
        const priceData = await prisma.metalPrice.findMany({
            where: {
                metal: 'LME CSP',
                lastUpdated: {
                    gte: startDate,
                    lte: endDate
                }
            },
            orderBy: {
                lastUpdated: 'asc'
            },
            take: Number(limit),
            select: {
                spotPrice: true,
                change: true,
                changePercent: true,
                lastUpdated: true
            }
        });
        
        // Log the first and last few records to see what we're getting
        if (priceData.length > 0) {
            console.log('First record:', priceData[0]);
            if (priceData.length > 1) {
                console.log('Last record:', priceData[priceData.length - 1]);
            }
        }

        console.log(`Found ${priceData.length} data points`);
        if (priceData.length === 0) {
            // If no data found, attempt to get ANY data just to understand what's in the database
            const sampleData = await prisma.metalPrice.findMany({
                take: 5,
                orderBy: {
                    lastUpdated: 'desc'
                }
            });
            console.log('Sample of available data:', sampleData);
        }

        // Format the data for the front-end chart and ensure unique data points
        // First convert the data
        const rawFormattedData = priceData.map(record => ({
            time: record.lastUpdated.toISOString(),
            // Convert Prisma Decimal to number
            value: parseFloat(record.spotPrice.toString()),
            change: parseFloat(record.change.toString()),
            changePercent: parseFloat(record.changePercent.toString()),
            // Add a readable time format for display
            displayTime: record.lastUpdated.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            }),
            // Add date for grouping
            dateKey: record.lastUpdated.toISOString().split('T')[0] + 'T' + 
                     record.lastUpdated.toISOString().split('T')[1].substring(0, 5) // YYYY-MM-DDTHH:MM format
        }));
        
        // Group by dateKey and take the latest record for each group
        const groupedData = {};
        rawFormattedData.forEach(record => {
            // If this dateKey doesn't exist yet or this record is newer, update it
            if (!groupedData[record.dateKey] || new Date(record.time) > new Date(groupedData[record.dateKey].time)) {
                groupedData[record.dateKey] = record;
            }
        });
        
        // Convert back to array and sort by time
        const formattedData = Object.values(groupedData)
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        
        console.log(`Reduced from ${rawFormattedData.length} to ${formattedData.length} unique data points`);

        // Calculate stats about the data
        const stats = {
            count: formattedData.length,
            minPrice: formattedData.length > 0
                ? Math.min(...formattedData.map(d => d.value))
                : 0,
            maxPrice: formattedData.length > 0
                ? Math.max(...formattedData.map(d => d.value))
                : 0,
            avgPrice: formattedData.length > 0
                ? formattedData.reduce((sum, d) => sum + d.value, 0) / formattedData.length
                : 0,
            startPrice: formattedData.length > 0
                ? formattedData[0].value
                : 0,
            endPrice: formattedData.length > 0
                ? formattedData[formattedData.length - 1].value
                : 0,
            // Overall change from start to end
            totalChange: formattedData.length > 0 && formattedData.length > 1
                ? formattedData[formattedData.length - 1].value - formattedData[0].value
                : 0,
            // Overall percentage change
            totalChangePercent: formattedData.length > 0 && formattedData.length > 1 && formattedData[0].value !== 0
                ? ((formattedData[formattedData.length - 1].value - formattedData[0].value) / formattedData[0].value) * 100
                : 0
        };

        // Return the data and statistics
        res.status(200).json({
            success: true,
            data: formattedData,
            stats,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching trend data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch price trend data',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}