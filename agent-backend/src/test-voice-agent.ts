import {
  JobContext,
  JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  metrics,
  voice,
} from '@livekit/agents';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as google from '@livekit/agents-plugin-google';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
// import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: '.env' });

// Provider Health Check System
class ProviderHealthChecker {
  static async testOpenAITTS(): Promise {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  static async testGoogleTTS(): Promise {
    try {
      // Simple test - check if API key is valid format
      return !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.length > 10);
    } catch {
      return false;
    }
  }

  static async testCartesiaTTS(): Promise {
    try {
      // Simple test - check if API key is valid format
      return !!(process.env.CARTESIA_API_KEY && process.env.CARTESIA_API_KEY.length > 10);
    } catch {
      return false;
    }
  }

  static async getBestTTSProvider(): Promise {
    console.log('🔍 Testing TTS provider health...');

    // Test Cartesia first (most reliable)
    if (process.env.CARTESIA_API_KEY && (await this.testCartesiaTTS())) {
      console.log('✅ Cartesia TTS is healthy');
      return 'cartesia';
    }

    // Test Google TTS second
    if (process.env.GOOGLE_API_KEY && (await this.testGoogleTTS())) {
      console.log('✅ Google TTS is healthy');
      return 'google';
    }

    // Test OpenAI TTS last (has quota issues)
    if (process.env.OPENAI_API_KEY && (await this.testOpenAITTS())) {
      console.log('✅ OpenAI TTS is healthy');
      return 'openai';
    }

    throw new Error('No healthy TTS providers found');
  }
}

const testVoiceAgent = defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    console.log('🧪 Test Voice Agent starting (without GHL tools)...');

    // Initialize LLM and TTS providers with fallback support
    let llmProvider;
    let tts;

    // Try OpenRouter first (best for avoiding quota issues)
    if (process.env.OPENROUTER_API_KEY) {
      llmProvider = new openai.LLM({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      console.log('✅ Using OpenRouter LLM provider');
    } else if (process.env.GOOGLE_API_KEY) {
      llmProvider = new google.LLM({
        model: 'gemini-2.5-flash',
        temperature: 0.7,
      });
      console.log('✅ Using Google LLM provider');
    } else if (process.env.OPENAI_API_KEY) {
      llmProvider = new openai.LLM({
        model: 'gpt-4o-mini',
        temperature: 0.7,
      });
      console.log('✅ Using OpenAI LLM provider');
    } else {
      throw new Error('No LLM provider API key found');
    }

    // Use health checker to select the best TTS provider
    const bestTTSProvider = await ProviderHealthChecker.getBestTTSProvider();

    switch (bestTTSProvider) {
      case 'cartesia':
        tts = new cartesia.TTS({
          voice: '794f9389-aac1-45b6-b726-9d9369183238',
          model: 'sonic-2',
          speed: 1.0,
        });
        console.log('✅ Using Cartesia TTS provider (health checked)');
        break;
      case 'google':
        tts = new google.beta.TTS({
          model: 'gemini-2.5-flash-preview-tts',
        });
        console.log('✅ Using Google TTS provider (health checked)');
        break;
      case 'openai':
        tts = new openai.TTS({
          model: 'tts-1',
        });
        console.log('✅ Using OpenAI TTS provider (health checked)');
        break;
      default:
        throw new Error('No healthy TTS providers found');
    }

    // Set up a voice AI pipeline without GHL integration
    const session = new voice.AgentSession({
      llm: llmProvider,
      stt: new deepgram.STT({ model: 'nova-3' }),
      tts,
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad! as silero.VAD,
    });

    console.log('✅ AgentSession created for voice testing');

    // Set up metrics collection like the working sales agent
    console.log('🔧 Setting up metrics collection...');
    const usageCollector = new metrics.UsageCollector();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      console.log('📊 Metrics collected:', ev.metrics);
      metrics.logMetrics(ev.metrics);
    });
    console.log('✅ Metrics collection setup complete');

    const agent = new voice.Agent({
      instructions: `You are a test voice AI assistant. You can help with general questions and conversations.

      Your capabilities include:
      - Answering general questions
      - Having conversations
      - Providing information and assistance
      - Basic problem solving

      Be helpful, friendly, and conversational. Since this is a test without external integrations, 
      focus on general knowledge and conversation.

      Current session: Voice Testing Mode (No External Tools)`,
      tools: {
        // Simple test tool
        get_current_time: llm.tool({
          description: 'Get the current date and time',
          parameters: z.object({}),
          execute: async () => {
            const now = new Date();
            return `Current time: ${now.toLocaleString()}`;
          },
        }),

        // Simple math tool
        calculate: llm.tool({
          description: 'Perform basic mathematical calculations',
          parameters: z.object({
            expression: z
              .string()
              .describe('Mathematical expression to calculate (e.g., "2 + 2", "10 * 5")'),
          }),
          execute: async ({ expression }) => {
            try {
              // Simple and safe evaluation for basic math
              const result = Function(`"use strict"; return (${expression})`)();
              return `Result: ${expression} = ${result}`;
            } catch (error) {
              return `Error calculating ${expression}: ${error}`;
            }
          },
        }),
      },
    });

    // Note: Speech event listeners are not available in current LiveKit version
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

    console.log('🔧 Starting session...');
    await session.start({
      agent,
      room: ctx.room,
    });

    console.log('✅ Session started successfully');
    console.log('🧪 Test Voice Agent connected to room');
  },
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const workerOptions = new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
  });
  cli.runApp(workerOptions);
}

export default testVoiceAgent;
