#!/bin/bash

# Tax Scraper Development Setup Script
# Run this to set up everything with one command

set -e

echo "🚀 Tax Scraper Development Setup"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
API_DIR="$SCRIPT_DIR/api"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# Step 1: Setup .env file
echo -e "${BLUE}📝 Step 1: Setting up environment variables${NC}"
if [ -f "$API_DIR/.env" ]; then
    echo "   ✓ .env file already exists"
else
    echo "   → Copying .env.dev to .env"
    cp "$API_DIR/.env.dev" "$API_DIR/.env"
    echo -e "   ${GREEN}✓ Created .env file${NC}"
fi
echo ""

# Step 2: Start PostgreSQL
echo -e "${BLUE}🐘 Step 2: Starting PostgreSQL database${NC}"
cd "$API_DIR"
docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.dev.yml up -d
echo "   → Waiting for database to be ready..."
sleep 5
echo -e "   ${GREEN}✓ PostgreSQL is running${NC}"
echo ""

# Step 3: Install API dependencies
echo -e "${BLUE}📦 Step 3: Installing API dependencies${NC}"
cd "$API_DIR"
if [ -d "node_modules" ]; then
    echo "   ✓ Dependencies already installed"
else
    npm install
    echo -e "   ${GREEN}✓ Installed API dependencies${NC}"
fi
echo ""

# Step 4: Install Frontend dependencies
echo -e "${BLUE}📦 Step 4: Installing Frontend dependencies${NC}"
cd "$FRONTEND_DIR"
if [ -d "node_modules" ]; then
    echo "   ✓ Dependencies already installed"
else
    npm install
    echo -e "   ${GREEN}✓ Installed Frontend dependencies${NC}"
fi
echo ""

# Done
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}🎯 Next Steps:${NC}"
echo ""
echo "1. Start the API server (in one terminal):"
echo -e "   ${BLUE}cd api && npm run dev${NC}"
echo ""
echo "2. Start the Frontend (in another terminal):"
echo -e "   ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo "3. Open your browser:"
echo "   • Frontend: http://localhost:5173"
echo "   • API:      http://localhost:4001/api"
echo "   • Builder:  http://localhost:5173/#/surveys"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}💡 Tip:${NC} To stop the database, run:"
echo "   cd api && docker-compose -f docker-compose.dev.yml down"
echo ""
