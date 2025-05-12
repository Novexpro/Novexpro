'use client';

import React, { useState, useEffect } from 'react';
import MCXMonthlyTrends from './MCXMonthlyTrends';
import MCXNextMonthTrends from './MCXNextMonthTrends';
import MCXThirdMonthTrends from './MCXThirdMonthTrends';

interface MonthNamesResponse {
    success: boolean;
    data?: {
        currentMonth: string;
        nextMonth: string;
        thirdMonth: string;
    };
    message?: string;
}

export default function MCXPriceButtons() {
    const [activeTab, setActiveTab] = useState<'current' | 'next' | 'third'>('current');
    const [monthNames, setMonthNames] = useState<{
        currentMonth: string;
        nextMonth: string;
        thirdMonth: string;
    }>({
        currentMonth: 'Current Month',
        nextMonth: 'Next Month',
        thirdMonth: 'Third Month'
    });
    const [loading, setLoading] = useState<boolean>(true);
    const setError = (message: string) => {
        console.error('Error:', message);
        // We log the error but don't store it since it's not displayed in the UI
    };

    // Fetch the month names from the API
    useEffect(() => {
        const fetchMonthNames = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/mcx_month_names');
                if (!response.ok) {
                    throw new Error('Failed to fetch month names');
                }
                const data: MonthNamesResponse = await response.json();

                if (data.success && data.data) {
                    setMonthNames({
                        currentMonth: data.data.currentMonth,
                        nextMonth: data.data.nextMonth,
                        thirdMonth: data.data.thirdMonth
                    });
                } else {
                    throw new Error(data.message || 'Invalid data format');
                }
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch month names';
                setError(errorMessage);
                console.error('Error fetching month names:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMonthNames();
    }, []);

    return (
        <div>
            <div className="flex mb-4 p-1 bg-gray-100 rounded-lg">
                <button 
                    className={`px-4 py-2 mr-2 rounded-md font-medium transition-all duration-200 ${
                        activeTab === 'current' 
                            ? 'bg-blue-500 text-white shadow-md' 
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setActiveTab('current')}
                >
                    {loading ? 'Loading...' : monthNames.currentMonth}
                </button>
                <button 
                    className={`px-4 py-2 mr-2 rounded-md font-medium transition-all duration-200 ${
                        activeTab === 'next' 
                            ? 'bg-blue-500 text-white shadow-md' 
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setActiveTab('next')}
                >
                    {loading ? 'Loading...' : monthNames.nextMonth}
                </button>
                <button 
                    className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                        activeTab === 'third' 
                            ? 'bg-blue-500 text-white shadow-md' 
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setActiveTab('third')}
                >
                    {loading ? 'Loading...' : monthNames.thirdMonth}
                </button>
            </div>

            {/* Show the appropriate component based on the active tab */}
            {activeTab === 'current' ? (
                <MCXMonthlyTrends />
            ) : activeTab === 'next' ? (
                <MCXNextMonthTrends />
            ) : (
                <MCXThirdMonthTrends />
            )}
        </div>
    );
}