'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the HomePage component with no SSR
const HomePage = dynamic(() => import('../components/Home/HomePage'), { ssr: false });

export default function HomePageWrapper() {
  return <HomePage />;
}
