# 🔄 OpenRouter Integration in Agent2 - Complete Guide

This guide explains how the OpenRouter integration works in `agent2.ts`, providing unified access to multiple LLM providers with automatic fallback capabilities.

## 🎯 **What is OpenRouter?**

**OpenRouter** is a unified API that provides access to multiple AI models from different providers (OpenAI, Google, Anthropic, Meta, Mistral, etc.) through a single interface. This eliminates the need to manage multiple API keys and provides automatic fallback when models are unavailable or hit quota limits.

## 🏗️ **Architecture Overview**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LiveKit       │    │   OpenRouter     │    │   Multiple      │
│   Voice Agent   │───▶│   Unified API    │───▶│   LLM Providers │
│                 │    │                  │    │                 │
│ • STT (Deepgram)│    │ • Single API Key │    │ • OpenAI        │
│ • TTS (Cartesia)│    │ • Auto Fallback  │    │ • Google        │
│ • Turn Detection│    │ • Rate Limiting  │    │ • Anthropic     │
└─────────────────┘    └──────────────────┘    │ • Meta          │
                                               │ • Mistral       │
                                               └─────────────────┘
```

## 🔧 **Implementation Details**

### **1. OpenRouterLLM Class (Lines 24-148)**

The `OpenRouterLLM` class is a custom implementation that wraps OpenRouter's API and provides LiveKit-compatible methods:

```typescript
class OpenRouterLLM {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private currentModel = 'openai/gpt-4o-mini';
  private fallbackModels = [
    'openai/gpt-4o-mini', // Primary: Fast and cost-effective
    'google/gemini-1.5-flash', // Secondary: Free tier available
    'anthropic/claude-3-haiku-20240307', // Tertiary: High quality
    'meta-llama/llama-3.1-8b-instruct', // Quaternary: Open source
    'mistralai/mistral-7b-instruct', // Quinary: Alternative
  ];
  private currentModelIndex = 0;
}
```

#### **Key Features:**

- **Multi-Model Support**: Access to 5+ different AI models
- **Automatic Fallback**: If one model fails, automatically tries the next
- **LiveKit Compatibility**: Implements `generate()` and `stream()` methods
- **Error Handling**: Comprehensive error handling with retry logic

### **2. Fallback Mechanism (Lines 52-92)**

The fallback system ensures reliability by automatically switching between models:

```typescript
async generate(prompt: string, options: Record<string, unknown> = {}) {
  const maxRetries = this.fallbackModels.length;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const model = this.fallbackModels[this.currentModelIndex];

    try {
      console.log(`🔄 OpenRouter: Trying model ${model} (attempt ${attempt + 1}/${maxRetries})`);
      const response = await this.callOpenRouterAPI(prompt, model!, options);

      if (response.success) {
        console.log(`✅ OpenRouter: Success with model ${model}`);
        return {
          content: response.content,
          usage: response.usage,
          model: response.model
        };
      }
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ OpenRouter: Model ${model} failed:`, error);

      // Move to next model
      this.currentModelIndex = (this.currentModelIndex + 1) % this.fallbackModels.length;
    }
  }

  throw new Error(`All OpenRouter models failed. Last error: ${lastError?.message}`);
}
```

#### **Fallback Flow:**

1. **Try Primary Model**: `openai/gpt-4o-mini`
2. **If Failed**: Try `google/gemini-1.5-flash`
3. **If Failed**: Try `anthropic/claude-3-haiku-20240307`
4. **If Failed**: Try `meta-llama/llama-3.1-8b-instruct`
5. **If Failed**: Try `mistralai/mistral-7b-instruct`
6. **If All Failed**: Throw error with last error message

### **3. API Integration (Lines 100-136)**

The `callOpenRouterAPI` method handles the actual HTTP requests to OpenRouter:

```typescript
private async callOpenRouterAPI(prompt: string, model: string, options: Record<string, unknown>) {
  const response = await fetch(`${this.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'LiveKit Agent',
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 1000,
      stream: false
    })
  });
}
```

#### **Request Headers:**

- **Authorization**: OpenRouter API key
- **HTTP-Referer**: Your app URL (for tracking)
- **X-Title**: Your app name (for tracking)

### **4. OpenRouterAssistant Class (Lines 150-230)**

The `OpenRouterAssistant` extends LiveKit's `voice.Agent` and integrates the OpenRouter LLM:

```typescript
class OpenRouterAssistant extends voice.Agent {
  private openRouterLLM: OpenRouterLLM;

