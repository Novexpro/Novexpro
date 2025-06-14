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
