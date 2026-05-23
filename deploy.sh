#!/bin/bash
# deploy.sh — Run this on VPS to update the app
# Usage: bash /root/vipl-renewal/deploy.sh

set -e
APP_DIR="/root/vipl-renewal"

echo "🔄 Pulling latest code..."
cd $APP_DIR
git pull origin main

echo "📦 Installing backend dependencies..."
cd $APP_DIR/backend
npm install --ignore-scripts

echo "🏗️  Building frontend..."
cd $APP_DIR/frontend
npm install --legacy-peer-deps
npm run build

echo "🔁 Restarting services..."
pm2 restart vipl-renewal-backend
pm2 restart vipl-renewal-frontend
pm2 save

echo "✅ Deploy complete!"
echo "🌐 Live at: https://subscription.vrushaliinfotech.com"