  constructor() {
    super({
      instructions: `You are a helpful voice AI assistant powered by OpenRouter's multi-LLM system...`,
      tools: {
        getWeather: llm.tool({...}),
        getModelInfo: llm.tool({...}),
        switchModel: llm.tool({...}),
      },
    });

    this.openRouterLLM = new OpenRouterLLM({
      fallbackModels: [
        'openai/gpt-4o-mini',
        'google/gemini-1.5-flash',
        'anthropic/claude-3-haiku-20240307',
        'meta-llama/llama-3.1-8b-instruct',
        'mistralai/mistral-7b-instruct'
      ]
    });
  }
}
```

#### **Available Tools:**

1. **`getWeather`**: Look up weather information
2. **`getModelInfo`**: Get current AI model being used
3. **`switchModel`**: Switch to a different AI model

### **5. LiveKit Integration (Lines 247-252)**

The agent uses OpenRouter through LiveKit's OpenAI plugin with custom configuration:

```typescript
const openRouterLLM = new openai.LLM({
  model: 'openai/gpt-4o-mini',
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: 'https://openrouter.ai/api/v1', // OpenRouter endpoint
  temperature: 0.7,
});
```

#### **Key Configuration:**

- **model**: The specific model to use (can be any OpenRouter model)
- **apiKey**: OpenRouter API key (not OpenAI key)
- **baseURL**: OpenRouter's API endpoint
- **temperature**: Response creativity level

## 🚀 **How It Works in Practice**

### **1. Voice Input Processing**

```
User Speech → Deepgram STT → Text → OpenRouter LLM → Response → Cartesia TTS → Agent Speech
```

### **2. Model Selection Process**

```
1. User asks question
2. OpenRouter tries primary model (gpt-4o-mini)
3. If quota exceeded → tries Google Gemini
4. If rate limited → tries Claude
5. If unavailable → tries Llama
6. If all fail → returns error message
```

### **3. Real-time Fallback Example**

```bash
🔄 OpenRouter: Trying model openai/gpt-4o-mini (attempt 1/5)
❌ OpenRouter: Model openai/gpt-4o-mini failed: 429 You exceeded your current quota
🔄 OpenRouter: Switching to next model...
🔄 OpenRouter: Trying model google/gemini-1.5-flash (attempt 2/5)
✅ OpenRouter: Success with model google/gemini-1.5-flash
```

## 📊 **Benefits of OpenRouter Integration**

### **1. Reliability**

- **Automatic Fallback**: Never fails due to single provider issues
- **Quota Management**: Distributes load across multiple providers
- **Rate Limit Handling**: Seamlessly switches when limits hit

### **2. Cost Optimization**

- **Model Comparison**: Choose most cost-effective models
- **Usage Tracking**: Monitor costs across providers
- **Flexible Pricing**: Pay per use with different pricing tiers

### **3. Performance**

- **Speed Optimization**: Use fastest available models
- **Quality Selection**: Choose best model for specific tasks
- **Load Balancing**: Distribute requests across providers

### **4. Simplicity**

- **Single API Key**: One key for all models
- **Unified Interface**: Same API for all providers
- **Easy Configuration**: Simple model switching

## 🔧 **Configuration Options**

### **Environment Variables**

```env
# Required
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_APP_NAME=your-app-name
OPENROUTER_APP_URL=http://localhost:3000

