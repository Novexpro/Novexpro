import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

export default function SupportButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
  onClick={() => setIsOpen(true)}
  className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 group"
  aria-label="Open support chat"
>
  <MessageCircle className="w-6 h-6" />
  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 bg-white text-gray-900 px-4 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
    Need help?
  </span>
</button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-gray-900 rounded-2xl shadow-2xl border border-white/10">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-semibold text-white">Support Chat</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-white/5"
                aria-label="Close support chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <p className="text-gray-400">
                  How can we help you today? Our support team is available to assist you with any questions or concerns.
                </p>
                <div className="flex flex-col space-y-3">
                  <a
                    href="mailto:support@novexpro.com"
                    className="flex items-center p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors duration-200 group"
                  >
                    <div className="flex-1">
                      <h4 className="text-white font-medium group-hover:text-blue-400 transition-colors duration-200">
                        Email Support
                      </h4>
                      <p className="text-sm text-gray-400">Get in touch via email</p>
                    </div>
                    <MessageCircle className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors duration-200" />
                  </a>
                  <a
                    href="https://docs.novexpro.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors duration-200 group"
                  >
                    <div className="flex-1">
                      <h4 className="text-white font-medium group-hover:text-blue-400 transition-colors duration-200">
                        Documentation
                      </h4>
                      <p className="text-sm text-gray-400">Browse our guides and tutorials</p>
                    </div>
                    <MessageCircle className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors duration-200" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
