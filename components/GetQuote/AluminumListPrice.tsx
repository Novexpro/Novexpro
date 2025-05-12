import React, { useState } from 'react';
import { format } from 'date-fns';

type Manufacturer = 'NALCO' | 'Hindalco' | 'Vedanta/Balco';

interface ManufacturerConfig {
  label: string;
  productLabel: string;
}

const MANUFACTURER_CONFIG: Record<Manufacturer, ManufacturerConfig> = {
  'NALCO': {
    label: 'NALCO',
    productLabel: 'ALUMINIUM INGOT IE07'
  },
  'Hindalco': {
    label: 'Hindalco',
    productLabel: 'P0610 (99.85% min) /P1020/ EC Grade Ingot & Sow 99.7% (min) / Cast Bar'
  },
  'Vedanta/Balco': {
    label: 'Vedanta/Balco',
    productLabel: 'P1020 / EC High purity above 99.7%'
  }
};

export default function AluminumListPrice() {
  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer>('NALCO');
  const [materialPrice, setMaterialPrice] = useState<string>('');
  const [conversion, setConversion] = useState<string>('');
  const [freight, setFreight] = useState<string>('');

  const calculateFinalPrice = () => {
    const material = parseFloat(materialPrice) || 0;
    const conv = parseFloat(conversion) || 0;
    const fr = parseFloat(freight) || 0;
    const totalPrice = material + conv + fr;
    return totalPrice / 1000; // Convert to price per kilogram
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 border border-blue-100 h-[101.5%]">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-blue-100 rounded-lg">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Aluminum LIST PRICE
        </h2>
      </div>

      <div className="space-y-6">
        {/* Manufacturer Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Primary Aluminum Manufacturer
          </label>
          <select
            value={selectedManufacturer}
            onChange={(e) => setSelectedManufacturer(e.target.value as Manufacturer)}
            className="w-full px-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-gray-700 
              focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
          >
            {Object.entries(MANUFACTURER_CONFIG).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Product Label */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {MANUFACTURER_CONFIG[selectedManufacturer].productLabel}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">₹</span>
            </div>
            <input
              type="number"
              value={materialPrice}
              onChange={(e) => setMaterialPrice(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-gray-700 
                focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none 
                [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="Enter price"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Price last updated: {format(new Date(), 'dd MMM yyyy')}
          </p>
        </div>

        {/* Conversion */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Conversion
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">₹</span>
            </div>
            <input
              type="number"
              value={conversion}
              onChange={(e) => setConversion(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-gray-700 
                focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none 
                [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="Enter conversion cost"
            />
          </div>
        </div>

        {/* Freight */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Freight
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">₹</span>
            </div>
            <input
              type="number"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 bg-white border-2 border-gray-200 rounded-lg text-gray-700 
                focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none 
                [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="Enter freight cost"
            />
          </div>
        </div>

        {/* Final Price */}
        <div className="pt-4 border-t border-blue-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Final Price (₹/kg)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-white">₹</span>
            </div>
            <input
              type="text"
              value={calculateFinalPrice().toFixed(2)}
              readOnly
              className="w-full pl-8 pr-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 
                border-0 rounded-lg font-bold text-white text-lg shadow-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}