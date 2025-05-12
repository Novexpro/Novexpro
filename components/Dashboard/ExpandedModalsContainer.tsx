'use client';

import React from 'react';
import { useExpandedComponents } from '../../context/ExpandedComponentsContext';
import MCXAluminium from './MCXAluminium';
import LMEAluminium from './LMEAluminium';
import MonthPrice from './MonthPrice';
import RatesDisplay from './RatesDisplay';

export default function ExpandedModalsContainer() {
  const { expandedComponents, closeAll } = useExpandedComponents();

  if (expandedComponents.length === 0) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={() => closeAll()}
    >
      <div 
        className={`grid ${
          expandedComponents.length === 1 
            ? 'grid-cols-1' 
            : expandedComponents.length === 2 
              ? 'grid-cols-1 md:grid-cols-2' 
              : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        } gap-6 max-h-[90vh] overflow-auto p-6 justify-items-center`}
        onClick={(e) => e.stopPropagation()}
      >
        {expandedComponents.includes('MCXAluminium') && (
          <MCXAluminium expanded={true} />
        )}
        
        {expandedComponents.includes('LMEAluminium') && (
          <LMEAluminium expanded={true} />
        )}
        
        {expandedComponents.includes('MonthPrice') && (
          <MonthPrice expanded={true} />
        )}
        
        {expandedComponents.includes('RatesDisplay') && (
          <RatesDisplay expanded={true} />
        )}
      </div>
    </div>
  );
} 