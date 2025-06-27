'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrolled]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className={`fixed top-0 left-0 w-full z-20 transition-all duration-300 ${scrolled ? 'bg-darkBg/80 backdrop-blur-md shadow-lg' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto w-full flex flex-row justify-between items-center">
        {/* Logo */}
        <div className="logo pl-3 py-3 md:py-4">
          <Link href="/" className="flex items-center">
            <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-white to-purple-400 bg-clip-text text-transparent">
              NOVAEX
            </h1>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:block py-4">
          <ul className="flex flex-wrap justify-center space-x-4">
            <li className="group relative px-3">
              <Link href="/" className="py-2 font-medium text-white/90 hover:text-white transition-colors duration-200 flex items-center">
                Home
                <span className="block absolute h-0.5 w-0 bg-gradient-to-r from-purple-400 to-purple-600 left-0 -bottom-1 group-hover:w-full transition-all duration-300"></span>
              </Link>
            </li>
            <li className="group relative px-3">
              <button 
                onClick={() => alert('Resources section will be available soon!')} 
                className="py-2 font-medium text-white/90 hover:text-white transition-colors duration-200 flex items-center bg-transparent border-none cursor-pointer"
              >
                Resources
                <span className="block absolute h-0.5 w-0 bg-gradient-to-r from-purple-400 to-purple-600 left-0 -bottom-1 group-hover:w-full transition-all duration-300"></span>
              </button>
            </li>
            <li className="group relative px-3">
              <button 
                onClick={() => alert('Company information will be available soon!')} 
                className="py-2 font-medium text-white/90 hover:text-white transition-colors duration-200 flex items-center bg-transparent border-none cursor-pointer"
              >
                Company
                <span className="block absolute h-0.5 w-0 bg-gradient-to-r from-purple-400 to-purple-600 left-0 -bottom-1 group-hover:w-full transition-all duration-300"></span>
              </button>
            </li>
            <li className="group relative px-3">
              <button 
                onClick={() => alert('Contact information will be available soon!')} 
                className="py-2 font-medium text-white/90 hover:text-white transition-colors duration-200 flex items-center bg-transparent border-none cursor-pointer"
              >
                Contact
                <span className="block absolute h-0.5 w-0 bg-gradient-to-r from-purple-400 to-purple-600 left-0 -bottom-1 group-hover:w-full transition-all duration-300"></span>
              </button>
            </li>
          </ul>
        </nav>

        {/* CTA Buttons */}
        <div className="cta-buttons hidden md:flex flex-wrap justify-center gap-3 pr-3 py-4">
          <button 
            onClick={() => alert('Quote request feature will be available soon!')}
            className="relative overflow-hidden px-5 py-2 rounded-full border-2 border-white/20 text-white hover:text-white/90 hover:border-purple-400/70 transition-all duration-300 flex items-center justify-center group cursor-pointer"
          >
            <span className="relative z-10 font-medium">Get Quote</span>
            <span className="absolute inset-0 bg-gradient-to-r from-gray-800/0 via-gray-800/40 to-gray-800/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-400/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out"></span>
          </button>
          <Link href="/auth/sign-in" className="relative overflow-hidden px-5 py-2 rounded-full shadow-md hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center group text-white text-sm">
            <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 group-hover:from-purple-600 group-hover:to-purple-700 transition-colors duration-300"></span>
            <span className="relative z-10 font-medium flex items-center">
              Get Started
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 transform transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </span>
            <span className="absolute right-0 w-12 h-full bg-white/10 skew-x-[-20deg] transform translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden pr-3 py-3">
          <button
            onClick={toggleMenu}
            className="p-1 text-white hover:text-purple-400 transition-colors duration-200"
            aria-expanded={isMenuOpen}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="block h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="block h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 z-20">
          <div className="px-3 pt-2 pb-3 space-y-1 bg-gray-900 bg-opacity-90 backdrop-blur-sm">
            <ul className="flex flex-col space-y-2">
              <li className="group relative">
                <Link href="/" className="block px-3 py-2 text-white/90 hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li className="group relative">
                <button 
                  onClick={() => alert('Resources section will be available soon!')} 
                  className="block px-3 py-2 text-white/90 hover:text-white transition-colors bg-transparent border-none w-full text-left cursor-pointer"
                >
                  Resources
                </button>
              </li>
              <li className="group relative">
                <button 
                  onClick={() => alert('Company information will be available soon!')} 
                  className="block px-3 py-2 text-white/90 hover:text-white transition-colors bg-transparent border-none w-full text-left cursor-pointer"
                >
                  Company
                </button>
              </li>
              <li className="group relative">
                <button 
                  onClick={() => alert('Contact information will be available soon!')} 
                  className="block px-3 py-2 text-white/90 hover:text-white transition-colors bg-transparent border-none w-full text-left cursor-pointer"
                >
                  Contact
                </button>
              </li>
            </ul>
            <div className="flex flex-col space-y-2 mt-4 px-3">
              <button 
                onClick={() => alert('Quote request feature will be available soon!')}
                className="relative overflow-hidden px-5 py-2 rounded-full border-2 border-white/20 text-white hover:text-white/90 hover:border-purple-400/70 transition-all duration-300 flex items-center justify-center group cursor-pointer text-sm"
              >
                <span className="relative z-10 font-medium">Get Quote</span>
                <span className="absolute inset-0 bg-gradient-to-r from-gray-800/0 via-gray-800/40 to-gray-800/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-400/50 to-transparent transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out"></span>
              </button>
              <Link href="/auth/sign-in" className="relative overflow-hidden px-5 py-2 rounded-full shadow-md hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 flex items-center justify-center group text-white text-sm">
                <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 group-hover:from-purple-600 group-hover:to-purple-700 transition-colors duration-300"></span>
                <span className="relative z-10 font-medium flex items-center">
                  Get Started
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 transform transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className="absolute right-0 w-12 h-full bg-white/10 skew-x-[-20deg] transform translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
