'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define types for our expanded components
export type ExpandedComponentType = 'MCXAluminium' | 'LMEAluminium' | 'MonthPrice' | 'RatesDisplay';

interface ExpandedComponentsContextType {
  expandedComponents: ExpandedComponentType[];
  addExpandedComponent: (componentType: ExpandedComponentType) => void;
  removeExpandedComponent: (componentType: ExpandedComponentType) => void;
  isExpanded: (componentType: ExpandedComponentType) => boolean;
  closeAll: () => void;
}

const ExpandedComponentsContext = createContext<ExpandedComponentsContextType | undefined>(undefined);

export function ExpandedComponentsProvider({ children }: { children: ReactNode }) {
  const [expandedComponents, setExpandedComponents] = useState<ExpandedComponentType[]>([]);

  const addExpandedComponent = (componentType: ExpandedComponentType) => {
    setExpandedComponents(prev => {
      // If the component is already expanded, don't add it again
      if (prev.includes(componentType)) return prev;
      return [...prev, componentType];
    });
  };

  const removeExpandedComponent = (componentType: ExpandedComponentType) => {
    setExpandedComponents(prev => prev.filter(type => type !== componentType));
  };

  const isExpanded = (componentType: ExpandedComponentType) => {
    return expandedComponents.includes(componentType);
  };

  const closeAll = () => {
    setExpandedComponents([]);
  };

  return (
    <ExpandedComponentsContext.Provider 
      value={{ 
        expandedComponents, 
        addExpandedComponent, 
        removeExpandedComponent,
        isExpanded,
        closeAll
      }}
    >
      {children}
    </ExpandedComponentsContext.Provider>
  );
}

export function useExpandedComponents() {
  const context = useContext(ExpandedComponentsContext);
  if (context === undefined) {
    throw new Error('useExpandedComponents must be used within a ExpandedComponentsProvider');
  }
  return context;
} 