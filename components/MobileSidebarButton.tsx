"use client";

import { Menu } from "lucide-react";
import { useState, useEffect } from "react";

interface MobileSidebarButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export default function MobileSidebarButton({ isOpen, onClick }: MobileSidebarButtonProps) {
  const [isTablet, setIsTablet] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Check if device is tablet or vertical screen
      const isTabletDevice = width >= 768 && width <= 1024 || (width < 1024 && height > width);
      setIsTablet(isTabletDevice);
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  // Don't render anything during SSR
  if (!mounted) {
    return null;
  }

  // Don't render the button on desktop screens or when sidebar is open
  if ((!isTablet && window.innerWidth >= 1024) || isOpen) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      className="fixed top-4 left-4 z-50 p-2.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300"
      aria-label="Open sidebar"
    >
      <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
    </button>
  );
} 