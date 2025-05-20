'use client';

import React, { useState } from 'react';
import { 
    XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, AreaChart, Area 
} from 'recharts';

// Import static data from lme and mcx files
import { staticLmeData } from './lme';
import { 
    staticMcxCurrentData, 
    staticMcxNextData, 
    staticMcxThirdData, 
    staticMonthNames 
} from './mcx';

// Interface for our chart data
interface ChartDataPoint {
    time: string;
    lme: number;
    mcxCurrent: number;
    mcxNext: number;
    mcxThird: number;
}

// Create static chart data directly
const createChartData = (): ChartDataPoint[] => {
    return [
        { time: '02:30 PM', lme: 220, mcxCurrent: 230, mcxNext: 240, mcxThird: 250 },
        { time: '03:30 PM', lme: 235, mcxCurrent: 245, mcxNext: 255, mcxThird: 265 },
        { time: '04:30 PM', lme: 250, mcxCurrent: 260, mcxNext: 270, mcxThird: 280 },
        { time: '05:30 PM', lme: 265, mcxCurrent: 275, mcxNext: 285, mcxThird: 295 },
        { time: '06:30 PM', lme: 280, mcxCurrent: 290, mcxNext: 300, mcxThird: 310 },
        { time: '07:30 PM', lme: 295, mcxCurrent: 305, mcxNext: 315, mcxThird: 325 },
        { time: '08:30 PM', lme: 310, mcxCurrent: 320, mcxNext: 330, mcxThird: 340 },
        { time: '09:30 PM', lme: 325, mcxCurrent: 335, mcxNext: 345, mcxThird: 355 }
    ];
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    
    return (
        <div className="bg-white p-3 border border-gray-200 rounded-md shadow-md">
            <p className="font-medium text-gray-800 mb-2">{label}</p>
            {payload.map((entry: any, index: number) => (
                <div key={index} className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-xs font-medium flex items-center">
                        <span 
                            className="h-2 w-2 rounded-full mr-1"
                            style={{ backgroundColor: entry.color }}
                        ></span>
                        {entry.name}
                    </span>
                    <span className="text-xs font-semibold">{entry.value.toFixed(2)}</span>
                </div>
            ))}
        </div>
    );
};

const LMEvsMCXChart: React.FC = () => {
    // State for visible lines
    const [visibleLines, setVisibleLines] = useState({
        lme: true,
        mcxCurrent: true,
        mcxNext: false,
        mcxThird: false
    });

    // Toggle visibility of a line
    const toggleLine = (line: 'lme' | 'mcxCurrent' | 'mcxNext' | 'mcxThird') => {
        setVisibleLines(prev => ({
            ...prev,
            [line]: !prev[line]
        }));
    };

    // Chart data
    const chartData = createChartData();

    return (
        <div className="w-full">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">LME vs MCX Price Comparison</h2>
                    </div>
                </div>

                {/* Buttons - Mobile responsive */}
                <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <button
                        className={`px-4 py-2 text-sm rounded-md transition-all w-full sm:w-auto ${
                            visibleLines.lme
                                ? 'bg-white shadow-sm text-blue-600 font-medium'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => toggleLine('lme')}
                    >
                        LME
                    </button>
                    
                    <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>
                    
                    <button
                        className={`px-4 py-2 text-sm rounded-md transition-all w-full sm:w-auto ${
                            visibleLines.mcxCurrent
                                ? 'bg-white shadow-sm text-green-600 font-medium'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => toggleLine('mcxCurrent')}
                    >
                        {staticMonthNames.currentMonth}
                    </button>
                    
                    <button
                        className={`px-4 py-2 text-sm rounded-md transition-all w-full sm:w-auto ${
                            visibleLines.mcxNext
                                ? 'bg-white shadow-sm text-amber-600 font-medium'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => toggleLine('mcxNext')}
                    >
                        {staticMonthNames.nextMonth}
                    </button>
                    
                    <button
                        className={`px-4 py-2 text-sm rounded-md transition-all w-full sm:w-auto ${
                            visibleLines.mcxThird
                                ? 'bg-white shadow-sm text-purple-600 font-medium'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => toggleLine('mcxThird')}
                    >
                        {staticMonthNames.thirdMonth}
                    </button>
                </div>

                {/* Chart container - Mobile responsive */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-3 sm:p-6 hover:shadow-md transition-shadow duration-300">
                    <div className="h-[300px] sm:h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={chartData}
                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="lmeGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="mcxCurrentGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="mcxNextGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="mcxThirdGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                
                                <XAxis 
                                    dataKey="time" 
                                    tick={{ fontSize: 10, fill: '#6B7280' }}
                                    axisLine={{ stroke: '#E5E7EB' }}
                                    tickLine={false}
                                />
                                
                                <YAxis 
                                    domain={[200, 400]}
                                    tick={{ fontSize: 10, fill: '#6B7280' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={30}
                                />
                                
                                <Tooltip content={<CustomTooltip />} />
                                
                                {/* LME Area */}
                                {visibleLines.lme && (
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
                                    />
                                )}
                                
                                {/* MCX Current Month Area */}
                                {visibleLines.mcxCurrent && (
                                    <Area
                                        type="monotone"
                                        dataKey="mcxCurrent"
                                        name={staticMonthNames.currentMonth}
                                        stroke="#10B981"
                                        fill="url(#mcxCurrentGradient)"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: '#10B981' }}
                                        activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                                        isAnimationActive={true}
                                    />
                                )}
                                
                                {/* MCX Next Month Area */}
                                {visibleLines.mcxNext && (
                                    <Area
                                        type="monotone"
                                        dataKey="mcxNext"
                                        name={staticMonthNames.nextMonth}
                                        stroke="#F59E0B"
                                        fill="url(#mcxNextGradient)"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: '#F59E0B' }}
                                        activeDot={{ r: 6, fill: '#F59E0B', stroke: '#fff', strokeWidth: 2 }}
                                        isAnimationActive={true}
                                    />
                                )}
                                
                                {/* MCX Third Month Area */}
                                {visibleLines.mcxThird && (
                                    <Area
                                        type="monotone"
                                        dataKey="mcxThird"
                                        name={staticMonthNames.thirdMonth}
                                        stroke="#8B5CF6"
                                        fill="url(#mcxThirdGradient)"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: '#8B5CF6' }}
                                        activeDot={{ r: 6, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 2 }}
                                        isAnimationActive={true}
                                    />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LMEvsMCXChart;
