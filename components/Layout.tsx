"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./SideBar";
import MobileSidebarButton from "./MobileSidebarButton";
import ExpandedModalsContainer from "./Dashboard/ExpandedModalsContainer";


interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  

  // Handle dark mode
  useEffect(() => {
    setMounted(true);
    const isDark = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const handleThemeChange = (isDark: boolean) => {
    setIsDarkMode(isDark);
    localStorage.setItem("darkMode", isDark.toString());
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Handle mobile and tablet sidebar state
  useEffect(() => {
    if (!mounted) return;

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Check if device is tablet or vertical screen
      const isTabletDevice = width >= 768 && width <= 1024 || (width < 1024 && height > width);
      setIsTablet(isTabletDevice);
      
      // Close mobile sidebar on larger screens
      if (width >= 1024) {
        setIsMobileOpen(false);
      }
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mounted]);

  const handleMobileSidebarToggle = () => {
    setIsMobileOpen(prev => !prev);
  };

  // Prevent scrolling when mobile sidebar is open
  useEffect(() => {
    if (!mounted) return;

    if (isMobileOpen) {
      document.body.classList.add("sidebar-open");
      document.body.style.overflow = "hidden";
    } else {
      document.body.classList.remove("sidebar-open");
      document.body.style.overflow = "";
    }
    return () => {
      document.body.classList.remove("sidebar-open");
      document.body.style.overflow = "";
    };
  }, [isMobileOpen, mounted]);

  // For the homepage, render children directly without any wrapper
  if (isHomePage) {
    return <>{children}</>;
  }

  // For all other pages, use the standard layout with sidebar
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <MobileSidebarButton
        isOpen={isMobileOpen}
        onClick={handleMobileSidebarToggle}
      />
      
      <Sidebar
        isCollapsed={isCollapsed}
        onCollapse={setIsCollapsed}
        isDarkMode={isDarkMode}
        onThemeChange={handleThemeChange}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <main
        className={`transition-all duration-300 p-4 md:p-6 lg:p-8 ${
          isTablet || isMobileOpen 
            ? "ml-0" 
            : isCollapsed 
              ? "md:ml-16" 
              : "md:ml-64"
        }`}
      >
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      
      {/* Expanded Modals Container */}
      <ExpandedModalsContainer />
    </div>
  );
} 