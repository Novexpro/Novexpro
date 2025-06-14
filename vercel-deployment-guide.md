# Vercel Production Deployment Guide

The database optimization needs to be adapted for Vercel's serverless environment. Here's how to deploy it properly:

## 🚨 **Important: Serverless Limitations**

Vercel's serverless environment has limitations:
- ❌ No persistent background processes
- ❌ No file system write access
- ❌ No bash scripts
- ❌ No cron jobs

## ✅ **Vercel-Compatible Solutions**

### 1. **API Routes for Data Fetching**

Create API routes instead of background processes:

#### `pages/api/fetch-data.js` or `app/api/fetch-data/route.js`
```javascript
import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Time restriction function
function isWithinOperatingHours() {
  const now = new Date();
  const istTime = new Date(now.toLocaleString("en-US", { timeZone: 'Asia/Kolkata' }));
  
  const currentHour = istTime.getHours();
  const currentDay = istTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Check if it's weekend
  if (currentDay === 0 || currentDay === 6) {
    return { allowed: false, reason: 'Weekend' };
  }
  
  // Check if within operating hours (6 AM to 6 PM)
  if (currentHour < 6 || currentHour >= 18) {
    return { allowed: false, reason: 'Outside operating hours' };
  }
  
  return { allowed: true, reason: 'Within operating hours' };
}

export async function GET() {
  try {
    // Check operating hours
    const timeCheck = isWithinOperatingHours();
    
    if (!timeCheck.allowed) {
      return NextResponse.json({ 
        success: false, 
        message: `Data fetching restricted: ${timeCheck.reason}` 
      });
    }
    
    // Fetch data from your external API
    const response = await fetch('http://148.135.138.22:5002/stream', {
      headers: { 'Accept': 'text/event-stream' }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    
    // Process and store data (your existing logic)
    // ... existing data processing code ...
    
    return NextResponse.json({ 
      success: true, 
      message: 'Data fetched and stored successfully' 
    });
    
  } catch (error) {
    console.error('Error in fetch-data API:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
```

### 2. **Database Statistics API**

#### `pages/api/db-stats.js` or `app/api/db-stats/route.js`
```javascript
import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const stats = {
      timestamp: new Date().toISOString(),
      tables: {},
      totalRecords: 0,
      operatingHours: {
        current: isWithinOperatingHours().allowed,
        startHour: 6,
        endHour: 18,
        weekdaysOnly: true
      }
    };
    
    // Get record counts
    const [
      mcxCount,
      metalPriceCount,
      lmeCount,
      // ... other counts
    ] = await Promise.all([
      prisma.mCX_3_Month.count(),
      prisma.metalPrice.count(),
      prisma.lME_3Month.count(),
      // ... other count queries
    ]);
    
    stats.tables = {
      'MCX_3_Month': mcxCount,
      'MetalPrice': metalPriceCount,
      'LME_3Month': lmeCount,
      // ... other tables
    };
    
    stats.totalRecords = Object.values(stats.tables).reduce((a, b) => a + b, 0);
    
    return NextResponse.json(stats);
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
```

### 3. **Data Cleanup API**

#### `pages/api/cleanup.js` or `app/api/cleanup/route.js`
```javascript
import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days retention
    
    // Delete old data
    const deleteResults = await Promise.allSettled([
      prisma.mCX_3_Month.deleteMany({
        where: { createdAt: { lt: cutoffDate } }
      }),
      prisma.metalPrice.deleteMany({
        where: { createdAt: { lt: cutoffDate } }
      }),
      // ... other cleanup operations
    ]);
    
    const totalDeleted = deleteResults
      .filter(r => r.status === 'fulfilled')
      .reduce((total, r) => total + r.value.count, 0);
    
    return NextResponse.json({ 
      success: true, 
      deleted: totalDeleted,
      cutoffDate: cutoffDate.toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
```

## 🔄 **External Cron Services**

Since Vercel doesn't support cron jobs, use external services:

### 1. **Vercel Cron (Pro Plan)**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/fetch-data",
      "schedule": "*/1 * * * 1-5"
    },
    {
      "path": "/api/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### 2. **GitHub Actions** (Free Alternative)
```yaml
# .github/workflows/data-fetch.yml
name: Fetch Data
on:
  schedule:
    - cron: '*/1 6-17 * * 1-5' # Every minute, 6AM-5PM, Mon-Fri IST
jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Data Fetch
        run: |
          curl -X GET "${{ secrets.VERCEL_URL }}/api/fetch-data"
```

### 3. **UptimeRobot** (Free External Monitoring)
- Create HTTP(s) monitors
- Set interval to 1 minute
- Monitor: `https://yourapp.vercel.app/api/fetch-data`
- Only active during business hours

### 4. **Cron-job.org** (Free Cron Service)
- Create cron jobs that call your API endpoints
- Schedule: `*/1 6-17 * * 1-5` (every minute, 6AM-5PM, Mon-Fri)

## 📁 **File Structure for Vercel**

```
your-project/
├── app/
│   └── api/
│       ├── fetch-data/
│       │   └── route.js
│       ├── db-stats/
│       │   └── route.js
│       ├── cleanup/
│       │   └── route.js
│       └── monitor/
│           └── route.js
├── lib/
│   ├── prisma.js (optimized client)
│   └── time-utils.js (time validation)
├── prisma/
│   └── schema.prisma
├── vercel.json
└── package.json
```

## 🛠️ **Environment Variables**

Set in Vercel Dashboard:
```env
DATABASE_URL="your_neon_database_url"
CRON_SECRET="your_secret_for_cron_endpoints" # Optional security
```

## 🔐 **Security for Cron Endpoints**

Add authentication to prevent abuse:

```javascript
// In your API routes
export async function GET(request) {
  const cronSecret = request.headers.get('x-cron-secret');
  
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // ... rest of your code
}
```

## 📊 **Monitoring Dashboard**

Create a dashboard page to monitor your system:

#### `app/admin/dashboard/page.js`
```javascript
'use client';
import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchStats();
  }, []);
  
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/db-stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Database Dashboard</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-bold">Operating Status</h2>
          <p className={stats.operatingHours.current ? 'text-green-600' : 'text-red-600'}>
            {stats.operatingHours.current ? 'ACTIVE' : 'INACTIVE'}
          </p>
        </div>
        
        <div className="bg-white p-4 rounded shadow">
          <h2 className="font-bold">Total Records</h2>
          <p className="text-2xl">{stats.totalRecords?.toLocaleString()}</p>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded shadow">
        <h2 className="font-bold mb-2">Table Breakdown</h2>
        {Object.entries(stats.tables || {}).map(([table, count]) => (
          <div key={table} className="flex justify-between">
            <span>{table}</span>
            <span>{count.toLocaleString()}</span>
          </div>
        ))}
      </div>
      
      <div className="mt-4 space-x-2">
        <button 
          onClick={() => fetch('/api/cleanup', { method: 'POST' })}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Clean Old Data
        </button>
        <button 
          onClick={fetchStats}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Refresh Stats
        </button>
      </div>
    </div>
  );
}
```

## 🚀 **Deployment Steps**

1. **Update your code structure** for Vercel compatibility
2. **Set environment variables** in Vercel dashboard
3. **Deploy to Vercel**
4. **Set up external cron service** (GitHub Actions/UptimeRobot)
5. **Test the API endpoints**
6. **Monitor the dashboard**

## 📈 **Benefits of This Approach**

✅ **Serverless-compatible**  
✅ **Time restrictions maintained**  
✅ **Database optimizations preserved**  
✅ **Monitoring capabilities**  
✅ **Cost-effective**  
✅ **Scalable**  

## 🔄 **Migration Checklist**

- [ ] Convert `continuous-fetch.js` to API route
- [ ] Create database stats API
- [ ] Create cleanup API
- [ ] Set up external cron service
- [ ] Create monitoring dashboard
- [ ] Test time restrictions
- [ ] Deploy to Vercel
- [ ] Monitor compute usage

The time restrictions and database optimizations will work the same way, but delivered through serverless API routes instead of background processes. 