# Optional
OPENROUTER_DEFAULT_MODEL=openai/gpt-4o-mini
OPENROUTER_FALLBACK_MODELS=google/gemini-1.5-flash,anthropic/claude-3-haiku
```

### **Model Configuration**

```typescript
const openRouterLLM = new OpenRouterLLM({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: 'openai/gpt-4o-mini', // Primary model
  fallbackModels: [
    'google/gemini-1.5-flash', // Free tier
    'anthropic/claude-3-haiku', // High quality
    'meta-llama/llama-3.1-8b', // Open source
    'mistralai/mistral-7b', // Alternative
  ],
});
```

## 🎯 **Available Models**

### **OpenAI Models**

- `openai/gpt-4o-mini` - Fast, cost-effective
- `openai/gpt-4o` - High quality, more expensive
- `openai/gpt-3.5-turbo` - Legacy, very fast

### **Google Models**

- `google/gemini-1.5-flash` - Free tier available
- `google/gemini-1.5-pro` - High quality
- `google/gemini-2.0-flash-exp` - Experimental

### **Anthropic Models**

- `anthropic/claude-3-haiku-20240307` - Fast, cost-effective
- `anthropic/claude-3-sonnet-20240229` - Balanced
- `anthropic/claude-3-opus-20240229` - Highest quality

### **Meta Models**

- `meta-llama/llama-3.1-8b-instruct` - Open source
- `meta-llama/llama-3.1-70b-instruct` - Large model

### **Mistral Models**

- `mistralai/mistral-7b-instruct` - Fast, efficient
- `mistralai/mixtral-8x7b-instruct` - Mixture of experts

## 🧪 **Testing the Integration**

### **1. Start the Agent**

```bash
pnpm run dev:openrouter
```

### **2. Test Model Switching**

```
User: "What model are you using?"
Agent: "Currently using AI model: openai/gpt-4o-mini via OpenRouter"

User: "Switch to Google Gemini"
Agent: "Switched to model: google/gemini-1.5-flash"
```

### **3. Test Fallback**

```
# Simulate quota exceeded
User: "Tell me about AI"
Agent: [Tries gpt-4o-mini, fails, switches to Gemini, responds]
```

### **4. Monitor Logs**

```bash
🔄 OpenRouter: Trying model openai/gpt-4o-mini (attempt 1/5)
✅ OpenRouter: Success with model openai/gpt-4o-mini
📊 OpenRouter Usage: {"llmPromptTokens":150,"llmCompletionTokens":50}
```

## 🚨 **Troubleshooting**

### **Common Issues**

#### **1. API Key Issues**

```bash
❌ Missing OpenRouter API key
```

**Solution**: Add `OPENROUTER_API_KEY` to `.env` file

#### **2. Model Unavailable**

```bash
❌ OpenRouter: Model openai/gpt-4o-mini failed: 404 Model not found
```

**Solution**: Check model name or use different model

#### **3. Quota Exceeded**

```bash
❌ OpenRouter: Model openai/gpt-4o-mini failed: 429 You exceeded your current quota
```

**Solution**: OpenRouter will automatically try next model

#### **4. Rate Limiting**

```bash
❌ OpenRouter: Model google/gemini-1.5-flash failed: 429 Rate limit exceeded
```

**Solution**: Wait or use different model

### **Debug Mode**

```typescript
// Enable detailed logging
const openRouterLLM = new OpenRouterLLM({
  debug: true,  // Add this for detailed logs
  fallbackModels: [...]
});
```

## 📈 **Performance Metrics**

### **Response Times**

- **OpenAI GPT-4o-mini**: ~1-2 seconds
- **Google Gemini**: ~1-3 seconds
- **Claude Haiku**: ~2-4 seconds
- **Llama 3.1**: ~3-5 seconds

### **Cost Comparison**

- **OpenAI GPT-4o-mini**: $0.15/1M input tokens
- **Google Gemini**: Free tier available
- **Claude Haiku**: $0.25/1M input tokens
- **Llama 3.1**: $0.20/1M input tokens

## 🎯 **Best Practices**

### **1. Model Selection**

- **Primary**: Use fastest, most reliable model
- **Fallback**: Include free tier models
- **Quality**: Add high-quality models for complex tasks

### **2. Error Handling**

- **Graceful Degradation**: Always have fallback models
- **User Feedback**: Inform users of model switches
- **Monitoring**: Track model performance and costs

### **3. Configuration**

- **Environment Variables**: Use `.env` for configuration
- **Model Rotation**: Regularly update model list
- **Cost Monitoring**: Track usage across providers

---

## 🎉 **Summary**

The OpenRouter integration in `agent2.ts` provides:

✅ **Unified Access** to multiple AI models through one API
✅ **Automatic Fallback** when models fail or hit limits  
✅ **Cost Optimization** by using most efficient models
✅ **Reliability** through multi-provider redundancy
✅ **Easy Configuration** with simple environment variables
✅ **Real-time Switching** between models based on availability
✅ **Comprehensive Logging** for monitoring and debugging

This makes the voice agent highly reliable and cost-effective while providing access to the best AI models available! 🚀

