import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  metrics,
  voice,
} from '@livekit/agents';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: '.env' });

// OpenRouter LLM class for unified multi-provider access
class OpenRouterLLM {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private currentModel = 'openai/gpt-4o-mini'; // Default model
  private fallbackModels = [
    'openai/gpt-4o-mini',
    'google/gemini-1.5-flash',
    'anthropic/claude-3-haiku-20240307',
    'meta-llama/llama-3.1-8b-instruct',
    'mistralai/mistral-7b-instruct'
  ];
  private currentModelIndex = 0;

  constructor(options: { 
    apiKey?: string;
    model?: string;
    fallbackModels?: string[];
  } = {}) {
    this.apiKey = options.apiKey || process.env.OPENROUTER_API_KEY || '';
    if (options.model) this.currentModel = options.model;
    if (options.fallbackModels) this.fallbackModels = options.fallbackModels;
    
    if (!this.apiKey) {
      throw new Error('OpenRouter API key is required. Set OPENROUTER_API_KEY in your .env file');
    }
  }

  // Implement the LLM interface that LiveKit expects
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
          // Return in the format LiveKit expects
          return {
            content: response.content,
            usage: response.usage,
            model: response.model
          };
        } else {
          throw new Error('Unknown error');
        }
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ OpenRouter: Model ${model} failed:`, error);
        
        // Move to next model
        this.currentModelIndex = (this.currentModelIndex + 1) % this.fallbackModels.length;
        
        // If this was the last attempt, don't continue
        if (attempt === maxRetries - 1) {
          break;
        }
        
        console.log(`🔄 OpenRouter: Switching to next model...`);
      }
    }

    throw new Error(`All OpenRouter models failed. Last error: ${lastError?.message}`);
  }

  // Add the stream method that LiveKit expects
  async *stream(prompt: string, options: Record<string, unknown> = {}) {
    const response = await this.generate(prompt, options);
    yield response;
  }

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
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1000,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      content: data.choices?.[0]?.message?.content || '',
      model: model,
      usage: data.usage
    };
  }

  // Event emitter compatibility
  on(): this {
    // Simple event emitter for compatibility
    return this;
  }

  emit(): this {
    // Simple event emitter for compatibility
    return this;
  }
}

class OpenRouterAssistant extends voice.Agent {
  private openRouterLLM: OpenRouterLLM;

  constructor() {
    super({
      instructions: `You are a helpful voice AI assistant powered by OpenRouter's multi-LLM system.
      You have access to multiple AI models through a unified API with automatic fallbacks.
      You eagerly assist users with their questions by providing information from your extensive knowledge.
      Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asteriks, or other symbols.
      You are curious, friendly, and have a sense of humor.
      
      Always respond to user input. If you don't understand something, ask for clarification.`,
      tools: {
        getWeather: llm.tool({
          description: `Use this tool to look up current weather information in the given location.

          If the location is not supported by the weather service, the tool will indicate this. You must tell the user the location's weather is unavailable.`,
          parameters: z.object({
            location: z
              .string()
              .describe('The location to look up weather information for (e.g. city name)'),
          }),
          execute: async ({ location }) => {
            console.log(`Looking up weather for ${location}`);

            return 'sunny with a temperature of 70 degrees.';
          },
        }),

        getModelInfo: llm.tool({
          description: 'Get information about the current AI model being used',
          parameters: z.object({}),
          execute: async () => {
            const currentModel = this.openRouterLLM['fallbackModels'][this.openRouterLLM['currentModelIndex']];
            return `Currently using AI model: ${currentModel} via OpenRouter`;
          },
        }),

        switchModel: llm.tool({
          description: 'Switch to a different AI model',
          parameters: z.object({
            model: z.string().describe('The model to switch to (e.g., openai/gpt-4o-mini)'),
          }),
          execute: async ({ model }) => {
            const fallbackModels = this.openRouterLLM['fallbackModels'];
            const modelIndex = fallbackModels.indexOf(model);
            
            if (modelIndex === -1) {
              return `Model ${model} not available. Available models: ${fallbackModels.join(', ')}`;
            }
            
            this.openRouterLLM['currentModelIndex'] = modelIndex;
            return `Switched to model: ${model}`;
          },
        }),
      },
    });

    // Initialize OpenRouter LLM after super() call
    this.openRouterLLM = new OpenRouterLLM({
      fallbackModels: [
        'openai/gpt-4o-mini',           // Primary: Fast and cost-effective
        'google/gemini-1.5-flash',      // Secondary: Free tier available
        'anthropic/claude-3-haiku-20240307', // Tertiary: High quality
        'meta-llama/llama-3.1-8b-instruct',  // Quaternary: Open source
        'mistralai/mistral-7b-instruct'      // Quinary: Alternative
      ]
    });
  }

  // Override the LLM generation to use OpenRouter
  async generateResponse(prompt: string, options: Record<string, unknown> = {}) {
    try {
      const result = await this.openRouterLLM.generate(prompt, options);
      return result.content;
    } catch (error) {
      console.error('OpenRouter generation failed:', error);
      return 'I apologize, but I\'m experiencing technical difficulties. Please try again.';
    }
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    console.log('Loading VAD model...');
    proc.userData.vad = await silero.VAD.load();
    console.log('VAD model loaded successfully');
  },
  
  entry: async (ctx: JobContext) => {
    console.log('🚀 OpenRouter Agent entry started');
    
    // Create assistant instance
    const assistant = new OpenRouterAssistant();
    console.log('✅ OpenRouter Assistant created');

    // Use OpenAI LLM with OpenRouter as the API endpoint
    const openRouterLLM = new openai.LLM({
      model: 'openai/gpt-4o-mini',
      apiKey: process.env.OPENROUTER_API_KEY!,
      baseURL: 'https://openrouter.ai/api/v1',
      temperature: 0.7
    });

    // Set up a voice AI pipeline using OpenRouter, Cartesia, Deepgram, and the LiveKit turn detector
    const session = new voice.AgentSession({
      // Using OpenRouter for unified multi-LLM access
      llm: openRouterLLM,
      // Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
      stt: new deepgram.STT({ model: 'nova-3' }),
      // Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
      tts: new cartesia.TTS({
        voice: '794f9389-aac1-45b6-b726-9d9369183238',
        speed: 1.0, // Speech speed (0.5 to 2.0)
      }),
      // VAD and turn detection are used to determine when the user is speaking and when the agent should respond
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad! as silero.VAD,
    });

    // Metrics collection, to measure pipeline performance
    const usageCollector = new metrics.UsageCollector();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      metrics.logMetrics(ev.metrics);
      usageCollector.collect(ev.metrics);
    });

    const logUsage = async () => {
      const summary = usageCollector.getSummary();
      console.log(`📊 OpenRouter Usage: ${JSON.stringify(summary)}`);
    };

    ctx.addShutdownCallback(logUsage);

    // Add event listeners for debugging
    // Note: These event types may not be available in current version
    // session.on(voice.AgentSessionEventTypes.UserStartedSpeaking, () => {
    //   console.log('🎤 User started speaking');
    // });

    // session.on(voice.AgentSessionEventTypes.UserStoppedSpeaking, () => {
    //   console.log('🔇 User stopped speaking');
    // });

    // session.on(voice.AgentSessionEventTypes.AgentStartedSpeaking, () => {
    //   console.log('🤖 Agent started speaking');
    // });

    // session.on(voice.AgentSessionEventTypes.AgentStoppedSpeaking, () => {
    //   console.log('🔇 Agent stopped speaking');
    // });

    // Start the session, which initializes the voice pipeline and warms up the models
    console.log('🔧 Starting OpenRouter voice session...');
    await session.start({
      agent: assistant,
      room: ctx.room,
      inputOptions: {
        // LiveKit Cloud enhanced noise cancellation
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });
    console.log('✅ OpenRouter voice session started successfully');

    // Join the room and connect to the user
    console.log('🔧 Connecting to room...');
    await ctx.connect();
    console.log('✅ Connected to room successfully');
  },
});

