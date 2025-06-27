"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Quote,
  Settings,
  ChevronLeft,
  LogOut,
  CreditCard,
  ChevronRight,
  Moon,
  Sun,
  Newspaper,
  Bell,
  Home,
  LogIn,
  UserPlus,
} from "lucide-react";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

interface SidebarProps {
  isCollapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  isDarkMode: boolean;
  onThemeChange: (isDark: boolean) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({
  isCollapsed,
  onCollapse,
  isDarkMode,
  onThemeChange,
  isMobileOpen,
  onMobileClose,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Check if device is tablet or vertical screen
  useEffect(() => {
    setMounted(true);
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      // Consider iPad dimensions (768px - 1024px) or vertical screens
      setIsTablet(width >= 768 && width <= 1024 || (width < 1024 && height > width));
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const navItems = [
    { id: "home", label: "Home", icon: Home, path: "/" },
    { id: "dashboard", label: "Market Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { id: "trends", label: "Trends", icon: TrendingUp, path: "/trends" },
    { id: "quote", label: "Get Quote", icon: Quote, path: "/quote" },
    { id: "aluminum-shorts", label: "Aluminum Shorts", icon: Newspaper, path: "/coming-soon" },
    { id: "alerts", label: "Manage Alerts", icon: Bell, path: "/coming-soon" },
  ];

  const handleNavigation = (path: string) => {
    if (!mounted) return;
    
    if (window.innerWidth < 768 || isTablet) {
      onMobileClose();
    }
    router.push(path);
  };

  const getActivePage = (path: string) => {
    if (path === "/") return pathname === path ? "home" : "";
    return pathname?.startsWith(path) ? path.split("/")[1] : "";
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300"
          onClick={onMobileClose}
        />
      )}

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Sign Out</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to sign out?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Handle sign out logic here
                  setShowSignOutConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscription && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Subscription</h3>
            <p className="text-gray-600 mb-6">Upgrade your account to access premium features.</p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowSubscription(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 bg-white/90 backdrop-blur-md border-r border-white/30 transition-all duration-300 ease-in-out z-40
          ${isCollapsed ? "w-16" : "w-64"}
          ${isMobileOpen ? "translate-x-0 w-full md:w-64" : "-translate-x-full"}
          md:translate-x-0 shadow-lg overflow-hidden`}
      >
        {/* Collapse Sidebar Button - Desktop Only */}
        {/* Logo or Brand with integrated collapse button */}
        <div className="p-4 border-b border-white/30 flex items-center justify-between">
          <h1 className={`text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-500 bg-clip-text text-transparent transition-all duration-200 ${isCollapsed ? 'hidden' : ''}`}>
            NOVAEX
          </h1>
          
          {/* Collapse button integrated into header */}
          <button
            onClick={() => onCollapse(!isCollapsed)}
            className={`hidden md:flex items-center justify-center w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-gray-500 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 ${isCollapsed ? 'w-full' : ''}`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-white font-bold" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-white font-bold" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 px-3 py-4 space-y-2 ${isCollapsed ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = getActivePage(item.path) === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={`group relative w-full flex items-center ${
                  isCollapsed ? 'justify-center' : 'justify-start'
                } gap-3 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 ease-in-out ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-400 to-indigo-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gradient-to-r hover:from-purple-400/10 hover:to-indigo-500/10'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className={`flex-shrink-0 transition-transform duration-200 ${
                  isCollapsed ? 'transform hover:scale-110' : ''
                }`}>
                  <Icon className={`w-5 h-5 ${
                    isActive ? 'text-white' : 'text-gray-500 group-hover:text-indigo-500'
                  }`} />
                </div>
                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
                {isCollapsed && (
                  <div className="fixed left-[4.5rem] px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-white/30 space-y-2">
          <SignedIn>
            <button 
              onClick={() => {
                const button = document.querySelector('.cl-userButtonTrigger') as HTMLElement;
                if (button) button.click();
              }}
              className={`group relative w-full flex items-center ${
                isCollapsed ? 'justify-center' : 'justify-start'
              } gap-3 px-4 py-2.5 rounded-xl font-medium text-gray-700 hover:bg-gradient-to-r hover:from-purple-400/10 hover:to-indigo-500/10 transition-all duration-200`}
              title={isCollapsed ? 'Account' : undefined}
            >
              <div className={`flex-shrink-0 transition-transform duration-200 ${
                isCollapsed ? 'transform hover:scale-110' : ''
              }`}>
                <UserButton afterSignOutUrl="/" />
              </div>
              {!isCollapsed && <span className="truncate">Account</span>}
              {isCollapsed && (
                <div className="fixed left-[4.5rem] px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  Account
                </div>
              )}
            </button>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className={`group relative w-full flex items-center ${
                isCollapsed ? 'justify-center' : 'justify-start'
              } gap-3 px-4 py-2.5 rounded-xl font-medium text-gray-700 hover:bg-gradient-to-r hover:from-purple-400/10 hover:to-indigo-500/10 transition-all duration-200`}
              title={isCollapsed ? 'Sign In' : undefined}>
                <div className={`flex-shrink-0 transition-transform duration-200 ${
                  isCollapsed ? 'transform hover:scale-110' : ''
                }`}>
                  <LogIn className="w-5 h-5 text-gray-500 group-hover:text-indigo-500" />
                </div>
                {!isCollapsed && <span className="truncate">Sign In</span>}
                {isCollapsed && (
                  <div className="fixed left-[4.5rem] px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                    Sign In
                  </div>
                )}
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className={`group relative w-full flex items-center ${
                isCollapsed ? 'justify-center' : 'justify-start'
              } gap-3 px-4 py-2.5 rounded-xl font-medium text-gray-700 hover:bg-gradient-to-r hover:from-purple-400/10 hover:to-indigo-500/10 transition-all duration-200`}
              title={isCollapsed ? 'Sign Up' : undefined}>
                <div className={`flex-shrink-0 transition-transform duration-200 ${
                  isCollapsed ? 'transform hover:scale-110' : ''
                }`}>
                  <UserPlus className="w-5 h-5 text-gray-500 group-hover:text-indigo-500" />
                </div>
                {!isCollapsed && <span className="truncate">Sign Up</span>}
                {isCollapsed && (
                  <div className="fixed left-[4.5rem] px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                    Sign Up
                  </div>
                )}
              </button>
            </SignUpButton>
          </SignedOut>

          {/* Settings */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`group relative w-full flex items-center ${
                isCollapsed ? 'justify-center' : 'justify-start'
              } gap-3 px-4 py-2.5 rounded-xl font-medium text-gray-700 hover:bg-gradient-to-r hover:from-purple-400/10 hover:to-indigo-500/10 transition-all duration-200`}
              title={isCollapsed ? 'Settings' : undefined}
            >
              <div className={`flex-shrink-0 transition-transform duration-200 ${
                isCollapsed ? 'transform hover:scale-110' : ''
              }`}>
                <Settings className="w-5 h-5 text-gray-500 group-hover:text-indigo-500" />
              </div>
              {!isCollapsed && (
                <span>Settings</span>
              )}
              {isCollapsed && (
                <div className="fixed left-[4.5rem] px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  Settings
                </div>
              )}
            </button>

            {/* Settings Dropdown */}
            {showSettings && !isCollapsed && (
              <div className="absolute bottom-full left-0 w-full bg-white/80 backdrop-blur-sm border border-white/30 rounded-xl shadow-lg mb-1 overflow-hidden">
                <button
                  onClick={() => onThemeChange(!isDarkMode)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-purple-400/10 hover:to-indigo-500/10"
                >
                  {isDarkMode ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                  {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <button
                  onClick={() => setShowSubscription(true)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-purple-400/10 hover:to-indigo-500/10"
                >
                  <CreditCard className="w-4 h-4" />
                  Subscription
                </button>
                <button
                  onClick={() => setShowSignOutConfirm(true)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-gradient-to-r hover:from-red-400/10 hover:to-red-500/10"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}