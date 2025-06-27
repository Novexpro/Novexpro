'use client';

import React from 'react';
import { ScrollText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';


export default function TermsOfService() {
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
          <ScrollText className="w-12 h-12 text-blue-500 mr-4" />
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
            Terms of Service
          </h1>
        </div>

        <div className="space-y-8 text-gray-300">
          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-500/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By accessing and using NOVAEX, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-500/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">Service Description</h2>
            <p className="leading-relaxed">
              NOVAEX provides real-time metal market insights, price alerts, and procurement optimization tools, including:
            </p>
            <ul className="list-disc list-inside space-y-3 mt-4">
              <li>Real-time metal price tracking and analysis</li>
              <li>Market trend insights and predictions</li>
              <li>Custom price alerts and notifications</li>
              <li>Quote management and procurement tools</li>
            </ul>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-500/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">User Obligations</h2>
            <ul className="list-disc list-inside space-y-3">
              <li>Maintain accurate account information</li>
              <li>Protect account credentials</li>
              <li>Use the service in compliance with applicable laws</li>
              <li>Not engage in unauthorized access or use</li>
            </ul>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-500/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">Limitation of Liability</h2>
            <p className="leading-relaxed">
              NOVAEX provides market data and insights for informational purposes only. We are not liable for:
            </p>
            <ul className="list-disc list-inside space-y-3 mt-4">
              <li>Trading decisions made using our platform</li>
              <li>Market data accuracy or timeliness</li>
              <li>Service interruptions or technical issues</li>
            </ul>
          </section>

          <section className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/10 hover:border-blue-500/30 transition-colors duration-300">
            <h2 className="text-2xl font-semibold text-white mb-4">Contact Us</h2>
            <p className="leading-relaxed">
              For questions about these Terms of Service, please contact us at:
              <a
                href="mailto:legal@novaex.com"
                className="ml-2 text-blue-400 hover:text-blue-300 transition-colors duration-200"
              >
                legal@novaex.com
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
