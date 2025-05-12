import React from 'react';
import Image from 'next/image';
import { ExternalLink, Globe, Calendar, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { NewsItem as NewsItemType } from './types';
import { PredictionIndicator } from './PredictionIndicator';

interface NewsItemProps {
  news: NewsItemType;
}

export function NewsItem({ news }: NewsItemProps) {
  return (
    <article className="flex flex-col md:flex-row gap-6 p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
      <div className="md:w-1/4">
        <Image
          src={`${news.imageUrl}/600x400`}
          alt={news.title}
          width={600}
          height={400}
          className="w-full h-48 object-cover rounded-lg"
        />
      </div>
      <div className="md:w-2/4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {news.title}
          </h2>
          <a
            href={news.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ExternalLink className="w-5 h-5 text-gray-500" />
          </a>
        </div>
        <p className="text-gray-600 mb-4">{news.summary}</p>
        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Globe className="w-4 h-4" />
            <span>{news.source}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(news.date), 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Tag className="w-4 h-4" />
            <span className="capitalize">{news.category}</span>
          </div>
        </div>
      </div>
      <div className="md:w-1/4 flex items-center justify-center">
        <PredictionIndicator prediction={news.prediction} confidence={news.confidence} />
      </div>
    </article>
  );
}