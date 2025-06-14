#!/bin/bash

# Database Optimization Setup Script for Neon Pro Plan
# This script sets up all the necessary components for database optimization

echo "🚀 Setting up Database Optimization for Neon Pro Plan..."
echo "============================================================"

# Create required directories
echo "📁 Creating required directories..."
mkdir -p scripts
mkdir -p logs
mkdir -p data-archive

# Set permissions
chmod +x setup-optimization.sh
chmod +x scripts/database-cleanup.js
chmod +x scripts/monitor-db-usage.js

echo "✅ Directories created successfully!"

# Check if Node.js and npm are installed
echo "🔍 Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed!"

# Install dependencies (if needed)
echo "📦 Installing dependencies..."
npm install

# Run initial database statistics
echo "📊 Getting initial database statistics..."
if npm run db:stats; then
    echo "✅ Database connection successful!"
else
    echo "⚠️  Database connection failed. Please check your DATABASE_URL in .env file."
fi

# Test the optimized continuous fetch
echo "🔧 Testing optimized continuous fetch..."
echo "This will run for 10 seconds to test the time restrictions..."

# Start the optimized fetch in background and kill after 10 seconds
timeout 10s npm run fetch:optimized &
FETCH_PID=$!
sleep 10
if kill -0 $FETCH_PID 2>/dev/null; then
    kill $FETCH_PID
fi

echo "✅ Optimized fetch test completed!"

# Run performance check
echo "⚡ Running performance check..."
npm run db:performance

# Generate initial report
echo "📋 Generating initial usage report..."
npm run db:report

# Create a simple monitoring script
echo "📝 Creating monitoring helper script..."
cat > monitor-helper.sh << 'EOF'
#!/bin/bash
# Quick monitoring helper script

case "$1" in
    "status")
        echo "📊 Current Database Status:"
        npm run db:report
        ;;
    "performance")
        echo "⚡ Performance Check:"
        npm run db:performance
        ;;
    "cleanup")
        echo "🧹 Cleaning up old data:"
        npm run db:cleanup
        ;;
    "start")
        echo "🚀 Starting optimized data fetch:"
        npm run fetch:optimized
        ;;
    *)
        echo "Usage: ./monitor-helper.sh [status|performance|cleanup|start]"
        echo "  status      - Show current database status"
        echo "  performance - Run performance check"
        echo "  cleanup     - Clean up old data"
        echo "  start       - Start optimized data fetching"
        ;;
esac
EOF

chmod +x monitor-helper.sh

# Create example cron jobs file
echo "⏰ Creating example cron jobs..."
cat > example-cron-jobs.txt << 'EOF'
# Example cron jobs for database maintenance
# To install: crontab -e, then add these lines

# Daily cleanup at 2 AM
0 2 * * * cd /path/to/your/project && npm run db:cleanup >> logs/cron.log 2>&1

# Weekly performance check on Sundays at 3 AM
0 3 * * 0 cd /path/to/your/project && npm run db:performance >> logs/cron.log 2>&1

# Daily usage report at 8 AM
0 8 * * * cd /path/to/your/project && npm run db:report >> logs/cron.log 2>&1

# Note: Replace /path/to/your/project with your actual project path
EOF

echo "✅ Example cron jobs created in example-cron-jobs.txt"

# Final summary
echo ""
echo "🎉 Database Optimization Setup Complete!"
echo "========================================"
echo ""
echo "📋 What's been set up:"
echo "  ✅ Time-restricted data fetching (6 AM - 6 PM, Monday-Friday)"
echo "  ✅ Optimized database connections with pooling"
echo "  ✅ Automated cleanup scripts (30-day retention)"
echo "  ✅ Monitoring and reporting tools"
echo "  ✅ Performance optimization"
echo ""
echo "🚀 Next Steps:"
echo "  1. Stop your current continuous-fetch process"
echo "  2. Start the optimized version: npm run fetch:optimized"
echo "  3. Monitor usage: npm run db:report"
echo "  4. Set up weekly cleanup: npm run db:cleanup"
echo ""
echo "💡 Quick Commands:"
echo "  ./monitor-helper.sh status      - Check current status"
echo "  ./monitor-helper.sh performance - Run performance test"
echo "  ./monitor-helper.sh cleanup     - Clean old data"
echo "  ./monitor-helper.sh start       - Start optimized fetching"
echo ""
echo "📊 Expected Savings:"
echo "  From: ~720 compute hours/month"
echo "  To:   ~260 compute hours/month"
echo "  Savings: ~460 hours/month (64% reduction)"
echo ""
echo "🔍 For detailed instructions, see: DATABASE_OPTIMIZATION_README.md" 