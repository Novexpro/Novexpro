import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function FeedbackBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg p-4 mb-6 relative shadow-md border border-indigo-400/30">
      <button
        onClick={() => setIsVisible(false)}
        className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors"
        aria-label="Close feedback banner"
      >
        <X size={18} />
      </button>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">Help us improve</h3>
          <p className="text-sm text-white/85 mt-1">
            Your feedback helps us enhance your experience with our platform.
          </p>
        </div>
        <div className="sm:mr-4"> {/* Changed from ml-auto to sm:mr-4 */}
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLScHgdFvIix9F1i8FwjkIUPJueD4XaxHUyboumItUBt1pIWGOw/viewform"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-900 bg-white rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600 transition-colors duration-200 shadow-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Share Feedback
          </a>
        </div>
      </div>
    </div>
  );
}