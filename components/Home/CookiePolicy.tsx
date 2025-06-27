'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CookiePolicy() {
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

        <h1 className="text-4xl font-bold mb-8">Cookie Policy</h1>
        
        <div className="prose prose-lg">
          <p>Last updated: {new Date().toLocaleDateString()}</p>

          <h2>1. What Are Cookies</h2>
          <p>
            Cookies are small text files that are stored on your device when you visit a website. They are widely used to make websites work more efficiently and provide information to the website owners.
          </p>

          <h2>2. How We Use Cookies</h2>
          <p>
            Novaex uses cookies for the following purposes:
          </p>
          <ul>
            <li>Essential cookies: Required for the operation of our website</li>
            <li>Analytical cookies: To analyze how visitors use our website</li>
            <li>Functional cookies: To recognize you when you return to our website</li>
            <li>Targeting cookies: To record your visit to our website and the pages you have visited</li>
          </ul>

          <h2>3. Managing Cookies</h2>
          <p>
            You can control and manage cookies in various ways:
          </p>
          <ul>
            <li>Browser settings: Most browsers allow you to manage cookie settings</li>
            <li>Third-party tools: Various opt-out tools are available</li>
            <li>Our cookie consent tool: You can adjust your preferences on our website</li>
          </ul>

          <h2>4. Types of Cookies We Use</h2>
          <p>
            We use the following types of cookies:
          </p>
          <ul>
            <li>Session cookies: Temporary cookies that expire when you close your browser</li>
            <li>Persistent cookies: Remain on your device for a specified period</li>
            <li>First-party cookies: Set by our website</li>
            <li>Third-party cookies: Set by third parties providing services to us</li>
          </ul>

          <h2>5. Contact Us</h2>
          <p>
            If you have any questions about our Cookie Policy, please contact us at{' '}
            <a href="mailto:privacy@novaex.com">privacy@novaex.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
