import { useState } from 'react';
import { Bell, MessageCircle, Mail, Sparkles } from 'lucide-react';

export default function PriceAlert() {
  const [category, setCategory] = useState('MCX');
  const [selectedSuppliers] = useState<string[]>([]);
  const [alertType, setAlertType] = useState('Price');
  const [percentageType] = useState('gain');
  const [notificationMethods, setNotificationMethods] = useState({
    webApp: false,
    whatsApp: false,
    email: false
  });
  const [customMessage] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [targetPercentage, setTargetPercentage] = useState('');

  const handleCreateAlert = () => {
    console.log({
      category,
      selectedSuppliers,
      alertType,
      percentageType,
      notificationMethods,
      customMessage,
      targetPrice,
      targetPercentage
    });
  };

  return (
    <div className="relative bg-gradient-to-br from-blue-50/90 via-purple-50/90 to-pink-50/90 rounded-xl p-5
      border border-white/50 shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.1)] 
      transition-all duration-300 w-full min-h-[340px]">
      
      {/* Blur overlay - reduced opacity */}
      <div className="absolute inset-0 backdrop-blur-[0.5px] z-10 rounded-xl opacity-70"></div>

      {/* Small Coming Soon card at the top */}
      <div className="absolute top-[18px] left-1/2 transform -translate-x-1/2 z-20 w-full max-w-xs">
        <div className="bg-white/90 border border-blue-100 rounded-lg p-3 shadow-md text-center backdrop-blur-[2px] mx-4">
          <div className="inline-flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-600">Coming Soon - Next Update</span>
          </div>
        </div>
      </div>

      {/* Original content (blurred with reduced opacity) */}
      <div className="blur-[1px] opacity-80 pointer-events-none">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Price Alert
            </h2>
          </div>
          <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm flex items-center gap-1 w-fit">
            <Sparkles className="w-3 h-3" />
            AluminiumGenie
          </span>
        </div>

        <div className="space-y-5">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2.5">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {['MCX', 'LME', 'Suppliers'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`py-2.5 px-3 rounded-lg text-sm transition-colors ${
                    category === cat
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Alert Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2.5">Alert Type</label>
            <div className="grid grid-cols-2 gap-2">
              {['Price', 'Percentage'].map((type) => (
                <button
                  key={type}
                  onClick={() => setAlertType(type)}
                  className={`py-2.5 px-3 rounded-lg text-sm transition-colors ${
                    alertType === type
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Target Price/Percentage Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2.5">
              {alertType === 'Price' ? `Target Price (${category === 'LME' ? 'USD' : '₹'})` : 'Percentage Change'}
            </label>
            <div className="relative">
              {alertType === 'Price' && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {category === 'LME' ? '$' : '₹'}
                </span>
              )}
              <input
                type="number"
                step="0.01"
                value={alertType === 'Price' ? targetPrice : targetPercentage}
                onChange={(e) => alertType === 'Price' ? setTargetPrice(e.target.value) : setTargetPercentage(e.target.value)}
                className="w-full pl-8 pr-3 py-3 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder={alertType === 'Price' ? "Enter target price" : "Enter percentage"}
              />
            </div>
          </div>

          {/* Notification Methods */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2.5">
              Notification Method
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setNotificationMethods(prev => ({ ...prev, webApp: !prev.webApp }))}
                className={`flex items-center justify-center gap-1 py-3 px-3 rounded-lg text-sm ${
                  notificationMethods.webApp
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                <Bell className="w-4 h-4" />
                Web App
              </button>
              <button
                onClick={() => setNotificationMethods(prev => ({ ...prev, whatsApp: !prev.whatsApp }))}
                className={`flex items-center justify-center gap-1 py-3 px-3 rounded-lg text-sm ${
                  notificationMethods.whatsApp
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
              <button
                onClick={() => setNotificationMethods(prev => ({ ...prev, email: !prev.email }))}
                className={`flex items-center justify-center gap-1 py-3 px-3 rounded-lg text-sm ${
                  notificationMethods.email
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
            </div>
          </div>

          {/* Create Alert Button */}
          <button 
            onClick={handleCreateAlert}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg 
              flex items-center justify-center gap-2 hover:from-blue-700 hover:to-purple-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm mt-4"
          >
            <Bell className="w-4 h-4" />
            Create Alert
          </button>
        </div>
      </div>
    </div>
  );
}