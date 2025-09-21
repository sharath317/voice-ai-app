# Voice AI App

A voice-enabled AI application with React frontend and Node.js backend, built with LiveKit for real-time communication.

## 🚀 Quick Start

```bash
# Run the setup scriptsalea
./setup.sh

# Start development servers
cd backend && pnpm dev    # Terminal 1
cd frontend && pnpm dev   # Terminal 2
```

## 📁 Project Structure

```
voice-ai-app/
├── frontend/          # Next.js React application
│   ├── app/          # Next.js app directory
│   ├── components/   # React components
│   ├── hooks/        # Custom React hooks
│   └── lib/          # Utility functions
├── backend/          # Node.js backend API
│   ├── src/          # TypeScript source code
│   ├── dist/         # Compiled JavaScript
│   └── routes/       # API routes
├── setup.sh          # Automated setup script
└── README.md         # This file
```

## 🛠️ Prerequisites

- **Node.js**: v22.18.0 or higher
- **pnpm**: v10.0.0 or higher
- **Git**: For version control

## 📦 Installation

### Option 1: Automated Setup (Recommended)

```bash
./setup.sh
```

### Option 2: Manual Setup

```bash
# Install backend dependencies
cd backend
pnpm install

# Install frontend dependencies
cd ../frontend
pnpm install

# Create environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## ⚙️ Configuration

Both projects require the same environment variables. Update `.env` files in both `backend/` and `frontend/` directories:

```env
LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

OPENAI_API_KEY=your-openai-api-key
DEEPGRAM_API_KEY=your-deepgram-api-key
ELEVEN_API_KEY=your-elevenlabs-api-key
CARTESIA_API_KEY=your-cartesia-api-key

GOOGLE_API_KEY=gemini-api-key

OPENROUTER_API_KEY=open-router-key
OPENROUTER_APP_NAME=suno
OPENROUTER_APP_URL=http://localhost:3000

GROQ_API_KEY=groc-api-key
CEREBRAS_API_KEY=cerebras-api-key

GHL_API_KEY=ghl-api-key
GHL_LOCATION_ID=ghl-location-id

```

## 🚀 Development

### Start Backend Server

```bash
cd backend
pnpm dev
```

Backend runs on: `http://localhost:3001`

### Start Frontend Server

```bash
cd frontend
pnpm dev
```

Frontend runs on: `http://localhost:3000`

## 🏗️ Build for Production

### Backend

```bash
cd backend
pnpm run build
pnpm start
```

### Frontend

```bash
cd frontend
pnpm run build
pnpm start
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
pnpm test
```

### Frontend Linting

```bash
cd frontend
pnpm lint
```

## 📚 Available Scripts

### Backend Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm test` - Run tests
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier

### Frontend Scripts

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier

## 🔧 Tech Stack

### Backend

- **Node.js** with TypeScript
- **LiveKit Agents** - Real-time AI agents
- **OpenAI** - Language model integration
- **Deepgram** - Speech-to-text
- **ElevenLabs** - Text-to-speech
- **Cartesia** - Voice synthesis

### Frontend

- **Next.js 15** with React 19
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **LiveKit Components** - Real-time communication
- **Radix UI** - Accessible components
- **Motion** - Animations

## 🌐 API Endpoints

- `GET /api/connection-details` - Get LiveKit connection details
- WebSocket connections for real-time communication

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

1. **Node.js Version**: Ensure you're using Node.js v22.18.0 or higher
2. **Environment Variables**: Make sure all required API keys are set in both `.env` files
3. **Port Conflicts**: Backend uses port 3001, frontend uses port 3000
4. **Dependencies**: Run `pnpm install` in both directories if you encounter module errors

### Getting Help

- Check the [LiveKit Documentation](https://docs.livekit.io/)
- Review the individual README files in `frontend/` and `backend/` directories
- Open an issue on GitHub for bugs or feature requests
