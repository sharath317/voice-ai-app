#!/bin/bash

# Voice AI App Setup Script
echo "🚀 Setting up Voice AI App..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 22.18.0 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="22.18.0"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js $REQUIRED_VERSION or higher."
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install pnpm."
    exit 1
fi

echo "✅ pnpm is installed"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
pnpm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi
echo "✅ Backend dependencies installed"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
pnpm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
echo "✅ Frontend dependencies installed"

# Create environment files if they don't exist
cd ../backend
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created backend .env file"
fi

cd ../frontend
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created frontend .env file"
fi

cd ..

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure your environment variables in:"
echo "   - backend/.env"
echo "   - frontend/.env"
echo ""
echo "2. Start the development servers:"
echo "   Backend:  cd backend && pnpm dev"
echo "   Frontend: cd frontend && pnpm dev"
echo ""
echo "3. Open your browser to http://localhost:3000"
echo ""
echo "🔧 Required environment variables:"
echo "   - LIVEKIT_URL"
echo "   - LIVEKIT_API_KEY"
echo "   - LIVEKIT_API_SECRET"
echo "   - OPENAI_API_KEY"
echo "   - DEEPGRAM_API_KEY"
echo "   - CARTESIA_API_KEY"
