'use client'

import { ArrowRight, Bell, TrendingUp, Target, FileText } from 'lucide-react';
import NeonGraphBackdrop from './NeonGraphBackdrop';
import Footer from './Footer';
import SupportButton from './SupportButton';
import Navbar from './Navbar';
import Link from 'next/link';
import Image from 'next/image';
import backgroundImage from '../../assets/bg.png';

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black flex flex-col">
      <Navbar />
      
      <section className="w-full relative overflow-hidden flex-1">
        {/* Background Image */}
        <div className="relative w-full z-0">
          <Image 
            src={backgroundImage} 
            alt="Background" 
            className="w-full h-auto opacity-70 object-cover min-h-[100vh]" 
            priority 
            quality={100} 
          />
          {/* Very light purple tint overlay */}
          <div className="absolute inset-0 bg-purple-400/10 mix-blend-soft-light"></div>
        </div>
        
        {/* Lighter overlay for better text readability - diagonal gradient from top-left */}
        <div className="absolute inset-0 z-1" style={{
          background: 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.2) 100%)'
        }}></div>
        
        <div className="container mx-auto px-4 sm:px-6 absolute inset-0 flex items-start z-2 pt-20 md:pt-32">
          <div className="hero-content w-full max-w-3xl mx-auto text-center md:text-left md:mx-0">
            {/* Main heading with animated gradient */}
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold mb-3 sm:mb-4 tracking-tight relative">
              <span className="bg-gradient-to-r from-white via-purple-300 to-purple-500/90 bg-clip-text text-transparent animate-gradientFlow">
                NOVAEX
              </span>
              <div className="absolute -left-4 -top-4 w-12 h-12 bg-purple-500/20 rounded-full blur-xl animate-pulse opacity-70 hidden sm:block"></div>
            </h1>
            
            {/* Subheading with highlight */}
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-4 sm:mb-6 text-gray-200 max-w-2xl">
              Empowering Commodity Buyers with <span className="text-purple-500 font-bold">Real-Time Insights</span>
            </h2>
            
            {/* Feature cards with modern design - centered content and reduced height */}
            <div className="features grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-3 sm:gap-y-4 mt-4 sm:mt-6 mb-4 sm:mb-6 max-w-2xl mx-auto md:mx-0">
              <div className="feature group py-3 px-4 rounded-xl bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-md border border-gray-700/30 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 overflow-hidden relative flex items-center">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="feature-icon p-2 sm:p-3 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-purple-500 flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] border border-gray-700/50 shadow-md group-hover:shadow-purple-500/20 transition-all duration-300 mr-2 sm:mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-purple-500 transition-colors duration-300">Set Custom Alerts</h3>
              </div>
              
              <div className="feature group py-3 px-4 rounded-xl bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-md border border-gray-700/30 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 overflow-hidden relative flex items-center">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="feature-icon p-2 sm:p-3 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-purple-500 flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] border border-gray-700/50 shadow-md group-hover:shadow-purple-500/20 transition-all duration-300 mr-2 sm:mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-purple-500 transition-colors duration-300">Analyze Global Trends</h3>
              </div>
              
              <div className="feature group py-3 px-4 rounded-xl bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-md border border-gray-700/30 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 overflow-hidden relative flex items-center">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="feature-icon p-2 sm:p-3 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-purple-500 flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] border border-gray-700/50 shadow-md group-hover:shadow-purple-500/20 transition-all duration-300 mr-2 sm:mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-purple-500 transition-colors duration-300">Optimize Procurement</h3>
              </div>
              
              <div className="feature group py-3 px-4 rounded-xl bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-md border border-gray-700/30 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 overflow-hidden relative flex items-center">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="feature-icon p-2 sm:p-3 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 text-purple-500 flex items-center justify-center min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] border border-gray-700/50 shadow-md group-hover:shadow-purple-500/20 transition-all duration-300 mr-2 sm:mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-white group-hover:text-purple-500 transition-colors duration-300">Manage Hedge Positions</h3>
              </div>
            </div>

            <div className="hero-buttons flex flex-col sm:flex-row gap-3 sm:gap-5 mt-5 sm:mt-6 w-full sm:w-auto">
              <Link href="/auth/sign-in" className="relative overflow-hidden px-6 sm:px-8 py-2.5 sm:py-3 rounded-full shadow-md hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center group text-white w-full sm:w-auto">
                <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 group-hover:from-purple-600 group-hover:to-purple-700 transition-colors duration-300"></span>
                <span className="relative z-10 font-medium flex items-center">
                  Get Started
                  <ArrowRight className="h-5 w-5 ml-2 transform transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                <span className="absolute right-0 w-12 h-full bg-white/10 skew-x-[-20deg] transform translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></span>
              </Link>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  // Add any action you want to happen when clicking 'Get Free Trial'
                  // For example, scroll to a section or open a modal
                  alert('Free Trial feature will be available soon!');
                }} 
                className="relative overflow-hidden px-6 sm:px-8 py-2.5 sm:py-3 rounded-full border-2 border-white/20 text-white hover:text-white/90 hover:border-purple-400/70 transition-all duration-300 flex items-center justify-center group cursor-pointer w-full sm:w-auto">
                <span className="relative z-10 font-medium">Get Free Trial</span>
                <span className="absolute inset-0 bg-gradient-to-r from-gray-800/0 via-gray-800/40 to-gray-800/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-400/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out"></span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Modern line-based divider at the bottom */}
        <div className="absolute bottom-0 left-0 w-full">
          {/* Main divider line with gradient */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
          
          {/* Secondary accent lines */}
          <div className="relative h-6">
            <div className="absolute top-2 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent"></div>
            <div className="absolute top-4 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"></div>
          </div>
          
          {/* Decorative dots */}
          <div className="absolute bottom-3 left-1/4 w-1 h-1 rounded-full bg-purple-500/70"></div>
          <div className="absolute bottom-5 left-1/2 w-1 h-1 rounded-full bg-purple-500/70"></div>
          <div className="absolute bottom-3 left-3/4 w-1 h-1 rounded-full bg-purple-500/70"></div>
        </div>
        
        {/* Decorative element - subtle animated glow */}
        <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-purple-500/5 to-transparent opacity-50"></div>
        
        {/* Modern animated elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          {/* Glowing orbs */}
          <div className="absolute top-1/5 right-1/5 w-32 sm:w-64 h-32 sm:h-64 rounded-full bg-purple-500/5 blur-3xl animate-pulse-slow opacity-60"></div>
          <div className="absolute bottom-1/4 left-1/6 w-40 sm:w-80 h-40 sm:h-80 rounded-full bg-purple-500/5 blur-3xl animate-pulse-slower opacity-40"></div>
          
          {/* Horizontal animated lines */}
          <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent animate-line-move"></div>
          <div className="absolute top-2/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/15 to-transparent animate-line-move-delay"></div>
          
          {/* Vertical animated lines */}
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-purple-500/20 to-transparent animate-line-move-vertical"></div>
          <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-transparent via-purple-500/15 to-transparent animate-line-move-vertical-delay"></div>
          
          {/* Floating particles effect - hidden on smallest screens */}
          <div className="absolute top-1/4 left-1/4 w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-purple-500/40 animate-float-slow hidden xs:block"></div>
          <div className="absolute top-3/4 left-2/3 w-2 sm:w-3 h-2 sm:h-3 rounded-full bg-purple-500/30 animate-float-medium hidden xs:block"></div>
          <div className="absolute top-1/2 left-3/4 w-1 h-1 rounded-full bg-purple-500/50 animate-float-fast hidden xs:block"></div>
          <div className="absolute top-1/3 right-1/4 w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-purple-400/40 animate-float-medium hidden xs:block"></div>
          <div className="absolute bottom-1/3 left-1/3 w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-purple-300/30 animate-float-slow hidden xs:block"></div>
        </div>
      </section>

      <Footer />
      <SupportButton />
    </div>
  );
}
