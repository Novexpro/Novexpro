'use client';

import React from 'react';
import { Area } from 'recharts';

// Interface for LME data point
export interface LMEDataPoint {
    timestamp: string;
    value: number;
}

// Static data for LME in the range of 200-400
export const staticLmeData: LMEDataPoint[] = [
    { timestamp: '2025-05-20T09:00:00Z', value: 220 },
    { timestamp: '2025-05-20T10:00:00Z', value: 235 },
    { timestamp: '2025-05-20T11:00:00Z', value: 250 },
    { timestamp: '2025-05-20T12:00:00Z', value: 265 },
    { timestamp: '2025-05-20T13:00:00Z', value: 280 },
    { timestamp: '2025-05-20T14:00:00Z', value: 295 },
    { timestamp: '2025-05-20T15:00:00Z', value: 310 },
    { timestamp: '2025-05-20T16:00:00Z', value: 325 }
];

// LME Gradients component
export const LMEGradients: React.FC = () => (
    <linearGradient id="lmeGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
    </linearGradient>
);

// LME Chart component
interface LMEChartProps {
    visible: boolean;
}

export const LMEChart: React.FC<LMEChartProps> = ({ visible }) => {
    if (!visible) {
        return null;
    }
    
    return (
        <Area
            type="monotone"
            dataKey="lme"
            name="LME"
            stroke="#3B82F6"
            fill="url(#lmeGradient)"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3B82F6' }}
            activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={true}
            animationDuration={1000}
            connectNulls={true}
        />
    );
};

// Function to process LME data
export const processLmeData = (dataMap: Map<string, any>) => {
    staticLmeData.forEach(item => {
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
        dataPoint.lme = value;
    });
    
    return dataMap;
};
