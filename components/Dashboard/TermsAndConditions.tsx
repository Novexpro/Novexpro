"use client";

import React, { useState } from "react";
import { X, Check, Shield, AlertCircle, FileText, Lock } from "lucide-react";

interface TermsAndConditionsProps {
  onAccept: () => void;
  onCancel: () => void;
}

export default function TermsAndConditions({ onAccept, onCancel }: TermsAndConditionsProps) {
  const [isAgreed, setIsAgreed] = useState(false);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAgreed) {
      onAccept();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden max-h-[80vh] border border-gray-100 flex flex-col">
        <div className="p-0">
          <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-600 to-purple-800 text-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6" />
              <h2 className="text-2xl font-bold">
                Service Agreement
              </h2>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors duration-200"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          
          <div className="p-6">

          <div className="prose prose-sm max-w-none mb-4 overflow-y-auto h-[40vh] p-4 bg-white rounded-lg shadow-inner">
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3">
              <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">1. Introduction</h3>
            </div>
            <p>
              This Service Agreement ("Agreement") governs your access to and use of the platform, products, and services offered under the trade name Novex Pro Labs, operated by the founder team and currently undergoing incorporation as a Private Limited company under Indian law.
            </p>
            <p>
              By accessing or using the Platform, you agree to be bound by the terms outlined herein. If you do not agree with any part of the Agreement, you must not access or use the Platform.
            </p>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3 mt-6">
              <Check className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">2. Services Offered</h3>
            </div>
            <p>Novex Pro Labs provides informational tools and services, including:</p>
            <ul>
              <li>Live and historical commodity pricing dashboards</li>
              <li>AI-generated analytics and insights</li>
              <li>WhatsApp and third-party notification integrations</li>
              <li>Position tracking and exposure calculators</li>
              <li>Data input tools for operational workflows</li>
            </ul>
            <p>Note: The Platform does not provide trading execution or financial intermediation services.</p>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3 mt-6">
              <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">3. Terms of Use</h3>
            </div>
            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">3.1 Data Reliability</h4>
            <ul>
              <li>All data (e.g., MCX, LME) is derived from publicly available or licensed sources.</li>
              <li>The Platform does not guarantee the accuracy, real-time delivery, or completeness of any data.</li>
              <li>Users should independently verify any information before acting upon it.</li>
            </ul>

            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">3.2 AI & Automation Disclaimer</h4>
            <ul>
              <li>AI-generated insights, alerts, or outputs are experimental and provided "as is."</li>
              <li>The Platform is not liable for any outcome resulting from automation errors, misclassification, missed notifications, or AI behavior.</li>
            </ul>

            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">3.3 Market Risk Disclaimer</h4>
            <ul>
              <li>Commodity trading and procurement decisions carry inherent risks, including complete loss of capital or inventory loss.</li>
              <li>The Platform is not responsible for financial losses due to market volatility or user decision-making.</li>
            </ul>

            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">3.4 Platform Availability</h4>
            <ul>
              <li>Services may be suspended or discontinued at any time for maintenance or upgrades.</li>
              <li>Novex Pro Labs is not liable for delays or inaccessibility due to external disruptions.</li>
            </ul>

            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">3.5 Indemnification</h4>
            <p>You agree to indemnify and hold harmless Novex Pro Labs from any claims, liabilities, damages, or legal costs arising from:</p>
            <ul>
              <li>Misuse of platform features</li>
              <li>Upload of incorrect or illegal data</li>
              <li>Violations of third-party terms or market regulations</li>
            </ul>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3 mt-6">
              <Lock className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">4. Privacy Policy</h3>
            </div>
            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">4.1 Data Collected</h4>
            <ul>
              <li>Basic business details (e.g., GSTIN, email address)</li>
              <li>Usage patterns (pages visited, tools used)</li>
              <li>Optional communications (e.g., WhatsApp number for alerts)</li>
            </ul>

            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">4.2 How We Use Data</h4>
            <ul>
              <li>Improve platform performance and features</li>
              <li>Send user-requested notifications</li>
              <li>Monitor service stability and diagnose issues</li>
            </ul>

            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">4.3 Data Protection</h4>
            <ul>
              <li>No banking, PAN, or sensitive financial data is stored</li>
              <li>We use commercially reasonable methods to secure your data</li>
              <li>User-uploaded data remains private unless explicitly shared</li>
            </ul>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3 mt-6">
              <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">5. Cookie Policy</h3>
            </div>
            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">5.1 Cookies We Use</h4>
            <ul>
              <li>Functional cookies (session management)</li>
              <li>Analytics cookies (e.g., Google Analytics, Meta Pixel – to be added later)</li>
            </ul>

            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">5.2 Consent</h4>
            <ul>
              <li>By using the Platform, you consent to our use of cookies as described.</li>
              <li>You may disable cookies in your browser, but some functionality may be affected.</li>
            </ul>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3 mt-6">
              <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">6. Subscription & Refund Policy</h3>
            </div>
            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">6.1 Paid Services</h4>
            <ul>
              <li>Certain features are accessible only via paid subscriptions.</li>
              <li>Prices are subject to change; users will be notified in advance.</li>
            </ul>

            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">6.2 No Refunds</h4>
            <ul>
              <li>All payments are non-refundable.</li>
              <li>Users may cancel future renewals at any time through account settings.</li>
            </ul>

            <h4 className="text-base font-medium text-gray-800 mt-4 mb-2">6.3 Billing</h4>
            <ul>
              <li>Billing cycles are monthly or annually depending on the plan.</li>
              <li>Cancellation takes effect at the end of the current billing cycle.</li>
            </ul>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3 mt-6">
              <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">7. User Responsibilities</h3>
            </div>
            <p>
              Users must comply with applicable laws, including those set by SEBI, MCA, and GST if applicable.
            </p>
            <p>You agree not to:</p>
            <ul>
              <li>Scrape, reverse-engineer, or resell Platform content</li>
              <li>Use the platform for any unlawful or unethical purpose</li>
              <li>Misrepresent uploaded data or use automation to manipulate platform results</li>
            </ul>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3 mt-6">
              <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">8. Changes to This Agreement</h3>
            </div>
            <ul>
              <li>Novex Pro Labs reserves the right to update or modify this Agreement at any time.</li>
              <li>Continued use of the Platform implies acceptance of any changes.</li>
            </ul>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3 mt-6">
              <Shield className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">9. Governing Law & Jurisdiction</h3>
            </div>
            <ul>
              <li>This Agreement shall be governed by and construed in accordance with the laws of India.</li>
              <li>Any disputes shall be subject to the exclusive jurisdiction of the courts in Mumbai, Maharashtra.</li>
            </ul>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3 mt-6">
              <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">10. Arbitration Clause (for claims exceeding ₹10 lakhs)</h3>
            </div>
            <p>
              In the event of any disputes exceeding ₹10,00,000 (Rupees Ten Lakhs only), the matter shall be resolved through binding arbitration, governed under the Arbitration and Conciliation Act, 1996, and administered by an independent arbitrator appointed mutually.
            </p>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3 mt-6">
              <Check className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">11. Binding Consent</h3>
            </div>
            <p>
              By using the Platform, you confirm that you have read, understood, and agreed to the full Service Agreement, including the Terms of Use, Privacy Policy, Cookie Policy, and Subscription & Refund Policy. You acknowledge that this Agreement is legally binding.
            </p>

            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-3 mt-6">
              <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900 m-0">12. Contact</h3>
            </div>
            <p>
              For any questions regarding this Agreement, contact:
              <br />📧 support@novexpro.co
              <br />📍 Navi Mumbai, 400701
              <br />🛡 Operated under the trade name Novex Pro Labs
            </p>
          </div>

          </div>
          
          <div className="p-4 bg-gray-50 border-t border-gray-100 mt-auto">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-3 mb-3 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
              <input
                type="checkbox"
                id="termsAgreement"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <div>
                <label htmlFor="termsAgreement" className="font-medium text-gray-700 cursor-pointer">
                  I have read and agree to the Service Agreement
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="w-1/2 py-2.5 px-4 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200 shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isAgreed}
                className={`w-1/2 bg-gradient-to-r from-purple-600 to-purple-500 text-white py-2.5 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm ${
                  isAgreed
                    ? "hover:from-purple-700 hover:to-purple-600 hover:shadow-md"
                    : "opacity-70 cursor-not-allowed"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  {isAgreed && <Check className="w-4 h-4" />}
                  Accept & Continue
                </span>
              </button>
            </div>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
