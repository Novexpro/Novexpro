'use client';

import React from 'react';
import { Cookie, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="flex items-center justify-center mb-12">
          <Cookie className="w-12 h-12 text-blue-400 mr-4" />
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
            Cookie Policy
          </h1>
        </div>

        <div className="space-y-8 text-gray-300">
          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-400/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">What Are Cookies</h2>
            <p className="leading-relaxed">
              Cookies are small text files stored on your device when you visit our website. They help us provide and improve our services by:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2">
              <li>Remembering your preferences</li>
              <li>Understanding how you use our platform</li>
              <li>Keeping your session secure</li>
              <li>Providing personalized features</li>
            </ul>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-400/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">Types of Cookies We Use</h2>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-blue-300 mb-2">Essential Cookies</h3>
              <p>Required for basic platform functionality:</p>
              <ul className="list-disc list-inside mt-2 space-y-2">
                <li>Authentication</li>
                <li>Security</li>
                <li>User preferences</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-blue-300 mb-2">Analytics Cookies</h3>
              <p>Help us understand platform usage:</p>
              <ul className="list-disc list-inside mt-2 space-y-2">
                <li>Google Analytics</li>
                <li>Usage patterns</li>
                <li>Performance metrics</li>
              </ul>
            </div>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-400/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">Managing Cookies</h2>
            <p className="leading-relaxed">
              You can control cookies through your browser settings. Note that disabling certain cookies may limit platform functionality.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-400/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">Contact</h2>
            <p className="leading-relaxed">
              Questions about our cookie policy? Contact us at:
              <a
                href="mailto:privacy@novaex.com"
                className="ml-2 text-blue-400 hover:text-blue-300 transition-colors duration-200"
              >
                privacy@novaex.com
              </a>
            </p>
          </section>

          <div className="text-sm text-gray-400 text-center pt-8">
            Last updated: {new Date().toISOString().split('T')[0]}
          </div>
        </div>
      </div>
    </div>
  );
}
