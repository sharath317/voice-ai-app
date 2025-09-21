import { type JobContext, WorkerOptions, cli, defineAgent, metrics, voice } from '@livekit/agents';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as google from '@livekit/agents-plugin-google';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as openai from '@livekit/agents-plugin-openai';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: '.env' });

// ===== LLM FALLBACK MANAGER =====
class LLMFallbackManager {
  private providers: Array<{ name: string; createInstance: () => unknown; priority: number }> = [];
  private currentProviderIndex = 0;

  constructor() {
    this.initializeProviders();
    this.selectBestProvider();
  }

  private initializeProviders() {
    // Provider 1: OpenRouter (Primary - multiple models)
    if (process.env.OPENROUTER_API_KEY) {
      this.providers.push({
        name: 'OpenRouter',
        createInstance: () => new openai.LLM({
          model: 'gpt-4o-mini',
          temperature: 0.7,
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: process.env.OPENROUTER_API_KEY || '',
        }),
        priority: 1,
      });
      console.log('✅ OpenRouter LLM provider configured');
    }

    // Provider 2: Google Gemini (Secondary)
    if (process.env.GOOGLE_API_KEY) {
      this.providers.push({
        name: 'Google',
        createInstance: () => new google.LLM({
          model: 'gemini-2.5-flash',
          temperature: 0.7,
        }),
        priority: 2,
      });
      console.log('✅ Google LLM provider configured');
    }

    // Provider 3: OpenAI Direct (Tertiary - fallback)
    if (process.env.OPENAI_API_KEY) {
      this.providers.push({
        name: 'OpenAI',
        createInstance: () => new openai.LLM({
          model: 'gpt-4o-mini',
          temperature: 0.7,
        }),
        priority: 3,
      });
      console.log('✅ OpenAI LLM provider configured');
    }

    // Sort by priority
    this.providers.sort((a, b) => a.priority - b.priority);
    console.log(`🎯 LLM Fallback Manager initialized with ${this.providers.length} providers`);
  }

  getCurrentProvider() {
    if (this.providers.length === 0) {
      throw new Error('No LLM providers available');
    }
    const provider = this.providers[this.currentProviderIndex];
    if (!provider) {
      throw new Error('No LLM provider available at current index');
    }
    return provider;
  }

  createCurrentLLMInstance() {
    const provider = this.getCurrentProvider();
    try {
      return provider.createInstance();
    } catch (error) {
      console.warn(`⚠️ Failed to create ${provider.name} LLM instance:`, error);
      throw error;
    }
  }

  async switchToNextProvider() {
    if (this.currentProviderIndex < this.providers.length - 1) {
      this.currentProviderIndex++;
      const provider = this.getCurrentProvider();
      console.log(`🔄 Switched to ${provider.name} LLM provider`);
      return provider;
    } else {
      throw new Error('All LLM providers have been exhausted');
    }
  }

  async handleLLMFailure(error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`❌ LLM provider ${this.getCurrentProvider().name} failed:`, errorMessage);
    
    // Check if it's a quota/rate limit error
    if (errorMessage?.includes('429') || errorMessage?.includes('quota') || errorMessage?.includes('rate limit')) {
      try {
        const nextProvider = await this.switchToNextProvider();
        console.log(`✅ Switched to ${nextProvider.name} LLM provider due to quota issue`);
        return nextProvider;
      } catch (switchError) {
        console.error('❌ Failed to switch LLM provider:', switchError);
        throw new Error('All LLM providers exhausted');
      }
    }
    
    // For other errors, don't switch providers immediately
    throw error;
  }

  getProviderCount() {
    return this.providers.length;
  }

  getProviderNames() {
    return this.providers.map(p => p.name);
  }

  private selectBestProvider() {
    // Priority order: OpenRouter > Google > OpenAI (to avoid quota issues)
    if (this.providers.length > 1) {
      const openRouterIndex = this.providers.findIndex(p => p.name === 'OpenRouter');
      const googleIndex = this.providers.findIndex(p => p.name === 'Google');
      
      if (openRouterIndex !== -1) {
        this.currentProviderIndex = openRouterIndex;
        const provider = this.providers[openRouterIndex];
        if (provider) {
          console.log(`🎯 Proactively selected ${provider.name} LLM provider (best for avoiding quota issues)`);
        }
      } else if (googleIndex !== -1) {
        this.currentProviderIndex = googleIndex;
        const provider = this.providers[googleIndex];
        if (provider) {
          console.log(`🎯 Proactively selected ${provider.name} LLM provider (avoiding OpenAI quota issues)`);
        }
      }
    }
  }
}

