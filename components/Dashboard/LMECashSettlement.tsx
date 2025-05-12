import React from 'react';
import { TrendingUp, TrendingDown, Calendar, DollarSign } from 'lucide-react';

interface LMECashSettlementProps {
  basePrice?: number;
  spread?: number;
  spreadINR?: string;
  isIncrease?: boolean;
  formattedDate?: string;
}

export default function LMECashSettlement({
  basePrice = 2650,
  spread = 40,
  spreadINR = '3350.00',
  isIncrease = true,
  formattedDate = '30 May 2023'
}: LMECashSettlementProps) {
  const totalPrice = basePrice;
  const trendColor = isIncrease ? "text-green-600" : "text-red-600";
  const TrendIcon = isIncrease ? TrendingUp : TrendingDown;
  
  // Ensure spreadINR is properly displayed
  const displayINR = typeof spreadINR === 'string' ? spreadINR : String(spreadINR || '0.00');

  return (
    <div className="price-card bg-white rounded-xl p-3 md:p-4 border border-gray-200 
      shadow-sm hover:shadow-md transition-all duration-200 w-full
      relative overflow-hidden gpu-render group h-[162px] touch-manipulation box-border">
      
      {/* Background effect - properly layered */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity 
        ${isIncrease ? 'bg-green-500' : 'bg-red-500'} 
        -z-10`}></div>

      <div className="relative flex flex-col h-full gap-1 md:gap-2 justify-between">
        {/* Header with indicator badge */}
        <div>
          <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1.5 mb-2">
            <DollarSign className="w-3.5 h-3.5 crisp-text" />
            <span>LME Cash Settlement</span>
          </div>
        </div>
        
        {/* Date with day indicator */}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 font-medium antialiased subpixel-antialiased flex items-center gap-1.5">
              <Calendar className="w-4 h-4 crisp-text group-hover:text-indigo-600 transition-colors duration-300" />
              <span className="crisp-text group-hover:text-indigo-800 transition-colors duration-300">{formattedDate}</span>
            </div>
          </div>

          {/* Price Display */}
          <div className="mt-1.5 md:mt-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xl md:text-2xl font-bold text-indigo-600">
                ${totalPrice.toFixed(2)}
              </span>
              <span className="text-xs text-gray-500">/MT</span>
            </div>
          </div>
        </div>

        {/* Dollar difference display with INR value */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <TrendIcon className={`w-4 h-4 flex-shrink-0 crisp-text ${trendColor}`} />
            <span className={`whitespace-nowrap crisp-text ${trendColor} font-medium`}>
              {isIncrease ? '+' : '-'}${Math.abs(spread).toFixed(2)}
            </span>
          </div>

          <div className={`${trendColor} font-medium text-sm flex items-center gap-1`}>
            <span>{isIncrease ? '+' : '-'}₹{displayINR}</span>
          </div>
        </div>
      </div>
    </div>
  );
}