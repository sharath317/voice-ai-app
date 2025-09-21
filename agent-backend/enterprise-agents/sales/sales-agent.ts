/**
 * Enterprise Sales Agent
 * Specialized agent for sales operations, lead management, and revenue generation
 */
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
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { GHLMCPClient } from '../shared/ghl-client.js';
import { RuntimeLLMFallbackManager } from '../shared/runtime-fallback-manager.js';

//import { WorkflowEngine } from '../shared/workflow-engine.js';

dotenv.config({ path: '.env' });

// Provider Health Check System (simplified version from ghl-mcp-agent)
class ProviderHealthChecker {
  static async testOpenAITTS(): Promise<boolean> {
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

  static async testGoogleTTS(): Promise<boolean> {
    try {
      return !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.length > 10);
    } catch {
      return false;
    }
  }

  static async testCartesiaTTS(): Promise<boolean> {
    try {
      return !!(process.env.CARTESIA_API_KEY && process.env.CARTESIA_API_KEY.length > 10);
    } catch {
      return false;
    }
  }

  static async getBestTTSProvider(): Promise<string> {
    const providers = [
      { name: 'cartesia', test: this.testCartesiaTTS },
      { name: 'google', test: this.testGoogleTTS },
      { name: 'openai', test: this.testOpenAITTS },
    ];

    for (const provider of providers) {
      if (await provider.test()) {
        return provider.name;
      }
    }
    return 'cartesia'; // fallback
  }
}

