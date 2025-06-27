# Novaex

A comprehensive metal market intelligence and analytics platform built with Next.js.

## Overview

Novaex provides real-time metal market data, analytics, and insights for traders and businesses in the commodities sector.

## Features

- Real-time metal price tracking (LME, MCX, SBI, RBI rates)
- Interactive dashboards and analytics
- Custom price alerts and notifications
- Market trend analysis and insights
- User authentication and personalized experiences

## Prerequisites

- Node.js 18.x or higher
- PostgreSQL database
- Clerk authentication setup

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and add your environment variables:
   ```
   DATABASE_URL=your-database-url
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-key
   CLERK_SECRET_KEY=your-clerk-secret
   ```

## Building

```
npm run build
```

## Running

```
npm start
```

Or for development with auto-reloading:

```
npm run dev
```

## Key Features

- **Dashboard**: Real-time metal prices and market data
- **Analytics**: Historical trends and price analysis  
- **Alerts**: Custom price notifications
- **Authentication**: Secure user accounts with Clerk
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **Charts**: Chart.js, Recharts
- **Icons**: Lucide React

## License

MIT
