import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        console.log('Metal Price All API called with query:', req.query);

        // Get query parameters or use defaults
        const {
            metal = 'LME CSP', // Default to LME CSP metal
            limit = 5000 // High limit to ensure we get all data
        } = req.query;

        console.log(`Fetching all metal price data for: ${metal}, limit: ${limit}`);

        // Fetch ALL price data from database without date filtering
        const priceData = await prisma.metalPrice.findMany({
            where: {
                metal: metal as string
            },
            orderBy: {
                lastUpdated: 'asc'
            },
            take: Number(limit),
            select: {
                id: true,
                metal: true,
                spotPrice: true,
                change: true,
                changePercent: true,
                lastUpdated: true,
                createdAt: true
            }
        });
        
        console.log(`Found ${priceData.length} total data points`);

        // Log the date range of the data we're returning
        if (priceData.length > 0) {
            const dates = priceData.map(record => record.lastUpdated);
            const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
            const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
            console.log(`API data date range: ${minDate.toISOString()} to ${maxDate.toISOString()}`);
            
            // Log counts by month and day to see distribution
            const dateCounts = {};
            priceData.forEach(record => {
                const date = record.lastUpdated;
                const dateKey = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
                dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
            });
            console.log('Data points by date:', dateCounts);
        }
        
        // Format the data for the front-end
        const formattedData = priceData.map(record => ({
            id: record.id,
            metal: record.metal,
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
            displayDate: record.lastUpdated.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }),
            createdAt: record.createdAt.toISOString()
        }));

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
                : 0,
            // Date range information
            startDate: formattedData.length > 0 ? formattedData[0].time : null,
            endDate: formattedData.length > 0 ? formattedData[formattedData.length - 1].time : null,
            // Unique dates count
            uniqueDates: formattedData.length > 0 
                ? new Set(formattedData.map(d => d.time.split('T')[0])).size 
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
        console.error('Error fetching all metal price data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch metal price data',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}