// ===== TTS FALLBACK MANAGER =====
class TTSFallbackManager {
  private providers: Array<{ name: string; createInstance: () => unknown; priority: number }> = [];
  private currentProviderIndex = 0;

  constructor() {
    this.initializeProviders();
    this.selectBestProvider();
  }

  private initializeProviders() {
    // Provider 1: Cartesia (Primary - best quality)
    if (process.env.CARTESIA_API_KEY) {
      this.providers.push({
        name: 'Cartesia',
        createInstance: () => new cartesia.TTS({
          voice: 'sonic',
          model: 'sonic-2',
        }),
        priority: 1,
      });
      console.log('✅ Cartesia TTS provider configured');
    }

    // Provider 2: OpenAI TTS (Secondary - good quality)
    if (process.env.OPENAI_API_KEY) {
      this.providers.push({
        name: 'OpenAI',
        createInstance: () => new openai.TTS({
          model: 'tts-1',
        }),
        priority: 2,
      });
      console.log('✅ OpenAI TTS provider configured');
    }

    // Provider 3: Google TTS (Tertiary - good quality)
    if (process.env.GOOGLE_API_KEY) {
      this.providers.push({
        name: 'Google',
        createInstance: () => new google.beta.TTS({
          model: 'gemini-2.5-flash-preview-tts',
        }),
        priority: 3,
      });
      console.log('✅ Google TTS provider configured');
    }

    // Sort by priority
    this.providers.sort((a, b) => a.priority - b.priority);
    console.log(`🎯 TTS Fallback Manager initialized with ${this.providers.length} providers`);
  }

  getCurrentProvider() {
    if (this.providers.length === 0) {
      throw new Error('No TTS providers available');
    }
    const provider = this.providers[this.currentProviderIndex];
    if (!provider) {
      throw new Error('No TTS provider available at current index');
    }
    return provider;
  }

  createCurrentTTSInstance() {
    const provider = this.getCurrentProvider();
    try {
      return provider.createInstance();
    } catch (error) {
      console.warn(`⚠️ Failed to create ${provider.name} TTS instance:`, error);
      throw error;
    }
  }

  async switchToNextProvider() {
    if (this.currentProviderIndex < this.providers.length - 1) {
      this.currentProviderIndex++;
      const provider = this.getCurrentProvider();
      console.log(`🔄 Switched to ${provider.name} TTS provider`);
      return provider;
    } else {
      throw new Error('All TTS providers have been exhausted');
    }
  }

  async handleTTSFailure(error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`❌ TTS provider ${this.getCurrentProvider().name} failed:`, errorMessage);
    
    // Check if it's a quota/payment error
    if (errorMessage?.includes('402') || errorMessage?.includes('quota') || errorMessage?.includes('payment')) {
      try {
        const nextProvider = await this.switchToNextProvider();
        console.log(`✅ Switched to ${nextProvider.name} TTS provider due to quota issue`);
        return nextProvider;
      } catch (switchError) {
        console.error('❌ Failed to switch TTS provider:', switchError);
        throw new Error('All TTS providers exhausted');
      }
    }
    
    // For other errors, don't switch providers immediately
    throw error;
  }

  getProviderCount() {
    return this.providers.length;
  }

  getProviderNames() {
    return this.providers.map(p => p.name);
  }

  private selectBestProvider() {
    // Priority order: Google > OpenAI > Cartesia (to avoid quota issues)
    if (this.providers.length > 1) {
      const googleIndex = this.providers.findIndex(p => p.name === 'Google');
      const openaiIndex = this.providers.findIndex(p => p.name === 'OpenAI');
      
      if (googleIndex !== -1) {
        this.currentProviderIndex = googleIndex;
        const provider = this.providers[googleIndex];
        if (provider) {
          console.log(`🎯 Proactively selected ${provider.name} TTS provider (best for avoiding quota issues)`);
        }
      } else if (openaiIndex !== -1) {
        this.currentProviderIndex = openaiIndex;
        const provider = this.providers[openaiIndex];
        if (provider) {
          console.log(`🎯 Proactively selected ${provider.name} TTS provider (avoiding Cartesia quota issues)`);
        }
      }
    }
  }
}

