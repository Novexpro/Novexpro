import React from 'react';
import { Sparkles, ExternalLink, MessageCircle, Mail, Bell } from 'lucide-react';

interface NotificationPreferences {
  whatsapp: boolean;
  email: boolean;
  webApp: boolean;
}

interface NotificationModalProps {
  show: boolean;
  onClose: () => void;
  preferences: NotificationPreferences;
  onPreferencesChange: (preferences: NotificationPreferences) => void;
}

export function NotificationModal({ show, onClose, preferences, onPreferencesChange }: NotificationModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold">Smart News Alerts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-green-500" />
              <span>WhatsApp Notifications</span>
            </div>
            <button
              onClick={() => onPreferencesChange({ ...preferences, whatsapp: !preferences.whatsapp })}
              className={`w-12 h-6 rounded-full transition-colors ${
                preferences.whatsapp ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transform transition-transform ${
                preferences.whatsapp ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-blue-500" />
              <span>Email Notifications</span>
            </div>
            <button
              onClick={() => onPreferencesChange({ ...preferences, email: !preferences.email })}
              className={`w-12 h-6 rounded-full transition-colors ${
                preferences.email ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transform transition-transform ${
                preferences.email ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-purple-500" />
              <span>Web App Notifications</span>
            </div>
            <button
              onClick={() => onPreferencesChange({ ...preferences, webApp: !preferences.webApp })}
              className={`w-12 h-6 rounded-full transition-colors ${
                preferences.webApp ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transform transition-transform ${
                preferences.webApp ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}