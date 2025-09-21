# Mastra-Inspired + LiveKit Integration Setup

This guide shows you how to integrate Mastra-inspired concepts with LiveKit for building intelligent voice agents with memory, tools, and workflows. This implementation demonstrates the core concepts from [Mastra.ai](https://mastra.ai/) without requiring external dependencies.

## 🚀 What is Mastra?

Mastra is a TypeScript agent framework that provides:

- **Unified API** for multiple LLM providers
- **Memory Management** for persistent conversations
- **Tool Calling** for real-world actions
- **Workflows** for complex multi-step processes
- **RAG Integration** for knowledge base access

## 📋 Prerequisites

1. **LiveKit Account** - [Get your credentials](https://cloud.livekit.io/)
2. **OpenAI or OpenRouter API Key** - [OpenAI](https://openai.com/) or [OpenRouter](https://openrouter.ai/)
3. **Deepgram API Key** - [Get your key](https://deepgram.com/)
4. **Cartesia API Key** - [Get your key](https://cartesia.ai/)

## 🛠️ Installation

### Step 1: No Additional Dependencies Required

This implementation uses only existing dependencies and demonstrates Mastra concepts through custom classes.

### Step 2: Update Environment Variables

Add these to your `.env` file:

```bash
# LiveKit Configuration
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
LIVEKIT_URL=wss://your-livekit-url.livekit.cloud

# LLM Configuration (choose one)
# Option 1: OpenAI
OPENAI_API_KEY=your-openai-api-key

# Option 2: OpenRouter (recommended for multiple models)
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_APP_NAME=LiveKit Voice Agent
OPENROUTER_APP_URL=http://localhost:3000

# Speech Services
DEEPGRAM_API_KEY=your-deepgram-api-key
CARTESIA_API_KEY=your-cartesia-api-key
```

## 🎯 Features

### 1. **Memory Management**

- Persistent conversation memory
- User information storage
- Sentiment analysis tracking
- Follow-up scheduling

### 2. **Tool Integration**

- `capture_user_info` - Store user details
- `analyze_sentiment` - Track conversation sentiment
- `schedule_follow_up` - Schedule future interactions

### 3. **Multi-Provider Support**

- OpenAI GPT models
- OpenRouter (multiple providers)
- Automatic fallback handling

### 4. **LiveKit Integration**

- Real-time voice interactions
- Speech-to-text (Deepgram)
- Text-to-speech (Cartesia)
- Noise cancellation

## 🚀 Running the Mastra Agent

### Start the Agent

```bash
# Run the Mastra-inspired agent
pnpm run dev:mastra
```

### Expected Output

```
🔧 Initializing Mastra Voice Agent worker...
✅ Starting Mastra Voice Agent worker...
🚀 Mastra Voice Agent starting...
✅ Mastra LLM initialized
✅ AgentSession created with Mastra integration
🔧 Setting up metrics collection...
✅ Metrics collection setup complete
🔧 Starting session...
✅ Session started successfully
🚀 Mastra Voice Agent connected to room
✅ Connected to room successfully
```

## 🧠 Memory Features

### User Information Storage

The agent automatically captures and stores:

- Name, email, phone
- Company and role
- Interests and needs
- Conversation history

### Sentiment Analysis

Tracks conversation sentiment:

- Positive, neutral, negative
- Engagement levels
- Confidence scores
- Timestamped notes

### Follow-up Scheduling

Manages future interactions:

- Call scheduling
- Meeting coordination
- Demo requests
- Custom notes

## 🔧 Customization

### Adding Custom Tools

```typescript
new Tool({
  id: 'custom_tool',
  description: 'Your custom tool description',
  parameters: z.object({
    // Define your parameters
  }),
  execute: async (params) => {
    // Your custom logic
    return 'Tool executed successfully';
  },
});
```

### Memory Configuration

```typescript
// Ephemeral memory (session-based)
const memory = memory({
  type: 'ephemeral',
});

// Persistent memory (long-term storage)
const memory = memory({
  type: 'persistent',
  // Add persistence configuration
});
```

### LLM Provider Selection

```typescript
// OpenAI
model: openai('gpt-4o-mini', {
  apiKey: process.env.OPENAI_API_KEY,
});

// OpenRouter (multiple providers)
model: openai('anthropic/claude-3.5-sonnet', {
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});
```

## 📊 Monitoring

### Metrics Collection

- Token usage tracking
- Response time monitoring
- Error rate analysis
- Memory usage statistics

### Memory Context Logging

```bash
🧠 Mastra Memory Context: {
  userInfo: { name: "John", company: "Acme Corp" },
  sentimentAnalysis: { sentiment: "positive", engagement: "high" },
  followUpRequest: { type: "call", preferredDate: "2024-01-15" }
}
```

## 🔄 Workflow Integration

### Basic Workflow Example

```typescript
import { Workflow } from '@mastra/core';

const salesWorkflow = new Workflow({
  name: 'Sales Process',
  steps: [
    {
      id: 'qualify',
      type: 'llm',
      prompt: 'Qualify the lead based on conversation',
    },
    {
      id: 'schedule',
      type: 'tool',
      tool: 'schedule_follow_up',
    },
  ],
});
/ Use in agent
const agent = new Agent({
  / ... other config
  workflow: salesWorkflow,
});
```

## 🐛 Troubleshooting

### Common Issues

1. **Memory Not Persisting**

   ```bash
   # Check memory configuration
   console.log('Memory type:', memory.type);
   ```

2. **Tool Execution Errors**

   ```bash
   # Check tool parameters
   console.log('Tool params:', params);
   ```

3. **LLM Provider Issues**
   ```bash
   # Verify API keys
   console.log('API Key set:', !!process.env.OPENAI_API_KEY);
   ```

### Debug Mode

```typescript
// Enable debug logging
const agent = new Agent({
  // ... config
  debug: true,
});
```

## 🚀 Advanced Features

### RAG Integration

```typescript
import { rag } from '@mastra/rag';

const knowledgeBase = rag({
  vectorStore: 'pinecone', / or other providers
  embeddingModel: 'openai',
});
/ Add to agent
const agent = new Agent({
  / ... config
  rag: knowledgeBase,
});
```

### Multi-Agent Orchestration

```typescript
// Create multiple specialized agents
const salesAgent = new Agent({
  /* sales config */
});
const supportAgent = new Agent({
  /* support config */
});

// Orchestrate between agents
const orchestrator = new Workflow({
  steps: [
    { agent: salesAgent, condition: 'is_sales_query' },
    { agent: supportAgent, condition: 'is_support_query' },
  ],
});
```

## 📚 Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [LiveKit Agents Guide](https://docs.livekit.io/agents/)
- [OpenRouter API Docs](https://openrouter.ai/docs)
- [Deepgram API Docs](https://developers.deepgram.com/)

## 🎉 Next Steps

1. **Test the Integration**: Run `pnpm run dev:mastra`
2. **Customize Tools**: Add your own business logic
3. **Implement Workflows**: Create complex multi-step processes
4. **Add RAG**: Integrate knowledge bases
5. **Deploy**: Use Mastra Cloud for production

**Your Mastra + LiveKit voice agent is ready! 🚀**