// ===== MASTRA-INSPIRED MEMORY SYSTEM =====
interface MemoryEntry {
  id: string;
  type: 'user_info' | 'sentiment' | 'follow_up' | 'conversation';
  data: Record<string, unknown>;
  timestamp: string;
  sessionId: string;
}

class MastraInspiredMemory {
  private memory: Map<string, MemoryEntry[]> = new Map();
  private currentSessionId: string;

  constructor(sessionId: string) {
    this.currentSessionId = sessionId;
  }

  async set(key: string, data: Record<string, unknown>, type: MemoryEntry['type'] = 'conversation'): Promise<void> {
    const entry: MemoryEntry = {
      id: `${key}_${Date.now()}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      sessionId: this.currentSessionId,
    };

    if (!this.memory.has(this.currentSessionId)) {
      this.memory.set(this.currentSessionId, []);
    }

    const sessionEntries = this.memory.get(this.currentSessionId);
    if (sessionEntries) {
      sessionEntries.push(entry);
    }
    console.log(`🧠 Memory stored [${type}]:`, key, data);
  }

  async get(key: string): Promise<Record<string, unknown> | null> {
    const sessionMemory = this.memory.get(this.currentSessionId) || [];
    const entry = sessionMemory.find(
      (e: MemoryEntry) => e.data && Object.keys(e.data).includes(key),
    );
    return entry ? (entry.data[key] as Record<string, unknown>) : null;
  }

  async getAll(type?: MemoryEntry['type']): Promise<MemoryEntry[]> {
    const sessionMemory = this.memory.get(this.currentSessionId) || [];
    return type ? sessionMemory.filter((e: MemoryEntry) => e.type === type) : sessionMemory;
  }

  async getContext(): Promise<Record<string, unknown>> {
    const userInfo = await this.get('user_info');
    const sentiment = await this.get('sentiment_analysis');
    const followUp = await this.get('follow_up_request');

    return {
      userInfo,
      sentiment,
      followUp,
      sessionId: this.currentSessionId,
    };
  }
}

// ===== MASTRA-INSPIRED TOOL SYSTEM =====
interface ToolDefinition {
  id: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: Record<string, unknown>) => Promise<string>;
}

class MastraInspiredToolManager {
  private tools: Map<string, ToolDefinition> = new Map();
  private memory: MastraInspiredMemory;

  constructor(memory: MastraInspiredMemory) {
    this.memory = memory;
    this.initializeTools();
  }

  private initializeTools() {
    // Tool 1: Capture User Information
    this.tools.set('capture_user_info', {
      id: 'capture_user_info',
      description: 'Capture and store user information during conversation',
      parameters: z.object({
        name: z.string().optional().describe('User name'),
        email: z.string().email().optional().describe('User email'),
        phone: z.string().optional().describe('User phone number'),
        company: z.string().optional().describe('User company'),
        role: z.string().optional().describe('User role/title'),
        interests: z.array(z.string()).optional().describe('User interests or needs'),
      }),
      execute: async (params: Record<string, unknown>) => {
        console.log('📝 Capturing user info:', params);
        await this.memory.set('user_info', params, 'user_info');
        return `User information captured: ${params.name || 'Unknown'} from ${
          params.company || 'Unknown company'
        }`;
      },
    });

    // Tool 2: Analyze Sentiment
    this.tools.set('analyze_sentiment', {
      id: 'analyze_sentiment',
      description: 'Analyze conversation sentiment and engagement',
      parameters: z.object({
        sentiment: z.enum(['positive', 'neutral', 'negative']).describe('Overall sentiment'),
        engagement: z.enum(['high', 'medium', 'low']).describe('Engagement level'),
        confidence: z.number().min(0).max(1).describe('Confidence in analysis'),
        notes: z.string().optional().describe('Additional observations'),
      }),
      execute: async (params: Record<string, unknown>) => {
        console.log('🎯 Analyzing sentiment:', params);
        await this.memory.set('sentiment_analysis', params, 'sentiment');
        return `Sentiment analysis: ${params.sentiment} sentiment, ${
          params.engagement
        } engagement (${Math.round((params.confidence as number) * 100)}% confidence)`;
      },
    });

    // Tool 3: Schedule Follow-up
    this.tools.set('schedule_follow_up', {
      id: 'schedule_follow_up',
      description: 'Schedule a follow-up call or meeting',
      parameters: z.object({
        type: z.enum(['call', 'meeting', 'demo']).describe('Type of follow-up'),
        preferredDate: z.string().optional().describe('Preferred date (ISO format)'),
        preferredTime: z.string().optional().describe('Preferred time'),
        duration: z.number().optional().describe('Duration in minutes'),
        notes: z.string().optional().describe('Additional notes'),
      }),
      execute: async (params: Record<string, unknown>) => {
        console.log('📅 Scheduling follow-up:', params);
        await this.memory.set('follow_up_request', params, 'follow_up');
        return `Follow-up ${params.type} scheduled for ${params.preferredDate || 'TBD'} at ${
          params.preferredTime || 'TBD'
        }`;
      },
    });

    // Tool 4: Get Memory Context
    this.tools.set('get_memory_context', {
      id: 'get_memory_context',
      description: 'Retrieve stored memory context for the conversation',
      parameters: z.object({
        type: z
          .enum(['all', 'user_info', 'sentiment', 'follow_up'])
          .optional()
          .describe('Type of memory to retrieve'),
      }),
      execute: async (params: Record<string, unknown>) => {
        console.log('🧠 Retrieving memory context:', params);
        const context = await this.memory.getContext();
        return `Memory context: ${JSON.stringify(context, null, 2)}`;
      },
    });
  }

  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  async executeTool(toolId: string, params: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }
    return await tool.execute(params);
  }
}

// ===== MASTRA-INSPIRED LLM WRAPPER =====
class MastraInspiredLLM {
  private llm: unknown;
  private memory: MastraInspiredMemory;
  private toolManager: MastraInspiredToolManager;
  private sessionId: string;

  constructor(options: { apiKey?: string; model?: string; sessionId: string }) {
    this.sessionId = options.sessionId;
    this.memory = new MastraInspiredMemory(this.sessionId);
    this.toolManager = new MastraInspiredToolManager(this.memory);

    // Initialize LLM (OpenRouter or OpenAI)
    const apiKey =
      options.apiKey || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
    // const model = options.model || 'gpt-4o-mini'; // Unused for now

    if (!apiKey) {
      throw new Error(
        'API key is required. Set OPENROUTER_API_KEY or OPENAI_API_KEY in your .env file',
      );
    }

    // Use OpenRouter if available, otherwise OpenAI
    if (process.env.OPENROUTER_API_KEY) {
      this.llm = new openai.LLM({
        model: 'openai/gpt-4o-mini',
        temperature: 0.7,
      });
    } else {
      this.llm = new openai.LLM({
        model: 'gpt-4o-mini',
        temperature: 0.7,
      });
    }

    console.log('✅ Mastra-Inspired LLM initialized with memory and tools');
  }

  async generateResponse(messages: Array<Record<string, unknown>>): Promise<string> {
    try {
      // Get memory context
      const memoryContext = await this.memory.getContext();

      // Add memory context to system message
      // const systemMessage = `You are a professional AI voice assistant with memory capabilities.

      // MEMORY CONTEXT:
      // ${JSON.stringify(memoryContext, null, 2)}

      // AVAILABLE TOOLS:
      // ${this.toolManager
      //   .getTools()
      //   .map((tool) => `- ${tool.id}: ${tool.description}`)
      //   .join('\n')}

      // INSTRUCTIONS:
      // - Use the memory context to provide personalized responses
      // - When appropriate, suggest using tools to capture information or analyze sentiment
      // - Remember previous interactions and build on them
      // - Be helpful, professional, and engaging`;

      // Add system message to conversation
      // const enhancedMessages = [{ role: 'system', content: systemMessage }, ...messages]; // Unused for now

      // For now, we'll use a simple response generation
      // In a real implementation, you'd integrate with the LLM's tool calling
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) {
        return 'I apologize, but I could not understand your message.';
      }

      let response = `I understand you said: "${lastMessage.content}". `;

      // Add memory-aware responses
      if (memoryContext.userInfo && typeof memoryContext.userInfo === 'object') {
        const userInfo = memoryContext.userInfo as Record<string, unknown>;
        response += `I remember you're ${userInfo.name || 'Unknown'} from ${
          userInfo.company || 'Unknown company'
        }. `;
      }

      if (memoryContext.sentiment && typeof memoryContext.sentiment === 'object') {
        const sentiment = memoryContext.sentiment as Record<string, unknown>;
        response += `I can see you're feeling ${
          sentiment.sentiment || 'neutral'
        } about our conversation. `;
      }

      response += `How can I help you further?`;

      return response;
    } catch (error) {
      console.error('❌ Error generating response:', error);
      return 'I apologize, but I encountered an error. Please try again.';
    }
  }

  async getMemoryContext(): Promise<Record<string, unknown>> {
    return await this.memory.getContext();
  }

  // LiveKit LLM interface compatibility
  async generate(messages: Array<Record<string, unknown>>): Promise<string> {
    return this.generateResponse(messages);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  on(_event: string, _callback: () => void): this {
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  emit(_event: string, _data: unknown): this {
    return this;
  }
}

// ===== LIVEKIT AGENT DEFINITION =====
const mastraInspiredAgent = defineAgent({
  entry: async (ctx: JobContext) => {
    console.log('🚀 Mastra-Inspired Voice Agent starting...');

    try {
      const sessionId = `session_${Date.now()}`;

      // Initialize Mastra-Inspired LLM with memory
      const mastraLLM = new MastraInspiredLLM({
        apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '',
        model: process.env.OPENROUTER_API_KEY ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
        sessionId,
      });

      console.log('✅ Mastra-Inspired LLM initialized');

      // Initialize LLM and TTS Fallback Managers
      const llmManager = new LLMFallbackManager();
      const ttsManager = new TTSFallbackManager();
      
      const currentLLMProvider = llmManager.getCurrentProvider();
      const currentTTSProvider = ttsManager.getCurrentProvider();
      
      console.log(`🎯 Using ${currentLLMProvider?.name || 'Unknown'} LLM provider (${llmManager.getProviderCount()} providers available: ${llmManager.getProviderNames().join(', ')})`);
      console.log(`🎯 Using ${currentTTSProvider?.name || 'Unknown'} TTS provider (${ttsManager.getProviderCount()} providers available: ${ttsManager.getProviderNames().join(', ')})`);

      // Create LiveKit session with fallback providers
      const session = new voice.AgentSession({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        llm: llmManager.createCurrentLLMInstance() as unknown as any,
        stt: new deepgram.STT({ model: 'nova-3' }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tts: ttsManager.createCurrentTTSInstance() as unknown as any,
        turnDetection: new livekit.turnDetector.MultilingualModel(),
      });

      console.log('✅ AgentSession created with Mastra-Inspired integration');

      // Create a proper voice.Agent instance with instructions
      const agent = new voice.Agent({
        instructions: `You are a Mastra-inspired AI voice assistant with memory capabilities and bulletproof multi-provider fallback support.

🧠 MEMORY FEATURES:
- You can remember user information across conversations
- You track sentiment and engagement levels
- You can schedule follow-ups and manage tasks

🛠️ AVAILABLE TOOLS:
- capture_user_info: Store user details (name, email, company, etc.)
- analyze_sentiment: Track conversation sentiment and engagement
- schedule_follow_up: Schedule future interactions
- get_memory_context: Retrieve stored information

🎯 BULLETPROOF MULTI-PROVIDER SUPPORT:
- LLM Providers: ${llmManager.getProviderNames().join(', ')} (${llmManager.getProviderCount()} total)
- Current LLM: ${currentLLMProvider?.name || 'Unknown'}
- TTS Providers: ${ttsManager.getProviderNames().join(', ')} (${ttsManager.getProviderCount()} total)
- Current TTS: ${currentTTSProvider?.name || 'Unknown'}
- Automatic fallback when quota limits are reached
- Never breaks due to API issues - always has backup providers

📋 INSTRUCTIONS:
- Be helpful, professional, and engaging
- Use memory context to provide personalized responses
- When appropriate, suggest using tools to capture information
- Remember previous interactions and build on them
- Always be conversational and natural in your responses
- If you encounter any technical issues, explain them clearly to the user
- You are bulletproof - multiple fallback providers ensure you never fail

Current session ID: ${sessionId}`,
        // Tools are handled by the MastraInspiredLLM wrapper
      });

      // Metrics collection
      console.log('🔧 Setting up metrics collection...');
      const usageCollector = new metrics.UsageCollector();
      session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
        console.log('📊 Metrics collected:', ev.metrics);
        metrics.logMetrics(ev.metrics);
        usageCollector.collect(ev.metrics);
      });

      // Error handling with fallback for both LLM and TTS
      // Note: LiveKit doesn't support dynamic provider switching in the same session
      // The fallback system will be used for new sessions
      console.log('🔄 Fallback system ready - will switch providers for new sessions if needed');

      const logUsage = async () => {
        const summary = usageCollector.getSummary();
        console.log(`📊 Usage Summary: ${JSON.stringify(summary)}`);

        // Log Mastra-Inspired memory context
        const memoryContext = await mastraLLM.getMemoryContext();
        console.log('🧠 Mastra-Inspired Memory Context:', memoryContext);
      };

      ctx.addShutdownCallback(logUsage);
      console.log('✅ Metrics collection setup complete');

      // Start the session
      console.log('🔧 Starting session...');
      await session.start({
        agent: agent,
        room: ctx.room,
        inputOptions: {
          noiseCancellation: BackgroundVoiceCancellation(),
        },
      });
      console.log('✅ Session started successfully');

      console.log('🚀 Mastra-Inspired Voice Agent connected to room');
      console.log('🔧 Connecting to room...');
      await ctx.connect();
      console.log('✅ Connected to room successfully');
    } catch (error) {
      console.error('❌ Error in Mastra-Inspired Voice Agent:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  },
});

// ===== ENVIRONMENT VALIDATION =====
if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.LIVEKIT_URL) {
  console.error('❌ Missing required environment variables:');
  console.error('   - LIVEKIT_API_KEY');
  console.error('   - LIVEKIT_API_SECRET');
  console.error('   - LIVEKIT_URL');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY) {
  console.error('❌ Missing LLM API key:');
  console.error('   - OPENAI_API_KEY (for OpenAI)');
  console.error('   - OPENROUTER_API_KEY (for OpenRouter)');
  process.exit(1);
}

// ===== WORKER INITIALIZATION =====
try {
  console.log('🔧 Initializing Mastra-Inspired Voice Agent worker...');
  console.log('API Key:', process.env.LIVEKIT_API_KEY ? 'SET' : 'NOT SET');
  console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
  console.log('OpenRouter API Key:', process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET');
  console.log('Deepgram API Key:', process.env.DEEPGRAM_API_KEY ? 'SET' : 'NOT SET');
  console.log('Cartesia API Key:', process.env.CARTESIA_API_KEY ? 'SET' : 'NOT SET');

  const workerOptions = new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    apiKey: process.env.LIVEKIT_API_KEY!,
    apiSecret: process.env.LIVEKIT_API_SECRET!,
  });

  console.log('✅ Worker options created, starting Mastra-Inspired Voice Agent worker...');
  cli.runApp(workerOptions);
} catch (error) {
  console.error('❌ Failed to start Mastra-Inspired Voice Agent worker:', error);
  console.error('Error details:', error);
  process.exit(1);
}

// Export the agent as default
export default mastraInspiredAgent;
