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
import * as google from '@livekit/agents-plugin-google';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: '.env' });

interface LLMProvider {
  name: string;
  llm: unknown;
  priority: number;
  quotaExceeded: boolean;
}

class Assistant extends voice.Agent {
  private llmProviders: LLMProvider[] = [];

  constructor() {
    super({
      instructions: `You are a helpful voice AI assistant.
      You eagerly assist users with their questions by providing information from your extensive knowledge.
      Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asterisks, or other symbols.
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
      },
    });
  }

  // Method to initialize multiple LLM providers with fallback
  public initializeLLMProviders() {
    console.log('🔧 Initializing multiple LLM providers...');

    // Provider 1: OpenAI (Primary)
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiLLM = new openai.LLM({
          model: 'gpt-4o-mini',
          temperature: 0.7,
        });

        openaiLLM.on('error', (error: unknown) => {
          console.error('🚨 OpenAI Error:', error);
          this.markProviderQuotaExceeded('openai');
        });

        this.llmProviders.push({
          name: 'openai',
          llm: openaiLLM,
          priority: 1,
          quotaExceeded: false,
        });
        console.log('✅ OpenAI LLM provider initialized');
      } catch (error) {
        console.error('❌ Failed to initialize OpenAI:', error);
      }
    }

    // Provider 2: Google Gemini (Secondary)
    if (process.env.GOOGLE_API_KEY) {
      try {
        const googleLLM = new google.LLM({
          model: 'gemini-1.5-flash',
          temperature: 0.7,
        });

        googleLLM.on('error', (error: unknown) => {
          console.error('🚨 Google Gemini Error:', error);
          this.markProviderQuotaExceeded('google');
        });

        this.llmProviders.push({
          name: 'google',
          llm: googleLLM,
          priority: 2,
          quotaExceeded: false,
        });
        console.log('✅ Google Gemini LLM provider initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Google Gemini:', error);
      }
    }

    // Sort providers by priority
    this.llmProviders.sort((a: LLMProvider, b: LLMProvider) => a.priority - b.priority);
    console.log(`🎯 Initialized ${this.llmProviders.length} LLM providers`);
  }

  // Method to get the best available LLM
  public getBestAvailableLLM(): unknown {
    const availableProvider = this.llmProviders.find(
      (provider: LLMProvider) => !provider.quotaExceeded,
    );

    if (availableProvider) {
      console.log(`🎯 Using LLM provider: ${availableProvider.name}`);
      return availableProvider.llm;
    } else {
      console.error('❌ All LLM providers have exceeded quota');
      return null;
    }
  }

  // Method to mark a provider as quota exceeded
  private markProviderQuotaExceeded(providerName: string) {
    const provider = this.llmProviders.find((p: LLMProvider) => p.name === providerName);
    if (provider) {
      provider.quotaExceeded = true;
      console.log(`⚠️ Provider ${providerName} marked as quota exceeded`);
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
    console.log('Agent entry started');

    // Create assistant instance and initialize multi-LLM system
    const assistant = new Assistant();
    console.log('🔧 Initializing multi-LLM fallback system...');
    assistant.initializeLLMProviders();

    // Get the best available LLM
    const llm = assistant.getBestAvailableLLM();
    if (!llm) {
      throw new Error('No LLM providers available - check API keys');
    }
    console.log('✅ Multi-LLM system initialized');

    // Set up a voice AI pipeline using multiple LLM providers, Cartesia, Deepgram, and the LiveKit turn detector
    const session = new voice.AgentSession({
      // A Large Language Model (LLM) is your agent's brain, processing user input and generating a response
      // See all providers at https://docs.livekit.io/agents/integrations/llm/
      llm: llm as unknown as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      // Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
      // See all providers at https://docs.livekit.io/agents/integrations/stt/
      stt: new deepgram.STT({ model: 'nova-3' }),
      // Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
      // See all providers at https://docs.livekit.io/agents/integrations/tts/
      tts: new cartesia.TTS({
        voice: '794f9389-aac1-45b6-b726-9d9369183238',
        // Add voice customization options
        speed: 1.0, // Speech speed (0.5 to 2.0)
      }),
      // VAD and turn detection are used to determine when the user is speaking and when the agent should respond
      // See more at https://docs.livekit.io/agents/build/turns
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad! as silero.VAD,
    });

    // To use a realtime model instead of a voice pipeline, use the following session setup instead:
    // const session = new voice.AgentSession({
    //   // See all providers at https://docs.livekit.io/agents/integrations/realtime/
    //   llm: new openai.realtime.RealtimeModel({ voice: 'marin' }),
    // });

    // Metrics collection, to measure pipeline performance
    // For more information, see https://docs.livekit.io/agents/build/metrics/
    const usageCollector = new metrics.UsageCollector();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      metrics.logMetrics(ev.metrics);
      usageCollector.collect(ev.metrics);
    });

    const logUsage = async () => {
      const summary = usageCollector.getSummary();
      console.log(`Usage: ${JSON.stringify(summary)}`);
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
    console.log('Starting voice session...');
    await session.start({
      agent: assistant,
      room: ctx.room,
      inputOptions: {
        // LiveKit Cloud enhanced noise cancellation
        // - If self-hosting, omit this parameter
        // - For telephony applications, use `BackgroundVoiceCancellationTelephony` for best results
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });
    console.log('Voice session started successfully');

    // Join the room and connect to the user
    console.log('Connecting to room...');
    await ctx.connect();
    console.log('Connected to room successfully');
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
