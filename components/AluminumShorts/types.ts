export interface NewsItem {
  id: string;
  title: string;
  source: string;
  date: string;
  summary: string;
  url: string;
  imageUrl: string;
  category: 'market' | 'industry' | 'technology' | 'sustainability';
  region: 'global' | 'asia' | 'europe' | 'americas';
  prediction: 'up' | 'down' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
}

export interface NotificationPreferences {
  whatsapp: boolean;
  email: boolean;
  webApp: boolean;
}