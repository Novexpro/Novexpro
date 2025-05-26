'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
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

        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-lg">
          <p>Last updated: {new Date().toLocaleDateString()}</p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Novex Pro services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
          </p>

          <h2>2. Description of Services</h2>
          <p>
            Novex Pro provides metal market intelligence and analytics services, including but not limited to:
          </p>
          <ul>
            <li>Real-time metal price tracking</li>
            <li>Market trend analysis</li>
            <li>Cash settlement data</li>
            <li>Custom alerts and notifications</li>
          </ul>

          <h2>3. User Accounts</h2>
          <p>
            To access certain features of our services, you may be required to create an account. You are responsible for:
          </p>
          <ul>
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized use</li>
          </ul>

          <h2>4. Intellectual Property</h2>
          <p>
            All content, features, and functionality of our services, including but not limited to text, graphics, logos, and software, are owned by Novex Pro and are protected by intellectual property laws.
          </p>

          <h2>5. Limitation of Liability</h2>
          <p>
            Novex Pro shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use our services.
          </p>

          <h2>6. Contact Us</h2>
          <p>
            If you have any questions about these Terms of Service, please contact us at{' '}
            <a href="mailto:terms@novexpro.com">terms@novexpro.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
