import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { NewsItem as NewsItemComponent } from './NewsItem';
import { NotificationModal } from './NotificationModal';
import { mockNews } from './mockData';
import type { NotificationPreferences, NewsItem } from './types';

export default function AluminumShorts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    whatsapp: false,
    email: false,
    webApp: false
  });

  const filteredNews = mockNews.filter(news => {
    const matchesSearch = news.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         news.summary.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || news.category === selectedCategory;
    const matchesRegion = selectedRegion === 'all' || news.region === selectedRegion;
    return matchesSearch && matchesCategory && matchesRegion;
  }) as NewsItem[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 mt-12 md:mt-0">
      {/* Header with Smart News Alerts */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Aluminum Shorts</h1>
        <button
          onClick={() => setShowNotificationModal(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-md hover:shadow-lg text-sm sm:text-base"
        >
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          Smart News Alerts
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search news..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm sm:text-base border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-3 sm:gap-4">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 min-w-[120px] px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="market">Market</option>
            <option value="industry">Industry</option>
            <option value="technology">Technology</option>
            <option value="sustainability">Sustainability</option>
          </select>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="flex-1 min-w-[120px] px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Regions</option>
            <option value="global">Global</option>
            <option value="asia">Asia</option>
            <option value="europe">Europe</option>
            <option value="americas">Americas</option>
          </select>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4">News Grid</h2>
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {filteredNews.map(news => (
          <NewsItemComponent key={news.id} news={news} />
        ))}
      </div>

      {filteredNews.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No news found matching your criteria
        </div>
      )}

      <NotificationModal
        show={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        preferences={notificationPreferences}
        onPreferencesChange={setNotificationPreferences}
      />
    </div>
  );
}