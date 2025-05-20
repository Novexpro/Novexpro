import React from 'react';
import Link from 'next/link';
import { Facebook, Twitter, Linkedin, Shield, Lock, ArrowRight } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative z-10 bg-gradient-to-b from-[#0a0a14] to-[#080810] py-16">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-purple-600/5 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-20 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl"></div>
        <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-500/10 to-transparent"></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
        {/* Top section with main content */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Left Column - Logo and Description */}
          <div className="md:col-span-4 space-y-6">
          <Link href="/" className="flex items-center">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-purple-300 to-purple-500/90 bg-clip-text text-transparent animate-gradientFlow">
              NOVEX PRO
            </h1>
          </Link>
            <p className="text-gray-300 text-sm max-w-md leading-relaxed">
              Empowering metal buyers with real-time insights and market intelligence.
            </p>
            <div className="flex space-x-3 pt-2">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#111122] p-2.5 rounded-lg hover:bg-purple-900/30 hover:scale-110 transition-all duration-300 group"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5 text-gray-400 group-hover:text-purple-400" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#111122] p-2.5 rounded-lg hover:bg-purple-900/30 hover:scale-110 transition-all duration-300 group"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5 text-gray-400 group-hover:text-purple-400" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#111122] p-2.5 rounded-lg hover:bg-purple-900/30 hover:scale-110 transition-all duration-300 group"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5 text-gray-400 group-hover:text-purple-400" />
              </a>
            </div>
          </div>

          {/* Middle Column - Stay Updated */}
          <div className="md:col-span-4 space-y-6">
            <h4 className="text-lg font-medium text-white relative inline-block">
              Stay Updated
              <span className="absolute -bottom-1 left-0 w-1/2 h-0.5 bg-gradient-to-r from-purple-500 to-transparent"></span>
            </h4>
            <div className="relative">
              <input 
                type="email" 
                placeholder="Enter your email..." 
                className="w-full bg-[#111122]/80 text-white px-4 py-3 rounded-lg border border-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all duration-300 backdrop-blur-sm"
              />
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  // Add any action you want to happen when clicking 'Subscribe'
                  alert('Thank you for your interest! Subscription feature will be available soon.');
                }}
                className="absolute right-1.5 top-1.5 overflow-hidden px-4 py-1.5 rounded-md shadow-md hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 flex items-center justify-center group text-white text-sm cursor-pointer">
                <span className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 group-hover:from-purple-600 group-hover:to-purple-700 transition-colors duration-300"></span>
                <span className="relative z-10 font-medium flex items-center">
                  Subscribe
                  <ArrowRight className="w-4 h-4 ml-1 transform transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                <span className="absolute right-0 w-8 h-full bg-white/10 skew-x-[-20deg] transform translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out"></span>
              </button>
            </div>
            <p className="text-gray-400 text-xs">
              Get market insights and updates delivered to your inbox.
            </p>

            {/* Security Badges */}
            <div className="mt-8">
              <h5 className="text-sm font-medium text-white mb-4 relative inline-block">
                Trusted By Industry Leaders
                <span className="absolute -bottom-1 left-0 w-1/3 h-0.5 bg-gradient-to-r from-purple-500 to-transparent"></span>
              </h5>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2 text-xs text-gray-300 group">
                  <div className="p-1.5 bg-[#111122] rounded-md group-hover:bg-purple-900/20 transition-colors duration-300">
                    <Shield className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="group-hover:text-purple-300 transition-colors duration-300">Bank-grade security</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-300 group">
                  <div className="p-1.5 bg-[#111122] rounded-md group-hover:bg-purple-900/20 transition-colors duration-300">
                    <Lock className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="group-hover:text-purple-300 transition-colors duration-300">End-to-end encryption</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Links */}
          <div className="md:col-span-4 grid grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <h4 className="text-lg font-medium text-white mb-5 relative inline-block">
                Company
                <span className="absolute -bottom-1 left-0 w-1/2 h-0.5 bg-gradient-to-r from-purple-500 to-transparent"></span>
              </h4>
              <ul className="space-y-3">
                <li>
                  <button 
                    onClick={() => alert('About Us information will be available soon!')} 
                    className="text-gray-300 hover:text-purple-400 text-sm transition-colors duration-200 flex items-center group bg-transparent border-none p-0 cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-purple-500 mr-2 transition-colors duration-200"></span>
                    About Us
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => alert('Contact Us information will be available soon!')} 
                    className="text-gray-300 hover:text-purple-400 text-sm transition-colors duration-200 flex items-center group bg-transparent border-none p-0 cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-purple-500 mr-2 transition-colors duration-200"></span>
                    Contact Us
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => alert('FAQ information will be available soon!')} 
                    className="text-gray-300 hover:text-purple-400 text-sm transition-colors duration-200 flex items-center group bg-transparent border-none p-0 cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-purple-500 mr-2 transition-colors duration-200"></span>
                    FAQ
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-medium text-white mb-5 relative inline-block">
                Legal
                <span className="absolute -bottom-1 left-0 w-1/2 h-0.5 bg-gradient-to-r from-purple-500 to-transparent"></span>
              </h4>
              <ul className="space-y-3">
                <li>
                  <button 
                    onClick={() => alert('Privacy Policy information will be available soon!')} 
                    className="text-gray-300 hover:text-purple-400 text-sm transition-colors duration-200 flex items-center group bg-transparent border-none p-0 cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-purple-500 mr-2 transition-colors duration-200"></span>
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => alert('Terms of Service information will be available soon!')} 
                    className="text-gray-300 hover:text-purple-400 text-sm transition-colors duration-200 flex items-center group bg-transparent border-none p-0 cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-purple-500 mr-2 transition-colors duration-200"></span>
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => alert('Cookie Policy information will be available soon!')} 
                    className="text-gray-300 hover:text-purple-400 text-sm transition-colors duration-200 flex items-center group bg-transparent border-none p-0 cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-700 group-hover:bg-purple-500 mr-2 transition-colors duration-200"></span>
                    Cookie Policy
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-16 pt-8 border-t border-gray-800/50">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} Novex Pro. All rights reserved.
            </p>
            <div className="mt-4 md:mt-0">
              <div className="h-1 w-24 bg-gradient-to-r from-purple-500 to-transparent rounded-full mx-auto md:hidden mb-4"></div>
              <p className="text-gray-500 text-xs">
                Developed by <span className="text-purple-400">GigaNXT</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
