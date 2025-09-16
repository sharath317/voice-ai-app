# OpenRouter Agent Setup Guide

## Overview

`agent2.ts` uses OpenRouter for unified access to multiple LLM providers through a single API with automatic fallbacks. This is much cleaner than managing individual providers.

## What is OpenRouter?

OpenRouter is a unified API that provides access to multiple LLM providers (OpenAI, Google, Anthropic, Meta, Mistral, etc.) through a single endpoint with automatic fallbacks and load balancing.

## Benefits of OpenRouter

- ✅ **Single API**: One API key for all providers
- ✅ **Automatic Fallbacks**: Built-in failover between providers
- ✅ **Cost Optimization**: Choose cheapest available model
- ✅ **No Quota Management**: OpenRouter handles provider quotas
- ✅ **Model Variety**: Access to 100+ models from different providers
- ✅ **Simplified Setup**: No need to manage multiple API keys

## Setup Instructions

### 1. Sign up for OpenRouter

1. Go to [openrouter.ai](https://openrouter.ai)
2. Create an account
3. Get your API key from the dashboard
4. Add credits to your account (pay-per-use)

### 2. Environment Configuration

Add these to your `.env` file:

```bash
# Required
LIVEKIT_URL=wss://your-livekit-url.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# OpenRouter Configuration
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_APP_NAME=your-app-name
OPENROUTER_APP_URL=http://localhost:3000

# Speech Services
DEEPGRAM_API_KEY=your-deepgram-api-key
CARTESIA_API_KEY=your-cartesia-api-key
```

### 3. Run the OpenRouter Agent

```bash
# Run agent2.ts instead of agent.ts
pnpm run dev -- src/agent2.ts dev
```

## Available Models (Fallback Order)

The agent automatically tries these models in order:

1. **`openai/gpt-4o-mini`** - Primary (Fast, cost-effective)
2. **`google/gemini-1.5-flash`** - Secondary (Free tier available)
3. **`anthropic/claude-3-haiku-20240307`** - Tertiary (High quality)
4. **`meta-llama/llama-3.1-8b-instruct`** - Quaternary (Open source)
5. **`mistralai/mistral-7b-instruct`** - Quinary (Alternative)

## Customization

### Change Model Priority

Edit the `fallbackModels` array in `agent2.ts`:

```typescript
fallbackModels: [
  'anthropic/claude-3-sonnet-20240229', // High quality
  'openai/gpt-4o', // Most capable
  'google/gemini-1.5-pro', // Google's best
  'meta-llama/llama-3.1-70b-instruct', // Large model
  'mistralai/mistral-7b-instruct', // Fast fallback
];
```

### Add More Models

You can add any model from OpenRouter's catalog:

```typescript
fallbackModels: [
  'openai/gpt-4o-mini',
  'google/gemini-1.5-flash',
  'anthropic/claude-3-haiku-20240307',
  'cohere/command-r-plus', // Cohere model
  'perplexity/llama-3.1-sonar-large-128k-online', // Perplexity
  'meta-llama/llama-3.1-8b-instruct',
  'mistralai/mistral-7b-instruct',
];
```

## Available Tools

The OpenRouter agent includes these tools:

### 1. `getModelInfo`

Get information about the current AI model being used.

### 2. `switchModel`

Switch to a different AI model manually.

### 3. `getWeather`

Look up weather information (example tool).

## Cost Management

### OpenRouter Pricing

- Pay only for what you use
- No monthly subscriptions
- Transparent pricing per token
- Automatic cost optimization

### Cost Comparison

| Model                      | Cost per 1M tokens | Quality   |
| -------------------------- | ------------------ | --------- |
| `openai/gpt-4o-mini`       | $0.15              | High      |
| `google/gemini-1.5-flash`  | $0.075             | High      |
| `anthropic/claude-3-haiku` | $0.25              | Very High |
| `meta-llama/llama-3.1-8b`  | $0.20              | Good      |
| `mistralai/mistral-7b`     | $0.20              | Good      |

## Monitoring

Watch the logs for:

- `🔄 OpenRouter: Trying model [name]` - Model attempt
- `✅ OpenRouter: Success with model [name]` - Successful response
- `❌ OpenRouter: Model [name] failed` - Model failure
- `🔄 OpenRouter: Switching to next model` - Fallback activation

## Troubleshooting

### Common Issues

1. **"OpenRouter API key is required"**

   - Add `OPENROUTER_API_KEY` to your `.env` file
   - Get API key from [openrouter.ai](https://openrouter.ai)

2. **"All OpenRouter models failed"**

   - Check your OpenRouter account balance
   - Verify API key is correct
   - Check network connectivity

3. **High costs**
   - Use cheaper models in fallback order
   - Monitor usage in OpenRouter dashboard
   - Set spending limits

### Debug Mode

Add debug logging by modifying the `callOpenRouterAPI` method:

```typescript
console.log('OpenRouter Request:', {
  model,
  prompt: prompt.substring(0, 100) + '...',
  options,
});
```

## Comparison: Individual Providers vs OpenRouter

| Feature             | Individual Providers | OpenRouter            |
| ------------------- | -------------------- | --------------------- |
| Setup Complexity    | High (multiple APIs) | Low (single API)      |
| Fallback Management | Manual               | Automatic             |
| Cost Optimization   | Manual               | Built-in              |
| Quota Management    | Manual               | Handled by OpenRouter |
| Model Variety       | Limited              | 100+ models           |
| Maintenance         | High                 | Low                   |

## Next Steps

1. **Test the agent**: Run `agent2.ts` and test with different scenarios
2. **Monitor costs**: Check OpenRouter dashboard for usage
3. **Optimize models**: Adjust fallback order based on your needs
4. **Add more models**: Experiment with different providers
5. **Scale up**: Use for production with proper monitoring

## Support

- OpenRouter Documentation: [openrouter.ai/docs](https://openrouter.ai/docs)
- OpenRouter Discord: [discord.gg/openrouter](https://discord.gg/openrouter)
- LiveKit Agents: [docs.livekit.io/agents](https://docs.livekit.io/agents)
