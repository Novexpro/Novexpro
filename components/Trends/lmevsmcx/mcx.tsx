'use client';

import React, { useState, useEffect } from 'react';
import { Area } from 'recharts';

// Interface for MCX data point
export interface MCXDataPoint {
    createdAt: string;
    value: number;
    displayTime?: string;
}

// Fallback data in case API fails
const fallbackMcxCurrentData: MCXDataPoint[] = [
    { createdAt: '2025-05-20T09:00:00Z', value: 230, displayTime: '09:00 AM' },
    { createdAt: '2025-05-20T10:00:00Z', value: 245, displayTime: '10:00 AM' },
    { createdAt: '2025-05-20T11:00:00Z', value: 260, displayTime: '11:00 AM' },
    { createdAt: '2025-05-20T12:00:00Z', value: 275, displayTime: '12:00 PM' },
    { createdAt: '2025-05-20T13:00:00Z', value: 290, displayTime: '01:00 PM' },
    { createdAt: '2025-05-20T14:00:00Z', value: 305, displayTime: '02:00 PM' },
    { createdAt: '2025-05-20T15:00:00Z', value: 320, displayTime: '03:00 PM' },
    { createdAt: '2025-05-20T16:00:00Z', value: 335, displayTime: '04:00 PM' }
];

// Fallback data for MCX Next Month
const fallbackMcxNextData: MCXDataPoint[] = [
    { createdAt: '2025-05-20T09:00:00Z', value: 240, displayTime: '09:00 AM' },
    { createdAt: '2025-05-20T10:00:00Z', value: 255, displayTime: '10:00 AM' },
    { createdAt: '2025-05-20T11:00:00Z', value: 270, displayTime: '11:00 AM' },
    { createdAt: '2025-05-20T12:00:00Z', value: 285, displayTime: '12:00 PM' },
    { createdAt: '2025-05-20T13:00:00Z', value: 300, displayTime: '01:00 PM' },
    { createdAt: '2025-05-20T14:00:00Z', value: 315, displayTime: '02:00 PM' },
    { createdAt: '2025-05-20T15:00:00Z', value: 330, displayTime: '03:00 PM' },
    { createdAt: '2025-05-20T16:00:00Z', value: 345, displayTime: '04:00 PM' }
];

// Fallback data for MCX Third Month
const fallbackMcxThirdData: MCXDataPoint[] = [
    { createdAt: '2025-05-20T09:00:00Z', value: 250, displayTime: '09:00 AM' },
    { createdAt: '2025-05-20T10:00:00Z', value: 265, displayTime: '10:00 AM' },
    { createdAt: '2025-05-20T11:00:00Z', value: 280, displayTime: '11:00 AM' },
    { createdAt: '2025-05-20T12:00:00Z', value: 295, displayTime: '12:00 PM' },
    { createdAt: '2025-05-20T13:00:00Z', value: 310, displayTime: '01:00 PM' },
    { createdAt: '2025-05-20T14:00:00Z', value: 325, displayTime: '02:00 PM' },
    { createdAt: '2025-05-20T15:00:00Z', value: 340, displayTime: '03:00 PM' },
    { createdAt: '2025-05-20T16:00:00Z', value: 355, displayTime: '04:00 PM' }
];

// Month names (will be updated from API)
export const monthNames = {
    currentMonth: 'Current Month',
    nextMonth: 'Next Month',
    thirdMonth: 'Third Month'
};

// State for MCX Current Month data
let mcxCurrentData: MCXDataPoint[] = [];

// Function to fetch MCX Current Month data from API
export const fetchMcxCurrentData = async (): Promise<MCXDataPoint[]> => {
    try {
        const response = await fetch('/api/mcx_current_month');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log(`Received ${result.data.length} MCX Current Month data points from API`);
            
            // Update month name
            if (result.currentMonth) {
                monthNames.currentMonth = result.currentMonth;
            }
            
            // Return the formatted data
            return result.data.map((item: any) => ({
                createdAt: item.createdAt,
                value: item.value,
                displayTime: item.displayTime
            }));
        } else {
            console.error('API returned error:', result.message);
            return fallbackMcxCurrentData;
        }
    } catch (error) {
        console.error('Error fetching MCX Current Month data:', error);
        return fallbackMcxCurrentData;
    }
};

