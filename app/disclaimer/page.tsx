import React from 'react';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function Disclaimer() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold mb-8">Disclaimer</h1>
        
        <div className="prose prose-lg">
          <p>Last updated: {new Date().toLocaleDateString()}</p>

          <h2>Market Data Disclaimer</h2>
          <p>
            The market data, prices, and analytics provided on NOVEX PRO are for informational purposes only and should not be considered as financial advice or trading recommendations.
          </p>

          <h2>No Investment Advice</h2>
          <p>
            NOVEX PRO does not provide investment advice. All decisions related to trading or investments should be made after consulting with qualified financial advisors.
          </p>

          <h2>Data Accuracy</h2>
          <p>
            While we strive to ensure the accuracy of all information provided:
          </p>
          <ul>
            <li>Market data may be delayed</li>
            <li>Prices are indicative only</li>
            <li>Historical data may be incomplete</li>
            <li>Technical issues may affect data delivery</li>
          </ul>

          <h2>Risk Warning</h2>
          <p>
            Trading in metals involves substantial risk of loss. Past performance is not indicative of future results.
          </p>

          <h2>Contact</h2>
          <p>
            For questions about this disclaimer, contact{' '}
            <a href="mailto:legal@novexpro.com">legal@novexpro.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}