// Ensure required environment variables are present
if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.LIVEKIT_URL) {
  console.error('❌ Missing required environment variables:');
  console.error('   - LIVEKIT_API_KEY');
  console.error('   - LIVEKIT_API_SECRET');
  console.error('   - LIVEKIT_URL');
  console.error('');
  console.error('📋 To fix this:');
  console.error('1. Create a .env file in the backend directory');
  console.error('2. Add your LiveKit credentials:');
  console.error('   LIVEKIT_API_KEY=your-api-key');
  console.error('   LIVEKIT_API_SECRET=your-api-secret');
  console.error('   LIVEKIT_URL=wss://your-livekit-url.livekit.cloud');
  console.error('');
  console.error('3. Add OpenRouter API key:');
  console.error('   OPENROUTER_API_KEY=your-openrouter-api-key');
  console.error('   OPENROUTER_APP_NAME=your-app-name');
  console.error('   OPENROUTER_APP_URL=http://localhost:3000');
  console.error('');
  console.error('4. Add other required API keys:');
  console.error('   DEEPGRAM_API_KEY=your-deepgram-key');
  console.error('   CARTESIA_API_KEY=your-cartesia-key');
  process.exit(1);
}

if (!process.env.OPENROUTER_API_KEY) {
  console.error('❌ Missing OpenRouter API key:');
  console.error('   - OPENROUTER_API_KEY');
  console.error('');
  console.error('📋 To fix this:');
  console.error('1. Sign up at https://openrouter.ai');
  console.error('2. Get your API key from the dashboard');
  console.error('3. Add to your .env file:');
  console.error('   OPENROUTER_API_KEY=your-openrouter-api-key');
  console.error('   OPENROUTER_APP_NAME=your-app-name');
  console.error('   OPENROUTER_APP_URL=http://localhost:3000');
  process.exit(1);
}

// Initialize worker with minimal configuration
try {
  console.log('🔧 Initializing OpenRouter LiveKit agent worker...');
  console.log('API Key:', process.env.LIVEKIT_API_KEY ? 'SET' : 'NOT SET');
  console.log('API Secret:', process.env.LIVEKIT_API_SECRET ? 'SET' : 'NOT SET');
  console.log('LiveKit URL:', process.env.LIVEKIT_URL ? 'SET' : 'NOT SET');
  console.log('OpenRouter API Key:', process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET');
  console.log('Deepgram API Key:', process.env.DEEPGRAM_API_KEY ? 'SET' : 'NOT SET');
  console.log('Cartesia API Key:', process.env.CARTESIA_API_KEY ? 'SET' : 'NOT SET');
  
  const workerOptions = new WorkerOptions({ 
    agent: fileURLToPath(import.meta.url),
    apiKey: process.env.LIVEKIT_API_KEY!,
    apiSecret: process.env.LIVEKIT_API_SECRET!,
  });
  
  console.log('✅ Worker options created, starting OpenRouter worker...');
  cli.runApp(workerOptions);
} catch (error) {
  console.error('❌ Failed to start OpenRouter LiveKit agent worker:', error);
  console.error('Error details:', error);
  console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
  process.exit(1);
}
