"use client";

import React, { useState } from 'react';
import { Filter, Plus, Search, AlertCircle, SlidersHorizontal } from 'lucide-react';
import CreateAlertModel from './CreateAlertModel';

interface AlertFilters {
    type: 'all' | 'price' | 'percentage';
    status: 'all' | 'active' | 'inactive';
    sortBy: 'createdAt' | 'price' | 'status';
}

interface Alert {
    id: string;
    type: 'price' | 'percentage';
    value: number;
    status: 'active' | 'inactive';
    createdAt: string;
    updatedAt: string;
}

interface AlertFormData {
    targetPrice: number;
    customMessage?: string;
}

export default function ManageAlerts() {
    // Search state
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalPages] = useState<number>(5); // Mock value

    // Modal state
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

    // Filters state
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [filters, setFilters] = useState<AlertFilters>({
        type: 'all',
        status: 'all',
        sortBy: 'createdAt'
    });

    // Mock alerts data
    const [alerts, setAlerts] = useState<Alert[]>([]);

    const handleFilterChange = (newFilters: Partial<AlertFilters>) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
        setCurrentPage(1);
    };

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 mx-auto max-w-7xl">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Manage Alerts
                    </h1>
                    <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
                        Set up and manage your price alerts
                    </p>
                </div>

                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg text-sm sm:text-base w-full sm:w-auto justify-center"
                >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Create Alert</span>
                </button>
            </div>

            {/* Main Content */}
            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
                {/* Filters Panel - Mobile Toggle */}
                <div className="lg:hidden">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg shadow-xs"
                    >
                        <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                        <span className="font-medium">Filters</span>
                    </button>
                </div>

                {/* Filters Panel */}
                <div className={`${showFilters ? 'block' : 'hidden'} lg:block lg:w-72 xl:w-80`}>
                    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 h-full">
                        <div className="flex items-center gap-2 mb-4 sm:mb-6">
                            <Filter className="w-5 h-5 text-blue-600" />
                            <h2 className="text-lg font-semibold">Filters</h2>
                        </div>

                        <div className="space-y-4 sm:space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Type
                                </label>
                                <select
                                    value={filters.type}
                                    onChange={(e) => handleFilterChange({ type: e.target.value as AlertFilters['type'] })}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                >
                                    <option value="all">All Types</option>
                                    <option value="price">Price</option>
                                    <option value="percentage">Percentage</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Status
                                </label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => handleFilterChange({ status: e.target.value as AlertFilters['status'] })}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Sort By
                                </label>
                                <select
                                    value={filters.sortBy}
                                    onChange={(e) => handleFilterChange({ sortBy: e.target.value as AlertFilters['sortBy'] })}
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                >
                                    <option value="createdAt">Date Created</option>
                                    <option value="price">Price</option>
                                    <option value="status">Status</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1">
                    {/* Search Bar */}
                    <div className="mb-4 sm:mb-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search alerts..."
                                className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                            />
                        </div>
                    </div>

                    {/* Alerts List */}
                    {alerts.length > 0 ? (
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 sm:p-6 text-center text-gray-500">
                                Alerts list would be rendered here
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100">
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(currentPage - 1)}
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm sm:text-base w-full sm:w-auto"
                                >
                                    Previous
                                </button>
                                <span className="text-sm sm:text-base text-gray-600">Page {currentPage} of {totalPages}</span>
                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                    className="px-3 sm:px-4 py-1.5 sm:py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50 text-sm sm:text-base w-full sm:w-auto"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
                            <div className="flex flex-col items-center justify-center py-8 sm:py-16">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-50 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                                    <AlertCircle className="w-5 h-5 sm:w-8 sm:h-8 text-blue-600" />
                                </div>
                                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">No alerts found</h3>
                                <p className="text-xs sm:text-sm text-gray-500 text-center">Create your first price alert to get started</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Alert Modal */}
            {showCreateModal && (
                <CreateAlertModel
                    onClose={() => setShowCreateModal(false)}
                    onCreate={(newAlert: AlertFormData) => {
                        const alert: Alert = {
                            id: Math.random().toString(36).substr(2, 9),
                            type: 'price',
                            value: newAlert.targetPrice,
                            status: 'active',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        setAlerts(prev => [...prev, alert]);
                        setShowCreateModal(false);
                    }}
                />
            )}
        </div>
    );
}