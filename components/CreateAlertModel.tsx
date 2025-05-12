"use client";

import React, { useState } from 'react';
import { X, AlertTriangle, Bell, MessageSquare, Mail } from 'lucide-react';

interface AlertFormData {
    targetPrice: number;
    customMessage: string;
    notifications: {
        web: boolean;
        whatsapp: boolean;
        email: boolean;
    };
}

interface CreateAlertModalProps {
    onClose: () => void;
    onCreate: (alert: { targetPrice: number; customMessage?: string }) => void;
}

export default function CreateAlertModal({ onClose, onCreate }: CreateAlertModalProps) {
    const [formData, setFormData] = useState<AlertFormData>({
        targetPrice: 0,
        customMessage: '',
        notifications: {
            web: true,
            whatsapp: false,
            email: false
        }
    });

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'targetPrice' ? parseFloat(value) || 0 : value
        }));
    };

    const handleNotificationChange = (type: keyof AlertFormData['notifications']) => {
        setFormData(prev => ({
            ...prev,
            notifications: {
                ...prev.notifications,
                [type]: !prev.notifications[type]
            }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        setTimeout(() => {
            onCreate({
                targetPrice: formData.targetPrice,
                customMessage: formData.customMessage || undefined
            });
            setIsSubmitting(false);
        }, 1000);
    };

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xl">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            Create Price Alert
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Target Price (₹)
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 dark:text-gray-400">₹</span>
                            </div>
                            <input
                                type="number"
                                name="targetPrice"
                                value={formData.targetPrice || ''}
                                onChange={handleChange}
                                className="block w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white placeholder-gray-400"
                                placeholder="Enter target price"
                                required
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Custom Message (Optional)
                        </label>
                        <div className="relative">
                            <textarea
                                name="customMessage"
                                value={formData.customMessage}
                                onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                                placeholder="Add a custom message for your alert"
                                className="block w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white placeholder-gray-400 h-24"
                                rows={3}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Notification Methods
                        </label>
                        <div className="space-y-2">
                            <label className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${formData.notifications.web
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                    : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.notifications.web}
                                        onChange={() => handleNotificationChange('web')}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 rounded"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                    <span className="text-sm font-medium dark:text-white">Web App</span>
                                </div>
                            </label>

                            <label className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${formData.notifications.whatsapp
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                    : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.notifications.whatsapp}
                                        onChange={() => handleNotificationChange('whatsapp')}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 rounded"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                    <span className="text-sm font-medium dark:text-white">WhatsApp</span>
                                </div>
                            </label>

                            <label className={`flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${formData.notifications.email
                                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                    : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.notifications.email}
                                        onChange={() => handleNotificationChange('email')}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 rounded"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                                    <span className="text-sm font-medium dark:text-white">Email</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating...
                                </>
                            ) : (
                                'Create Alert'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}