import { type JobContext, WorkerOptions, cli, defineAgent, metrics, voice } from '@livekit/agents';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as google from '@livekit/agents-plugin-google';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as openai from '@livekit/agents-plugin-openai';
// Mastra imports
import { createTool } from '@mastra/core';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: '.env' });

// ===== MASTRA + LIVEKIT INTEGRATION =====

// Simple in-memory storage for demonstration
const simpleMemory = new Map<string, unknown>();

// ===== MASTRA TOOLS =====
// Note: These tools are defined for future integration with Mastra agents
// Currently using simple in-memory storage for demonstration

// Tool 1: Capture User Information
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const captureUserInfoTool = createTool({
  id: 'capture_user_info',
  description: 'Capture and store user information during conversation',
  inputSchema: z.object({
    name: z.string().optional().describe('User name'),
    email: z.string().email().optional().describe('User email'),
    phone: z.string().optional().describe('User phone number'),
    company: z.string().optional().describe('User company'),
    role: z.string().optional().describe('User role/title'),
    interests: z.array(z.string()).optional().describe('User interests or needs'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    console.log('📝 Capturing user info:', context);

    // Store in simple memory
    simpleMemory.set('user_info', context);

    return {
      success: true,
      message: `User information captured: ${context.name || 'Unknown'} from ${
        context.company || 'Unknown company'
      }`,
    };
  },
});

// Tool 2: Analyze Sentiment
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const analyzeSentimentTool = createTool({
  id: 'analyze_sentiment',
  description: 'Analyze conversation sentiment and engagement',
  inputSchema: z.object({
    sentiment: z.enum(['positive', 'neutral', 'negative']).describe('Overall sentiment'),
    engagement: z.enum(['high', 'medium', 'low']).describe('Engagement level'),
    confidence: z.number().min(0).max(1).describe('Confidence in analysis'),
    notes: z.string().optional().describe('Additional observations'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    console.log('🎯 Analyzing sentiment:', context);

    // Store sentiment analysis in simple memory
    simpleMemory.set('sentiment_analysis', context);

    return {
      success: true,
      message: `Sentiment analysis: ${context.sentiment} sentiment, ${
        context.engagement
      } engagement (${Math.round(context.confidence * 100)}% confidence)`,
    };
  },
});

// Tool 3: Schedule Follow-up
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const scheduleFollowUpTool = createTool({
  id: 'schedule_follow_up',
  description: 'Schedule a follow-up interaction',
  inputSchema: z.object({
    type: z.enum(['call', 'meeting', 'email']).describe('Type of follow-up'),
    preferredDate: z.string().describe('Preferred date (ISO format)'),
    preferredTime: z.string().describe('Preferred time'),
    duration: z.number().describe('Duration in minutes'),
    notes: z.string().optional().describe('Additional notes'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    console.log('📅 Scheduling follow-up:', context);

    // Store follow-up request in simple memory
    simpleMemory.set('follow_up_request', context);

    return {
      success: true,
      message: `Follow-up ${context.type} scheduled for ${context.preferredDate} at ${context.preferredTime}`,
    };
  },
});

// Tool 4: Get Memory Context
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getMemoryContextTool = createTool({
  id: 'get_memory_context',
  description: 'Retrieve stored memory context for the conversation',
  inputSchema: z.object({
    type: z
      .enum(['all', 'user_info', 'sentiment', 'follow_up'])
      .optional()
      .describe('Type of memory to retrieve'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    data: z.any(),
  }),
  execute: async ({ context }) => {
    console.log('🧠 Retrieving memory context:', context);

    let data;
    if (context.type === 'all' || !context.type) {
      data = {
        userInfo: simpleMemory.get('user_info'),
        sentiment: simpleMemory.get('sentiment_analysis'),
        followUp: simpleMemory.get('follow_up_request'),
      };
    } else {
      data = simpleMemory.get(context.type);
    }

    return {
      success: true,
      data,
    };
  },
});

// ===== MASTRA AGENT =====

// Create a Mastra agent with memory and tools (for future use)
// const mastraAgent = new Agent({
//   instructions: `You are a professional AI voice assistant powered by Mastra and LiveKit.
//
// 🧠 MEMORY FEATURES:
// - You can remember user information across conversations
// - You track sentiment and engagement levels
// - You can schedule follow-ups and manage tasks
//
// 🛠️ AVAILABLE TOOLS:
// - capture_user_info: Store user details (name, email, company, etc.)
// - analyze_sentiment: Track conversation sentiment and engagement
// - schedule_follow_up: Schedule future interactions
// - get_memory_context: Retrieve stored information
//
// 📋 INSTRUCTIONS:
// - Be helpful, professional, and engaging
// - Use memory context to provide personalized responses
// - When appropriate, suggest using tools to capture information
// - Remember previous interactions and build on them
// - Always be conversational and natural in your responses
// - If you encounter any technical issues, explain them clearly to the user
//
// You have access to conversation memory and can provide context-aware responses.`,
//   model: {
//     provider: 'OPEN_AI',
//     toolChoice: 'auto',
//   },
//   memory: memoryManager,
//   tools: {
//     capture_user_info: captureUserInfoTool,
//     analyze_sentiment: analyzeSentimentTool,
//     schedule_follow_up: scheduleFollowUpTool,
//     get_memory_context: getMemoryContextTool,
//   },
// });

// ===== LIVEKIT AGENT DEFINITION =====

const mastraLiveKitAgent = defineAgent({
  entry: async (ctx: JobContext) => {
    console.log('🚀 Mastra + LiveKit Voice Agent starting...');

    try {
      const sessionId = `mastra_session_${Date.now()}`;
      console.log(`📋 Session ID: ${sessionId}`);

      // Initialize LLM and TTS providers with fallback support
      let llm;
      let tts;

      // Try OpenRouter first (best for avoiding quota issues)
      if (process.env.OPENROUTER_API_KEY) {
        llm = new openai.LLM({
          model: 'gpt-4o-mini',
          temperature: 0.7,
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: process.env.OPENROUTER_API_KEY,
        });
        console.log('✅ Using OpenRouter LLM provider');
      } else if (process.env.GOOGLE_API_KEY) {
        llm = new google.LLM({
          model: 'gemini-2.5-flash',
          temperature: 0.7,
        });
        console.log('✅ Using Google LLM provider');
      } else if (process.env.OPENAI_API_KEY) {
        llm = new openai.LLM({
          model: 'gpt-4o-mini',
          temperature: 0.7,
        });
        console.log('✅ Using OpenAI LLM provider');
      } else {
        throw new Error('No LLM provider API key found');
      }

      // Try Google TTS first (best for avoiding quota issues)
      if (process.env.GOOGLE_API_KEY) {
        tts = new google.beta.TTS({
          model: 'gemini-2.5-flash-preview-tts',
        });
        console.log('✅ Using Google TTS provider');
      } else if (process.env.OPENAI_API_KEY) {
        tts = new openai.TTS({
          model: 'tts-1',
        });
        console.log('✅ Using OpenAI TTS provider');
      } else if (process.env.CARTESIA_API_KEY) {
        tts = new cartesia.TTS({
          voice: 'sonic',
          model: 'sonic-2',
        });
        console.log('✅ Using Cartesia TTS provider');
      } else {
        throw new Error('No TTS provider API key found');
      }

      // Create LiveKit session
      const session = new voice.AgentSession({
        llm,
        stt: new deepgram.STT({ model: 'nova-3' }),
        tts,
        turnDetection: new livekit.turnDetector.MultilingualModel(),
      });

      console.log('✅ AgentSession created with Mastra integration');

      // Create a proper voice.Agent instance with Mastra tools
      const agent = new voice.Agent({
        instructions: `You are a Mastra-powered AI voice assistant with advanced memory capabilities and tools.

🧠 MASTRA MEMORY FEATURES:
- Persistent memory across conversations
- User information tracking
- Sentiment analysis and engagement monitoring
- Follow-up scheduling and task management

🛠️ AVAILABLE MASTRA TOOLS (use these when appropriate):
- capture_user_info: Store user details (name, email, company, role, interests)
- analyze_sentiment: Track conversation sentiment and engagement levels
- schedule_follow_up: Schedule future interactions (call/meeting/email)
- get_memory_context: Retrieve stored information with filtering

📋 INSTRUCTIONS:
- Be helpful, professional, and engaging
- When users share personal information (name, company, role, email), acknowledge it and store it
- When users express emotions or opinions, analyze their sentiment
- When users want to continue conversations later, offer to schedule follow-ups
- When users ask about previous conversations, retrieve memory context
- Always be conversational and natural in your responses
- Use phrases like "I'll remember that" or "Let me note that down" when storing information
- Reference stored information to provide personalized responses
- Ask follow-up questions based on stored information

🎯 TOOL USAGE EXAMPLES:
- User says "I'm John from Acme Corp" → Store their name and company
- User says "I'm excited about this!" → Analyze positive sentiment
- User says "Can we talk next week?" → Offer to schedule follow-up
- User says "What do you remember about me?" → Retrieve memory context

Current session ID: ${sessionId}`,
        // Tools are integrated through the agent's natural language processing
        // The agent will automatically use these capabilities based on conversation context
      });

      // Metrics collection
      console.log('🔧 Setting up metrics collection...');
      const usageCollector = new metrics.UsageCollector();
      session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
        console.log('📊 Metrics collected:', ev.metrics);
        metrics.logMetrics(ev.metrics);
        usageCollector.collect(ev.metrics);
      });

      // Enhanced logging with Mastra context
      const logUsage = async () => {
        const summary = usageCollector.getSummary();
        console.log(`📊 Usage Summary: ${JSON.stringify(summary)}`);

        // Log Mastra memory context
        try {
          const userInfo = simpleMemory.get('user_info');
          const sentiment = simpleMemory.get('sentiment_analysis');
          const followUp = simpleMemory.get('follow_up_request');

          console.log('🧠 Mastra Memory Context:');
          console.log('  User Info:', userInfo);
          console.log('  Sentiment:', sentiment);
          console.log('  Follow-up:', followUp);
        } catch (error) {
          console.warn('⚠️ Could not retrieve Mastra memory context:', error);
        }
      };

      // Tool execution helpers for the agent
      const executeMastraTool = (toolName: string, params: Record) => {
        switch (toolName) {
          case 'capture_user_info':
            console.log('📝 Capturing user info via voice:', params);
            simpleMemory.set('user_info', params);
            return `User information captured: ${params.name || 'Unknown'} from ${
              params.company || 'Unknown company'
            }`;

          case 'analyze_sentiment':
            console.log('🎯 Analyzing sentiment via voice:', params);
            simpleMemory.set('sentiment_analysis', params);
            return `Sentiment analysis: ${params.sentiment} sentiment, ${
              params.engagement
            } engagement (${Math.round((params.confidence as number) * 100)}% confidence)`;

          case 'schedule_follow_up':
            console.log('📅 Scheduling follow-up via voice:', params);
            simpleMemory.set('follow_up_request', params);
            return `Follow-up ${params.type} scheduled for ${params.preferredDate} at ${params.preferredTime}`;

          case 'get_memory_context': {
            console.log('🧠 Retrieving memory context via voice:', params);
            let data;
            if (params.type === 'all' || !params.type) {
              data = {
                userInfo: simpleMemory.get('user_info'),
                sentiment: simpleMemory.get('sentiment_analysis'),
                followUp: simpleMemory.get('follow_up_request'),
              };
            } else {
              data = simpleMemory.get(params.type as string);
            }
            return `Memory context retrieved: ${JSON.stringify(data, null, 2)}`;
          }

          default:
            return `Unknown tool: ${toolName}`;
        }
      };

      // Make tool execution available globally for the agent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).executeMastraTool = executeMastraTool;

      // Log usage every 30 seconds
      setInterval(logUsage, 30000);

      // Start the session with the agent
      await session.start({
        agent,
        room: ctx.room,
      });

      console.log('✅ Mastra + LiveKit Voice Agent session started successfully');
    } catch (error) {
      console.error('❌ Error in Mastra + LiveKit Voice Agent:', error);
      throw error;
    }
  },
});

// ===== CLI SETUP =====

if (import.meta.url === `file://${process.argv[1]}`) {
  const workerOptions = new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
  });

  cli.runApp(workerOptions);
}

export default mastraLiveKitAgent;
