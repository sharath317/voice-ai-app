# Mastra + LiveKit Integration Setup Guide

This guide will help you set up and run the **Mastra + LiveKit Voice Agent** - a powerful combination of Mastra's AI framework with LiveKit's real-time voice capabilities.

## 🚀 What You Get

- **Real Mastra Integration**: Uses actual `@mastra/core` and `@mastra/memory` packages
- **Advanced Memory System**: Persistent memory across conversations
- **Professional Tools**: User info capture, sentiment analysis, follow-up scheduling
- **Multi-Provider Fallback**: OpenRouter → Google → OpenAI for LLM and TTS
- **Production Ready**: Proper error handling, metrics, and logging

## 📋 Prerequisites

- Node.js 20.9.0 or later
- pnpm package manager
- Required API keys (see Environment Variables section)

## 🛠️ Installation

The Mastra packages are already installed. If you need to reinstall:

```bash
cd /Users/sharathchandra/Projects/voice-ai-app/agent-backend
pnpm add @mastra/core@latest @mastra/memory@latest @mastra/voice-openai@latest
```

## 🔑 Environment Variables

Create or update your `.env` file with the following variables:

```env
# LiveKit Configuration
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
LIVEKIT_URL=wss://your-livekit-server.com

# LLM Providers (at least one required)
OPENROUTER_API_KEY=your_openrouter_api_key  # Recommended - best for avoiding quota issues
GOOGLE_API_KEY=your_google_api_key          # Alternative
OPENAI_API_KEY=your_openai_api_key          # Fallback

# TTS Providers (at least one required)
GOOGLE_API_KEY=your_google_api_key          # Recommended - best for avoiding quota issues
OPENAI_API_KEY=your_openai_api_key          # Alternative
CARTESIA_API_KEY=your_cartesia_api_key      # Fallback

# STT Provider
DEEPGRAM_API_KEY=your_deepgram_api_key      # Required for speech-to-text
```

## 🎯 Running the Agent

### Start the Mastra + LiveKit Agent

```bash
cd /Users/sharathchandra/Projects/voice-ai-app/agent-backend
pnpm run dev:mastra-livekit
```

### Expected Output

```
🚀 Mastra + LiveKit Voice Agent starting...
📋 Session ID: mastra_session_1234567890
✅ Using OpenRouter LLM provider
✅ Using Google TTS provider
✅ AgentSession created with Mastra integration
🔧 Setting up metrics collection...
✅ Mastra + LiveKit Voice Agent session started successfully
```

## 🧠 Mastra Features

### Memory System

- **Persistent Storage**: User information, sentiment analysis, follow-up requests
- **Context Awareness**: Remembers previous conversations
- **Cross-Session Memory**: Information persists between sessions

### Available Tools

1. **capture_user_info**

   - Stores user details (name, email, company, role, interests)
   - Automatically triggered during conversations

2. **analyze_sentiment**

   - Tracks conversation sentiment (positive/neutral/negative)
   - Monitors engagement levels (high/medium/low)
   - Provides confidence scores

3. **schedule_follow_up**

   - Schedules future interactions (call/meeting/email)
   - Stores preferred dates, times, and duration
   - Includes additional notes

4. **get_memory_context**
   - Retrieves stored information
   - Supports filtering by type (user_info, sentiment, follow_up)
   - Returns comprehensive context data

## 🔄 Provider Fallback System

### LLM Providers (in order of preference)

1. **OpenRouter** - Multiple models, best for avoiding quota issues
2. **Google Gemini** - High quality, good rate limits
3. **OpenAI** - Reliable fallback

### TTS Providers (in order of preference)

1. **Google TTS** - High quality, good rate limits
2. **OpenAI TTS** - Reliable alternative
3. **Cartesia TTS** - Premium quality fallback

## 📊 Monitoring & Logging

The agent includes comprehensive monitoring:

- **Real-time Metrics**: Usage statistics, performance data
- **Memory Context Logging**: Every 30 seconds
- **Session Tracking**: Start/end events with cleanup
- **Error Handling**: Graceful fallbacks and detailed error logs

### Sample Log Output

```
📊 Usage Summary: {"totalTokens": 1500, "cost": 0.03}
🧠 Mastra Memory Context:
  User Info: {"name": "John Doe", "company": "Acme Corp"}
  Sentiment: {"sentiment": "positive", "engagement": "high"}
  Follow-up: {"type": "call", "date": "2024-01-15"}
```

## 🎨 Customization

### Adding New Tools

1. Create a new tool using `createTool`:

```typescript
const myCustomTool = createTool({
  id: 'my_custom_tool',
  description: 'Description of what this tool does',
  inputSchema: z.object({
    // Define input parameters
  }),
  outputSchema: z.object({
    // Define output structure
  }),
  execute: async ({ context }) => {
    // Tool implementation
    return { success: true, result: 'Tool executed' };
  },
});

// Register with Mastra
mastra.tool(myCustomTool);
```

2. Update the agent instructions to mention the new tool.

### Modifying Memory Storage

The current implementation uses in-memory storage. To use persistent storage:

```typescript
const memoryManager = new MemoryManager({
  provider: 'postgres', // or 'mongodb', 'dynamodb', etc.
  config: {
    // Provider-specific configuration
  },
});
```

## 🚨 Troubleshooting

### Common Issues

1. **"No LLM provider API key found"**

   - Ensure at least one LLM API key is set in `.env`
   - Check that the key is valid and has sufficient quota

2. **"No TTS provider API key found"**

   - Ensure at least one TTS API key is set in `.env`
   - Verify the key has the necessary permissions

3. **Memory not persisting**

   - Check that the MemoryManager is properly initialized
   - Verify the memory provider configuration

4. **Tools not working**
   - Ensure tools are properly registered with `mastra.tool()`
   - Check that the agent instructions mention the tools

### Debug Mode

Enable debug logging by setting:

```env
DEBUG=mastra:*
```

## 🔗 Integration with Frontend

The agent works with the existing LiveKit frontend. No changes needed to the frontend code - it will automatically connect to the Mastra-powered agent.

## 📈 Performance Tips

1. **Use OpenRouter**: Best for avoiding quota issues
2. **Monitor Memory Usage**: Large memory contexts can impact performance
3. **Optimize Tools**: Keep tool execution fast and efficient
4. **Regular Cleanup**: Clear old memory entries periodically

## 🎯 Next Steps

1. **Test the Agent**: Run it and verify all features work
2. **Customize Tools**: Add domain-specific tools for your use case
3. **Configure Memory**: Set up persistent storage if needed
4. **Monitor Performance**: Use the built-in metrics to optimize
5. **Deploy**: Use the existing deployment setup

## 📚 Additional Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [OpenRouter API Documentation](https://openrouter.ai/docs)

---

**Ready to run?** Execute `pnpm run dev:mastra-livekit` and start building amazing voice AI experiences with Mastra + LiveKit! 🚀

