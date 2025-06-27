

'use client';

import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        <div className="flex items-center justify-center mb-12">
          <Shield className="w-12 h-12 text-blue-500 mr-4" />
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
        </div>

        <div className="space-y-8 text-gray-300">
          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-500/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">Introduction</h2>
            <p className="leading-relaxed">
              At NOVAEX, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and
              safeguard your information when you visit our website or use our services.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-500/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">Information We Collect</h2>
            <ul className="list-disc list-inside space-y-3">
              <li>Personal identification information (Name, email address, phone number)</li>
              <li>Business information</li>
              <li>Usage data and analytics</li>
              <li>Communication preferences</li>
            </ul>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-500/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-3">
              <li>To provide and maintain our service</li>
              <li>To notify you about changes to our service</li>
              <li>To provide customer support</li>
              <li>To gather analysis or valuable information to improve our service</li>
            </ul>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-500/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">Data Security</h2>
            <p className="leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information
              against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-500/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
            <p className="leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at:
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
