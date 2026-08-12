#!/usr/bin/env bash
# Stop all local development services

echo "🛑 Stopping e-Learning Practest Local Development Environment"

# Kill processes on our ports
pkill -f "php artisan serve" 2>/dev/null && echo "   Stopped Laravel API" || echo "   Laravel API not running"
pkill -f "vite" 2>/dev/null && echo "   Stopped React SPA" || echo "   React SPA not running"
pkill -f "astro dev" 2>/dev/null && echo "   Stopped Astro Site" || echo "   Astro Site not running"

# Clean up PID file
rm -f .dev-pids

echo "✅ All services stopped"