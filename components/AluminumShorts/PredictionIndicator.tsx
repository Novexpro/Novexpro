import React from 'react';
import { HelpCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface PredictionIndicatorProps {
  prediction: 'up' | 'down' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
}

const getPredictionColor = (prediction: PredictionIndicatorProps['prediction'], confidence: PredictionIndicatorProps['confidence']): string => {
  const baseColors = {
    up: 'bg-green-500',
    down: 'bg-red-500',
    neutral: 'bg-gray-500'
  };
  
  const opacity = {
    high: 'opacity-100',
    medium: 'opacity-75',
    low: 'opacity-50'
  };
  
  return `${baseColors[prediction]} ${opacity[confidence]}`;
};

export function PredictionIndicator({ prediction, confidence }: PredictionIndicatorProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl">
      <div className="relative group mb-2">
        <HelpCircle className="w-5 h-5 text-gray-400 cursor-help" />
        <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900 text-white text-xs rounded-lg p-2">
          AI-powered price prediction based on news sentiment analysis
        </div>
      </div>
      <div className="text-center mb-2">
        <div className="text-sm font-medium text-gray-500">LME Price Prediction</div>
      </div>
      <div className={`w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-r ${getPredictionColor(prediction, confidence)} shadow-lg`}>
        {prediction === 'up' ? (
          <TrendingUp className="w-8 h-8 text-white" />
        ) : prediction === 'down' ? (
          <TrendingDown className="w-8 h-8 text-white" />
        ) : (
          <div className="w-8 h-1 bg-white rounded-full" />
        )}
      </div>
      <div className="mt-2 text-sm font-medium text-gray-500">
        {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
      </div>
    </div>
  );
}