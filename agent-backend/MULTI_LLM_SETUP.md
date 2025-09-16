# Multi-LLM Fallback System Setup

## Overview

Your agent now supports multiple LLM providers with automatic fallback when quotas are exceeded or services are unavailable.

## Supported Providers

### 1. OpenAI (Primary)

- **Models**: `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo`
- **Cost**: Pay-per-use
- **Quota**: Based on your billing plan
- **Setup**: Add `OPENAI_API_KEY` to `.env`

### 2. Google Gemini (Secondary)

- **Models**: `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-1.0-pro`
- **Cost**: Free tier (50 requests/day), then pay-per-use
- **Quota**: 50 requests/day (free), unlimited (paid)
- **Setup**: Add `GOOGLE_API_KEY` to `.env`

### 3. Anthropic Claude (Optional)

- **Models**: `claude-3-haiku-20240307`, `claude-3-sonnet-20240229`
- **Cost**: Pay-per-use
- **Quota**: Based on your billing plan
- **Setup**:
  1. Install: `pnpm add @livekit/agents-plugin-anthropic`
  2. Add `ANTHROPIC_API_KEY` to `.env`
  3. Uncomment Claude code in the agent

## Environment Configuration

Add these to your `.env` file:

```bash
# Required
LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# Multi-LLM Providers (add as many as you want)
OPENAI_API_KEY=sk-proj-your-openai-api-key
GOOGLE_API_KEY=your-google-api-key
# ANTHROPIC_API_KEY=your-anthropic-api-key

# Speech Services
DEEPGRAM_API_KEY=your-deepgram-api-key
CARTESIA_API_KEY=your-cartesia-api-key
```

## How It Works

1. **Initialization**: Agent initializes all available LLM providers
2. **Priority System**: Uses providers in order of priority (OpenAI → Google → Claude)
3. **Automatic Fallback**: When a provider hits quota/error, automatically switches to next available
4. **Error Handling**: Each provider has error listeners that mark it as unavailable
5. **Recovery**: Providers can be re-enabled when quotas reset

## Benefits

- ✅ **High Availability**: Never completely down due to quota issues
- ✅ **Cost Optimization**: Use free tiers first, paid services as backup
- ✅ **Performance**: Choose fastest/cheapest available provider
- ✅ **Reliability**: Multiple providers reduce single points of failure
- ✅ **Transparency**: Clear logging of which provider is being used

## Advanced Options

### OpenRouter Integration (Alternative)

Instead of managing individual providers, you can use OpenRouter:

1. Sign up at [openrouter.ai](https://openrouter.ai)
2. Add `OPENROUTER_API_KEY` to `.env`
3. Modify the agent to use OpenRouter's unified API

### Custom Provider Priority

Modify the priority order in the code:

```typescript
// Change priority numbers (lower = higher priority)
priority: 1, // OpenAI (highest priority)
priority: 2, // Google (medium priority)
priority: 3, // Claude (lowest priority)
```

### Quota Monitoring

The system automatically:

- Tracks quota usage per provider
- Switches providers when quotas are hit
- Logs provider status changes
- Provides fallback responses when all providers are down

## Troubleshooting

### All Providers Down

If all LLM providers are unavailable, the agent will:

1. Log the error
2. Set `quotaExceeded = true`
3. Use fallback responses
4. Continue operating with limited functionality

### Adding New Providers

To add a new LLM provider:

1. Install the LiveKit plugin: `pnpm add @livekit/agents-plugin-[provider]`
2. Add the provider initialization code
3. Add error handling
4. Update the priority system

## Monitoring

Watch the logs for:

- `🎯 Using LLM provider: [name]` - Current provider
- `⚠️ Provider [name] marked as quota exceeded` - Provider switched
- `🔄 Switched to provider: [name]` - Fallback activated
- `❌ All LLM providers have exceeded quota` - All providers down