const salesAgent = defineAgent({
  prewarm: async (proc: JobProcess) => {
    console.log('🔧 Prewarming Enterprise Sales Agent...');
    proc.userData.vad = await silero.VAD.load();
    console.log('✅ VAD model loaded');
  },

  entry: async (ctx: JobContext) => {
    console.log('🚀 Enterprise Sales Agent starting...');

    // Initialize GHL client and workflow engine
    const ghlClient = new GHLMCPClient(process.env.GHL_API_KEY!, process.env.GHL_LOCATION_ID!);
    //const workflowEngine = new WorkflowEngine();

    // Set up LLM provider with runtime fallback logic
    const llmFallbackManager = new RuntimeLLMFallbackManager();
    const llmProvider = await llmFallbackManager.getHealthyLLMProvider();
    if (!llmProvider) {
      console.error('❌ No healthy LLM provider available. Exiting agent.');
      return;
    }

    console.log(`🎯 LLM Provider selected: ${llmFallbackManager.getCurrentProviderName()}`);
    console.log(`📋 Available providers: ${llmFallbackManager.getAvailableProviders().join(', ')}`);

    // Use health checker to select the best TTS provider
    const bestTTSProvider = await ProviderHealthChecker.getBestTTSProvider();
    let tts;

    switch (bestTTSProvider) {
      case 'cartesia':
        tts = new cartesia.TTS({
          voice: '794f9389-aac1-45b6-b726-9d9369183238',
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

    // Define tools using the LLM provider
    const tools = {
      get_contacts: llm.tool({
        description: 'List all contacts from GoHighLevel.',
        parameters: z.object({
          limit: z
            .number()
            .optional()
            .default(10)
            .describe('Maximum number of contacts to retrieve.'),
        }),
        execute: async ({ limit }) => {
          try {
            const result = await ghlClient.callTool('contacts_get-contacts', {
              query_limit: limit,
              query_locationId: process.env.GHL_LOCATION_ID,
            });
            return result.success ? JSON.stringify(result.data, null, 2) : `Error: ${result.error}`;
          } catch (error) {
            return `Error retrieving contacts: ${error}`;
          }
        },
      }),

      create_contact: llm.tool({
        description: 'Create a new contact in GoHighLevel.',
        parameters: z.object({
          firstName: z.string(),
          lastName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
        }),
        execute: async ({ firstName, lastName, email, phone }) => {
          try {
            const result = await ghlClient.callTool('contacts_create-contact', {
              firstName,
              lastName,
              email,
              phone,
              locationId: process.env.GHL_LOCATION_ID,
            });
            return result.success
              ? `Contact created: ${JSON.stringify(result.data, null, 2)}`
              : `Error: ${result.error}`;
          } catch (error) {
            return `Error creating contact: ${error}`;
          }
        },
      }),

      get_calendar_events: llm.tool({
        description: 'Get calendar events and appointments from GoHighLevel.',
        parameters: z.object({
          userId: z.string().optional().describe('User ID to filter events'),
          groupId: z.string().optional().describe('Group ID to filter events'),
          calendarId: z
            .string()
            .describe('Calendar ID to filter events (format: eSQxdGmxInjrZa38Ui6l)'),
          startTime: z.string().describe('Start time for events (ISO 8601 format)'),
          endTime: z.string().describe('End time for events (ISO 8601 format)'),
        }),
        execute: async ({ userId, groupId, calendarId, startTime, endTime }) => {
          try {
            const startMillis = new Date(startTime).getTime();
            const endMillis = new Date(endTime).getTime();
            const result = await ghlClient.callTool('calendars_get-calendar-events', {
              query_userId: userId || undefined,
              query_groupId: groupId || undefined,
              query_calendarId: calendarId,
              query_startTime: startMillis,
              query_endTime: endMillis,
            });
            return result.success ? JSON.stringify(result.data, null, 2) : `Error: ${result.error}`;
          } catch (error) {
            return `Error retrieving calendar events: ${error}`;
          }
        },
      }),

      create_calendar_event: llm.tool({
        description: 'Provide instructions for creating a new calendar event in GoHighLevel.',
        parameters: z.object({
          title: z.string().describe('Event title'),
          startTime: z.string().describe('Start time in ISO 8601 format'),
          endTime: z.string().describe('End time in ISO 8601 format'),
          description: z.string().optional().describe('Event description'),
          location: z.string().optional().describe('Event location'),
          attendees: z.array(z.string()).optional().describe('List of attendee email addresses'),
          calendarId: z
            .string()
            .optional()
            .describe('Calendar ID (optional, defaults to eSQxdGmxInjrZa38Ui6l)'),
        }),
        execute: async (
          { title, startTime, endTime, description, location, attendees, calendarId },
        ) => {
          const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const instructions = `📅 **CALENDAR EVENT CREATION INSTRUCTIONS**

**Event Details:**
- **Title:** ${title}
- **Start Time:** ${startTime}
- **End Time:** ${endTime}
- **Description:** ${description || 'None'}
- **Location:** ${location || 'None'}
- **Attendees:** ${attendees ? attendees.join(', ') : 'None'}
- **Calendar ID:** ${calendarId || 'eSQxdGmxInjrZa38Ui6l'}

**How to Create:**
1. **Option 1 - Booking Widget:** Visit https://api.leadconnectorhq.com/widget/booking/eSQxdGmxInjrZa38Ui6l
2. **Option 2 - GoHighLevel Dashboard:** Log into your GHL account and create the event manually
3. **Option 3 - Calendar App:** Use the details above to create in your preferred calendar app

**Event ID for Reference:** ${eventId}`;
          return `✅ Calendar event details prepared successfully!\n\n${instructions}`;
        },
      }),

      qualify_lead_bant: llm.tool({
        description:
          'Qualify a lead based on Budget, Authority, Need, and Timeline (BANT) criteria.',
        parameters: z.object({
          contactId: z.string().describe('The ID of the contact to qualify.'),
          budget: z.string().optional().describe('The estimated budget for the solution.'),
          authority: z
            .string()
            .optional()
            .describe('The decision-making authority of the contact.'),
          need: z.string().optional().describe('The specific needs or pain points of the contact.'),
          timeline: z.string().optional().describe('The timeline for implementing a solution.'),
        }),
        execute: async ({ contactId, budget, authority, need, timeline }) => {
          console.log('Starting BANT lead qualification workflow...');
          try {
            // Simple BANT scoring logic
            let score = 0;
            const analysis = {
              budget: budget ? 'Qualified' : 'Needs Assessment',
              authority: authority ? 'Qualified' : 'Needs Assessment',
              need: need ? 'Qualified' : 'Needs Assessment',
              timeline: timeline ? 'Qualified' : 'Needs Assessment',
            };

            if (budget) score += 25;
            if (authority) score += 25;
            if (need) score += 25;
            if (timeline) score += 25;

            const qualification =
              score >= 75 ? 'Hot Lead' : score >= 50 ? 'Warm Lead' : 'Cold Lead';

            return `📊 **BANT Lead Qualification Results**

**Contact ID:** ${contactId}
**Overall Score:** ${score}/100
**Qualification:** ${qualification}

**BANT Analysis:**
- **Budget:** ${analysis.budget} ${budget ? `(${budget})` : ''}
- **Authority:** ${analysis.authority} ${authority ? `(${authority})` : ''}
- **Need:** ${analysis.need} ${need ? `(${need})` : ''}
- **Timeline:** ${analysis.timeline} ${timeline ? `(${timeline})` : ''}

**Recommended Actions:**
${score >= 75
                ? '- Schedule demo/presentation\n- Prepare proposal\n- Fast-track through pipeline'
                : score >= 50
                  ? '- Gather missing BANT information\n- Schedule follow-up call\n- Send relevant resources'
                  : '- Nurture with educational content\n- Qualify further\n- Long-term follow-up sequence'
              }`;
          } catch (error) {
            console.error('Error during BANT lead qualification:', error);
            return `Failed to qualify lead: ${error instanceof Error ? error.message : String(error)
              }`;
          }
        },
      }),
    };

    // Create the sales assistant with tools
    const assistant = new voice.Agent({
      instructions: `You are an Enterprise Sales Agent, a sophisticated AI assistant specialized in sales operations, lead management, and revenue generation.

🎯 **SALES EXPERTISE:**
- Lead qualification and scoring (BANT methodology)
- Sales pipeline management and forecasting
- Customer relationship management
- Proposal generation and contract negotiation
- Sales performance analytics and reporting
- Competitive analysis and positioning

🏢 **CORE CAPABILITIES:**
- **Lead Management**: Qualify, score, and nurture leads through the sales funnel
- **Pipeline Management**: Track opportunities from prospect to close
- **Customer Intelligence**: Analyze customer data for better engagement
- **Sales Automation**: Automate follow-ups, proposals, and scheduling
- **Revenue Optimization**: Identify upselling and cross-selling opportunities
- **Performance Analytics**: Track KPIs and sales metrics

🛠️ **AVAILABLE TOOLS:**
- get_contacts: List all contacts from GoHighLevel
- create_contact: Create new customer contacts
- update_contact: Update existing contact information
- get_calendar_events: View calendar events
- create_calendar_event: Provide instructions for manual calendar event creation
- qualify_lead_bant: Qualify a lead using the BANT (Budget, Authority, Need, Timeline) framework

📋 **INSTRUCTIONS:**
- Be proactive in qualifying leads using BANT methodology
- Always extract complete contact information before creating contacts
- Use professional, persuasive, and consultative sales language
- Focus on understanding customer needs and pain points
- Provide value-driven solutions and recommendations
- Track all interactions and follow-up activities
- Maintain detailed records of sales conversations
- For calendar creation, provide the booking widget URL and detailed instructions

Always be strategic, results-oriented, and customer-focused. Your goal is to drive revenue growth while building lasting customer relationships.`,

      tools,
    });

    // Set up a voice AI pipeline with sales tools
    const session = new voice.AgentSession({
      llm: llmProvider,
      stt: new deepgram.STT({ model: 'nova-3' }),
      tts,
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad! as silero.VAD,
    });

    console.log('✅ AgentSession created for Enterprise Sales Agent');

    // Metrics collection
    const usageCollector = new metrics.UsageCollector();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      console.log('📊 Sales Agent Metrics collected:', ev.metrics);
      metrics.logMetrics(ev.metrics);
      usageCollector.collect(ev.metrics);
    });

    // Error handling for LLM failures with runtime fallback
    session.on(voice.AgentSessionEventTypes.Error, async (ev) => {
      console.log('❌ Sales Agent Error:', ev.error);

      // Check if it's an LLM-related error (quota, API key, etc.)
      const errorMessage =
        ev.error && typeof ev.error === 'object' && 'message' in ev.error
          ? String(ev.error.message)
          : '';
      if (
        errorMessage &&
        (errorMessage.includes('402') ||
          errorMessage.includes('quota') ||
          errorMessage.includes('credits'))
      ) {
        console.log('🔄 LLM quota/credit error detected, attempting fallback...');

        try {
          const newLLMProvider = await llmFallbackManager.handleLLMError(ev.error);
          console.log(
            `✅ Successfully switched to ${llmFallbackManager.getCurrentProviderName()} LLM provider`,
          );

          // Update the session with the new LLM provider
          session.llm = newLLMProvider;
          console.log('🔄 Updated session with new LLM provider');
        } catch (fallbackError) {
          console.error('❌ All LLM fallback attempts failed:', fallbackError);
        }
      }
    });

    const logUsage = async () => {
      const summary = usageCollector.getSummary();
      console.log(`📊 Sales Agent Usage Summary: ${JSON.stringify(summary)}`);
    };

    ctx.addShutdownCallback(logUsage);

    // Start the session
    console.log('🔧 Starting Enterprise Sales voice session...');
    await session.start({
      agent: assistant,
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });
    console.log('✅ Enterprise Sales voice session started successfully');

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
  process.exit(1);
}

if (!process.env.GHL_API_KEY) {
  console.error('❌ Missing GoHighLevel API key:');
  console.error('   - GHL_API_KEY');
  console.error('   - GHL_LOCATION_ID');
  process.exit(1);
}

// CLI interface
try {
  const workerOptions = new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    apiKey: process.env.LIVEKIT_API_KEY!,
    apiSecret: process.env.LIVEKIT_API_SECRET!,
  });

  console.log('✅ Worker options created, starting Enterprise Sales worker...');
  cli.runApp(workerOptions);
} catch (error) {
  console.error('❌ Failed to start Enterprise Sales LiveKit agent worker:', error);
  process.exit(1);
}

export default salesAgent;
