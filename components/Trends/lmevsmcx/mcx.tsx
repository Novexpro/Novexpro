'use client';

import React from 'react';
import { Area } from 'recharts';

// Interface for MCX data point
export interface MCXDataPoint {
    timestamp: string;
    value: number;
}

// Static data for MCX Current Month in the range of 200-400
export const staticMcxCurrentData: MCXDataPoint[] = [
    { timestamp: '2025-05-20T09:00:00Z', value: 230 },
    { timestamp: '2025-05-20T10:00:00Z', value: 245 },
    { timestamp: '2025-05-20T11:00:00Z', value: 260 },
    { timestamp: '2025-05-20T12:00:00Z', value: 275 },
    { timestamp: '2025-05-20T13:00:00Z', value: 290 },
    { timestamp: '2025-05-20T14:00:00Z', value: 305 },
    { timestamp: '2025-05-20T15:00:00Z', value: 320 },
    { timestamp: '2025-05-20T16:00:00Z', value: 335 }
];

// Static data for MCX Next Month in the range of 200-400
export const staticMcxNextData: MCXDataPoint[] = [
    { timestamp: '2025-05-20T09:00:00Z', value: 240 },
    { timestamp: '2025-05-20T10:00:00Z', value: 255 },
    { timestamp: '2025-05-20T11:00:00Z', value: 270 },
    { timestamp: '2025-05-20T12:00:00Z', value: 285 },
    { timestamp: '2025-05-20T13:00:00Z', value: 300 },
    { timestamp: '2025-05-20T14:00:00Z', value: 315 },
    { timestamp: '2025-05-20T15:00:00Z', value: 330 },
    { timestamp: '2025-05-20T16:00:00Z', value: 345 }
];

// Static data for MCX Third Month in the range of 200-400
export const staticMcxThirdData: MCXDataPoint[] = [
    { timestamp: '2025-05-20T09:00:00Z', value: 250 },
    { timestamp: '2025-05-20T10:00:00Z', value: 265 },
    { timestamp: '2025-05-20T11:00:00Z', value: 280 },
    { timestamp: '2025-05-20T12:00:00Z', value: 295 },
    { timestamp: '2025-05-20T13:00:00Z', value: 310 },
    { timestamp: '2025-05-20T14:00:00Z', value: 325 },
    { timestamp: '2025-05-20T15:00:00Z', value: 340 },
    { timestamp: '2025-05-20T16:00:00Z', value: 355 }
];

// Static month names
export const staticMonthNames = {
    currentMonth: 'May 2025',
    nextMonth: 'June 2025',
    thirdMonth: 'July 2025'
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
            dot: '#10B981',
            name: staticMonthNames.currentMonth
        },
        mcxNext: {
            stroke: '#F59E0B',
            fill: 'url(#mcxNextGradient)',
            dot: '#F59E0B',
            name: staticMonthNames.nextMonth
        },
        mcxThird: {
            stroke: '#8B5CF6',
            fill: 'url(#mcxThirdGradient)',
            dot: '#8B5CF6',
            name: staticMonthNames.thirdMonth
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
            dot={{ r: 3, fill: colors[type].dot }}
            activeDot={{ r: 6, fill: colors[type].dot, stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={true}
            animationDuration={1000}
            connectNulls={true}
        />
    );
};

// Function to process MCX Current Month data
export const processMcxCurrentData = (dataMap: Map<string, any>) => {
    staticMcxCurrentData.forEach(item => {
        const { timestamp, value } = item;
        const displayTime = new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const displayDate = new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        const date = timestamp.split('T')[0];
        
        if (!dataMap.has(timestamp)) {
            dataMap.set(timestamp, {
                date,
                displayDate,
                displayTime
            });
        }
        
        const dataPoint = dataMap.get(timestamp)!;
        dataPoint.mcxCurrent = value;
    });
    
    return dataMap;
};

// Function to process MCX Next Month data
export const processMcxNextData = (dataMap: Map<string, any>) => {
    staticMcxNextData.forEach(item => {
        const { timestamp, value } = item;
        const displayTime = new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const displayDate = new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        const date = timestamp.split('T')[0];
        
        if (!dataMap.has(timestamp)) {
            dataMap.set(timestamp, {
                date,
                displayDate,
                displayTime
            });
        }
        
        const dataPoint = dataMap.get(timestamp)!;
        dataPoint.mcxNext = value;
    });
    
    return dataMap;
};

// Function to process MCX Third Month data
export const processMcxThirdData = (dataMap: Map<string, any>) => {
    staticMcxThirdData.forEach(item => {
        const { timestamp, value } = item;
        const displayTime = new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const displayDate = new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        const date = timestamp.split('T')[0];
        
        if (!dataMap.has(timestamp)) {
            dataMap.set(timestamp, {
                date,
                displayDate,
                displayTime
            });
        }
        
        const dataPoint = dataMap.get(timestamp)!;
        dataPoint.mcxThird = value;
    });
    
    return dataMap;
};
