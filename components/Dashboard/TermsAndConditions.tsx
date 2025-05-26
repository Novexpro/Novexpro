"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, ChevronDown, Check, AlertCircle } from "lucide-react";

interface TermsAndConditionsProps {
  onAccept: () => void;
  onCancel: () => void;
}

export default function TermsAndConditions({ onAccept, onCancel }: TermsAndConditionsProps) {
  const [isAgreed, setIsAgreed] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Hide scroll indicator when user has scrolled near the bottom
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const element = e.target as HTMLElement;
      const scrollPosition = element.scrollTop + element.clientHeight;
      const scrollHeight = element.scrollHeight;
      
      // Hide indicator when scrolled more than 80% of the content
      if (scrollPosition > scrollHeight * 0.8) {
        setShowScrollIndicator(false);
      } else {
        setShowScrollIndicator(true);
      }
      
      // Determine active section based on scroll position
      const sections = document.querySelectorAll('.terms-section');
      sections.forEach((section, index) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 150 && rect.bottom >= 150) {
          setActiveSection(index);
        }
      });
    };
    
    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (contentElement) {
        contentElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);
  
  const scrollToSection = (index: number) => {
    const sections = document.querySelectorAll('.terms-section');
    if (sections[index]) {
      sections[index].scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAgreed) {
      onAccept();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-6">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-auto overflow-hidden" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-t-xl sticky top-0 z-10">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Service Agreement
          </h2>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors duration-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row h-[calc(90vh-68px)]">
          {/* Table of contents - visible on md screens and above */}
          <div className="hidden md:block w-64 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Contents</h3>
            <nav>
              <ul className="space-y-1">
                {['Introduction', 'Services Offered', 'Terms of Use', 'Privacy Policy', 'Cookie Policy', 'Subscription & Refund Policy', 'User Responsibilities', 'Changes to This Agreement', 'Governing Law & Jurisdiction'].map((section, index) => (
                  <li key={index}>
                    <button 
                      onClick={() => scrollToSection(index)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm ${activeSection === index ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {index + 1}. {section}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          
          {/* Content with buttons included in scrollable area */}
          <div 
            ref={contentRef}
            id="terms-content" 
            className="flex-1 overflow-y-auto p-6 relative"
          >
            {/* Scroll indicator */}
            {showScrollIndicator && (
              <div className="fixed bottom-16 left-1/2 transform -translate-x-1/2 animate-bounce bg-purple-600 text-white rounded-full p-2 shadow-lg z-10 flex items-center gap-1">
                <span className="text-xs font-medium hidden md:inline">Continue reading</span>
                <ChevronDown className="w-4 h-4" />
              </div>
            )}
            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">1. Introduction</h3>
              <div className="space-y-3 text-gray-700">
                <p>
                  This Service Agreement ("Agreement") governs your access to and use of the platform, products, and services offered under the trade name Novex Pro Labs, operated by the founder team and currently undergoing incorporation as a Private Limited company under Indian law.
                </p>
                <p>
                  By accessing or using the Platform, you agree to be bound by the terms outlined herein. If you do not agree with any part of the Agreement, you must not access or use the Platform.
                </p>
              </div>
            </section>

            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">2. Services Offered</h3>
              <div className="space-y-3 text-gray-700">
                <p>Novex Pro Labs provides informational tools and services, including:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Live and historical commodity pricing dashboards</li>
                  <li>AI-generated analytics and insights</li>
                  <li>WhatsApp and third-party notification integrations</li>
                  <li>Position tracking and exposure calculators</li>
                  <li>Data input tools for operational workflows</li>
                </ul>
                <p className="italic text-sm bg-gray-50 p-3 rounded-md border-l-4 border-purple-300">Note: The Platform does not provide trading execution or financial intermediation services.</p>
              </div>
            </section>

            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">3. Terms of Use</h3>
              <div className="space-y-5 text-gray-700">
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">3.1</span>
                    Data Reliability
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>All data (e.g., MCX, LME) is derived from publicly available or licensed sources.</li>
                    <li>The Platform does not guarantee the accuracy, real-time delivery, or completeness of any data.</li>
                    <li>Users should independently verify any information before acting upon it.</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">3.2</span>
                    AI & Automation Disclaimer
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>AI-generated insights, alerts, or outputs are experimental and provided "as is."</li>
                    <li>The Platform is not liable for any outcome resulting from automation errors, misclassification, missed notifications, or AI behavior.</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">3.3</span>
                    Market Risk Disclaimer
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Commodity trading and procurement decisions carry inherent risks, including complete loss of capital or inventory loss.</li>
                    <li>The Platform is not responsible for financial losses due to market volatility or user decision-making.</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">3.4</span>
                    Platform Availability
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Services may be suspended or discontinued at any time for maintenance or upgrades.</li>
                    <li>Novex Pro Labs is not liable for delays or inaccessibility due to external disruptions.</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">3.5</span>
                    Indemnification
                  </h4>
                  <p className="mb-2">You agree to indemnify and hold harmless Novex Pro Labs from any claims, liabilities, damages, or legal costs arising from:</p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Misuse of platform features</li>
                    <li>Upload of incorrect or illegal data</li>
                    <li>Violations of third-party terms or market regulations</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">4. Privacy Policy</h3>
              <div className="grid md:grid-cols-3 gap-4 text-gray-700">
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">4.1</span>
                    Data Collected
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Basic business details (e.g., GSTIN, email address)</li>
                    <li>Usage patterns (pages visited, tools used)</li>
                    <li>Optional communications (e.g., WhatsApp number for alerts)</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">4.2</span>
                    How We Use Data
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Improve platform performance and features</li>
                    <li>Send user-requested notifications</li>
                    <li>Monitor service stability and diagnose issues</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">4.3</span>
                    Data Protection
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>No banking, PAN, or sensitive financial data is stored</li>
                    <li>We use commercially reasonable methods to secure your data</li>
                    <li>User-uploaded data remains private unless explicitly shared</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">5. Cookie Policy</h3>
              <div className="grid md:grid-cols-2 gap-4 text-gray-700">
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">5.1</span>
                    Cookies We Use
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Functional cookies (session management)</li>
                    <li>Analytics cookies (e.g., Google Analytics, Meta Pixel – to be added later)</li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">5.2</span>
                    Consent
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>By using the Platform, you consent to our use of cookies as described.</li>
                    <li>You may disable cookies in your browser, but some functionality may be affected.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">6. Subscription & Refund Policy</h3>
              <div className="space-y-4 text-gray-700">
                <div className="bg-gradient-to-r from-purple-50 to-white rounded-lg p-4 shadow-sm border border-purple-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">6.1</span>
                    Paid Services
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Certain features are accessible only via paid subscriptions.</li>
                    <li>Prices are subject to change; users will be notified in advance.</li>
                  </ul>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-white rounded-lg p-4 shadow-sm border border-purple-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">6.2</span>
                    No Refunds
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>All payments are non-refundable.</li>
                    <li>Users may cancel future renewals at any time through account settings.</li>
                  </ul>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-white rounded-lg p-4 shadow-sm border border-purple-100">
                  <h4 className="text-base font-medium mb-3 text-purple-700 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold mr-2 flex items-center justify-center">6.3</span>
                    Billing
                  </h4>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Billing cycles are monthly or annually depending on the plan.</li>
                    <li>Cancellation takes effect at the end of the current billing cycle.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">7. User Responsibilities</h3>
              <div className="space-y-3 text-gray-700 bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <p className="font-medium">
                  Users must comply with applicable laws, including those set by SEBI, MCA, and GST if applicable.
                </p>
                <p className="font-medium">You agree not to:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Scrape, reverse-engineer, or resell Platform content</li>
                  <li>Use the platform for any unlawful or unethical purpose</li>
                  <li>Misrepresent uploaded data or use automation to manipulate platform results</li>
                </ul>
              </div>
            </section>

            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">8. Changes to This Agreement</h3>
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <ul className="list-disc pl-5 space-y-1.5 text-gray-700">
                  <li>Novex Pro Labs reserves the right to update or modify this Agreement at any time.</li>
                  <li>Continued use of the Platform implies acceptance of any changes.</li>
                </ul>
              </div>
            </section>

            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">9. Governing Law & Jurisdiction</h3>
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <ul className="list-disc pl-5 space-y-1.5 text-gray-700">
                  <li>This Agreement shall be governed by and construed in accordance with the laws of India.</li>
                  <li>Any disputes shall be subject to the exclusive jurisdiction of the courts in Mumbai, Maharashtra.</li>
                </ul>
              </div>
            </section>

            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">10. Arbitration Clause</h3>
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <p className="text-gray-700">
                  In the event of any disputes exceeding ₹10,00,000 (Rupees Ten Lakhs only), the matter shall be resolved through binding arbitration, governed under the Arbitration and Conciliation Act, 1996, and administered by an independent arbitrator appointed mutually.
                </p>
              </div>
            </section>

            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">11. Binding Consent</h3>
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
                <p className="text-gray-700">
                  By using the Platform, you confirm that you have read, understood, and agreed to the full Service Agreement, including the Terms of Use, Privacy Policy, Cookie Policy, and Subscription & Refund Policy. You acknowledge that this Agreement is legally binding.
                </p>
              </div>
            </section>

            <section className="terms-section mb-8">
              <h3 className="text-xl font-semibold mb-4 text-purple-800 border-b pb-2">12. Contact</h3>
              <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 text-gray-700">
                <p className="mb-3">For any questions regarding this Agreement, contact:</p>
                <div className="space-y-2 font-medium">
                  <div className="flex items-center">
                    <span className="text-lg mr-2">📧</span> support@novexpro.co
                  </div>
                  <div className="flex items-center">
                    <span className="text-lg mr-2">📍</span> Navi Mumbai, 400701
                  </div>
                  <div className="flex items-center">
                    <span className="text-lg mr-2">🛡</span> Operated under the trade name Novex Pro Labs
                  </div>
                </div>
              </div>
            </section>
            
            {/* Agreement Checkbox and Buttons - Inside scrollable area */}
            <div className="mt-8 p-5 border border-purple-200 bg-purple-50 rounded-lg shadow-inner">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center">
                  <div className="relative flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        id="termsAgreement"
                        checked={isAgreed}
                        onChange={(e) => setIsAgreed(e.target.checked)}
                        className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="termsAgreement" className="font-medium text-gray-700">
                        I agree to the Service Agreement
                      </label>
                      <p className="text-gray-500 text-xs mt-1">By checking this box, you acknowledge that you have read and understood all terms.</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="w-full sm:w-1/2 py-2.5 px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!isAgreed}
                    className={`w-full sm:w-1/2 py-2.5 px-4 text-sm font-medium text-white rounded-md shadow-sm transition-all duration-200 ${isAgreed ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-300 cursor-not-allowed'}`}
                  >
                    Accept & Continue
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
