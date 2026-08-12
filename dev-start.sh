#!/usr/bin/env bash
# Local Development Startup Script for e-Learning Practest
# Run this from the project root: ./dev-start.sh

set -e

echo "🚀 Starting e-Learning Practest Local Development Environment"
echo "=============================================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "api/artisan" ] || [ ! -f "app/package.json" ] || [ ! -f "web/package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Kill existing processes on our ports
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
pkill -f "php artisan serve" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "astro dev" 2>/dev/null || true
sleep 1

# Start Laravel API
echo -e "${BLUE}📡 Starting Laravel API on http://localhost:8000${NC}"
cd api
if [ ! -f ".env" ]; then
    cp .env.example .env
    php artisan key:generate
fi
php artisan serve --port=8000 > ../storage/logs/api.log 2>&1 &
API_PID=$!
cd ..

# Wait for API to be ready
echo -n "   Waiting for API..."
for i in {1..30}; do
    if curl -s http://localhost:8000/api/me >/dev/null 2>&1; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# Start React SPA
echo -e "${BLUE}⚛️  Starting React SPA on http://localhost:3000${NC}"
cd app
if [ ! -f ".env" ]; then
    cp .env.example .env
fi
npm run dev > ../storage/logs/app.log 2>&1 &
APP_PID=$!
cd ..

# Start Astro Site
echo -e "${BLUE}🌐 Starting Astro Site on http://localhost:4321${NC}"
cd web
if [ ! -f ".env" ]; then
    cp .env.example .env
fi
npm run dev > ../storage/logs/web.log 2>&1 &
WEB_PID=$!
cd ..

# Save PIDs for cleanup
echo "$API_PID $APP_PID $WEB_PID" > .dev-pids

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "📋 Service URLs:"
echo "   📡 Laravel API:      http://localhost:8000"
echo "   ⚛️  React SPA:        http://localhost:3000"
echo "   🌐 Astro Public Site: http://localhost:4321"
echo ""
echo "📋 Test Credentials (from SuperAdminSeeder):"
echo "   👤 Super-Admin: thevinstitution@gmail.com / Vevgvbsm@vpdmns2710."
echo ""
echo "📋 To view logs:"
echo "   tail -f storage/logs/api.log"
echo "   tail -f storage/logs/app.log"
echo "   tail -f storage/logs/web.log"
echo ""
echo "🛑 To stop all services: ./dev-stop.sh"
echo ""
echo "Press Ctrl+C to stop this script (services will keep running)"
echo "Or run ./dev-stop.sh in another terminal to stop all services"

# Keep script running to show logs
wait