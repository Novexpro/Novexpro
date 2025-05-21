'use client';

import dynamic from 'next/dynamic';

// Use Next.js dynamic import to load the Homepage component (note the lowercase 'p')
const HomePage = dynamic(() => import('../components/Home/HomePage'), {
  loading: () => <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
  </div>,
  ssr: false // Disable server-side rendering for this component
});

export default function Home() {
  return <HomePage />;
}
