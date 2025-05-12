'use client';

import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import { ExpandedComponentType, useExpandedComponents } from '../../context/ExpandedComponentsContext';

interface ExpandedModalWrapperProps {
  title: string;
  subtitle: string;
  componentType: ExpandedComponentType;
  children: ReactNode;
}

export default function ExpandedModalWrapper({
  title,
  subtitle,
  componentType,
  children
}: ExpandedModalWrapperProps) {
  const { removeExpandedComponent } = useExpandedComponents();

  return (
    <div className="bg-white rounded-xl p-5 shadow-lg w-full max-w-lg mx-4 h-[520px] flex flex-col">
      {/* Header - Fixed Height */}
      <div className="flex items-start justify-between w-full mb-4 flex-shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => removeExpandedComponent(componentType)}
            className="p-1 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Content - Scrollable */}
      <div className="flex-1 overflow-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {children}
      </div>
    </div>
  );
} 