// Initialize data on component load
export const initializeMcxData = async () => {
    try {
        const data = await fetchMcxCurrentData();
        if (data && data.length > 0) {
            mcxCurrentData = data;
            return true;
        } else {
            // Use fallback data if API returns empty
            mcxCurrentData = fallbackMcxCurrentData;
            return true;
        }
    } catch (error) {
        console.error('Error initializing MCX data:', error);
        // Use fallback data in case of error
        mcxCurrentData = fallbackMcxCurrentData;
        return true;
    }
};

// MCX Gradients component
export const MCXGradients: React.FC = () => (
    <>
        {/* MCX Current Gradient */}
        <linearGradient id="mcxCurrentGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
        </linearGradient>
        
        {/* MCX Next Gradient */}
        <linearGradient id="mcxNextGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.1} />
        </linearGradient>
        
        {/* MCX Third Gradient */}
        <linearGradient id="mcxThirdGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1} />
        </linearGradient>
    </>
);

// MCX Chart component
interface MCXChartProps {
    type: 'mcxCurrent' | 'mcxNext' | 'mcxThird';
    visible: boolean;
}

export const MCXChart: React.FC<MCXChartProps> = ({ type, visible }) => {
    if (!visible) {
        return null;
    }
    
    const colors = {
        mcxCurrent: {
            stroke: '#10B981',
            fill: 'url(#mcxCurrentGradient)',
            name: monthNames.currentMonth
        },
        mcxNext: {
            stroke: '#F59E0B',
            fill: 'url(#mcxNextGradient)',
            name: monthNames.nextMonth
        },
        mcxThird: {
            stroke: '#8B5CF6',
            fill: 'url(#mcxThirdGradient)',
            name: monthNames.thirdMonth
        }
    };
    
    return (
        <Area
            type="monotone"
            dataKey={type}
            name={colors[type].name}
            stroke={colors[type].stroke}
            fill={colors[type].fill}
            strokeWidth={2}
            dot={false}
            activeDot={false}
            isAnimationActive={true}
            animationDuration={1000}
            connectNulls={true}
        />
    );
};

// Function to process MCX Current Month data
export const processMcxCurrentData = (dataMap: Map<string, any>) => {
    // Use the real data fetched from API
    mcxCurrentData.forEach(item => {
        const { createdAt, value, displayTime } = item;
        
        // Create a date object from the createdAt timestamp
        const dateObj = new Date(createdAt);
        const date = createdAt.split('T')[0];
        
        const displayDate = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        // Use the timestamp as the key for the data map
        if (!dataMap.has(createdAt)) {
            dataMap.set(createdAt, {
                date,
                displayDate,
                displayTime: displayTime || ''
            });
        }
        
        const dataPoint = dataMap.get(createdAt)!;
        dataPoint.mcxCurrent = value;
    });
    
    return dataMap;
};

// Function to process MCX Next Month data
export const processMcxNextData = (dataMap: Map<string, any>) => {
    // Using fallback data for now
    fallbackMcxNextData.forEach(item => {
        const { createdAt, value, displayTime } = item;
        
        // Create a date object from the createdAt timestamp
        const dateObj = new Date(createdAt);
        const date = createdAt.split('T')[0];
        
        const displayDate = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        // Use the timestamp as the key for the data map
        if (!dataMap.has(createdAt)) {
            dataMap.set(createdAt, {
                date,
                displayDate,
                displayTime: displayTime || ''
            });
        }
        
        const dataPoint = dataMap.get(createdAt)!;
        dataPoint.mcxNext = value;
    });
    
    return dataMap;
};

// Function to process MCX Third Month data
export const processMcxThirdData = (dataMap: Map<string, any>) => {
    // Using fallback data for now
    fallbackMcxThirdData.forEach(item => {
        const { createdAt, value, displayTime } = item;
        
        // Create a date object from the createdAt timestamp
        const dateObj = new Date(createdAt);
        const date = createdAt.split('T')[0];
        
        const displayDate = dateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        // Use the timestamp as the key for the data map
        if (!dataMap.has(createdAt)) {
            dataMap.set(createdAt, {
                date,
                displayDate,
                displayTime: displayTime || ''
            });
        }
        
        const dataPoint = dataMap.get(createdAt)!;
        dataPoint.mcxThird = value;
    });
    
    return dataMap;
};
