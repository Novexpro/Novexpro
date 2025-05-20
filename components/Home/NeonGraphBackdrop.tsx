"use client";

import React from 'react';
import Image from 'next/image';

export default function NeonGraphBackdrop() {
  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none">
      <Image
        src="/assets/bg.png"
        alt="Background"
        fill
        priority
        quality={100}
        style={{
          objectFit: 'cover',
          objectPosition: 'center',
          zIndex: -1,
        }}
      />
      <div 
        className="absolute inset-0" 
        style={{
          background: 'rgba(0, 0, 0, 0.5)', // Optional overlay to ensure text readability
          zIndex: -1,
        }}
      />
    </div>
  );
}