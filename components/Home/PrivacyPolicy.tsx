
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link 
          to="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-lg">
          <p>Last updated: {new Date().toLocaleDateString()}</p>

          <h2>1. Information We Collect</h2>
          <p>
            We collect information that you provide directly to us, including:
          </p>
          <ul>
            <li>Name and contact information</li>
            <li>Company details and business type</li>
            <li>Usage data and preferences</li>
            <li>Communication history</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>
            We use the information we collect to:
          </p>
          <ul>
            <li>Provide and improve our services</li>
            <li>Send price alerts and market updates</li>
            <li>Process your transactions</li>
            <li>Communicate with you about our services</li>
          </ul>

          <h2>3. Data Security</h2>
          <p>
            We implement appropriate security measures to protect your personal information, including:
          </p>
          <ul>
            <li>End-to-end encryption for sensitive data</li>
            <li>Regular security audits</li>
            <li>Secure data storage practices</li>
          </ul>

          <h2>4. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at{' '}
            <a href="mailto:privacy@novexpro.com">privacy@novexpro.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}