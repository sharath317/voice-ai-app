/**
 * Enterprise Customer Service Agent
 * Specialized agent for customer support, issue resolution, and satisfaction management
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

// Use the shared runtime fallback manager

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

const customerServiceAgent = defineAgent({
  prewarm: async (proc: JobProcess) => {
    console.log('🔧 Prewarming Enterprise Customer Service Agent...');
    proc.userData.vad = await silero.VAD.load();
    console.log('✅ VAD model loaded');
  },

  entry: async (ctx: JobContext) => {
    console.log('🚀 Enterprise Customer Service Agent starting...');

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
        description: 'Create a new customer contact in GoHighLevel.',
        parameters: z.object({
          firstName: z.string(),
          lastName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          source: z.string().optional().describe('How the customer found us'),
          tags: z.array(z.string()).optional().describe('Tags for the customer'),
        }),
        execute: async ({ firstName, lastName, email, phone, source, tags }) => {
          try {
            const result = await ghlClient.callTool('contacts_create-contact', {
              firstName,
              lastName,
              email,
              phone,
              locationId: process.env.GHL_LOCATION_ID,
              customFields: {
                source: source || '',
                customerType: 'Customer',
                tags: tags ? tags.join(',') : '',
              },
            });
            return result.success
              ? `Customer contact created: ${JSON.stringify(result.data, null, 2)}`
              : `Error: ${result.error}`;
          } catch (error) {
            return `Error creating customer contact: ${error}`;
          }
        },
      }),

      get_calendar_events: llm.tool({
        description: 'Get HR-related calendar events and appointments from GoHighLevel.',
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
        description: 'Provide instructions for creating HR-related calendar events in GoHighLevel.',
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

      create_support_ticket: llm.tool({
        description: 'Create a support ticket for customer issues.',
        parameters: z.object({
          customerName: z.string().describe('Customer name'),
          customerEmail: z.string().email().describe('Customer email'),
          issueType: z.string().describe('Type of issue (technical, billing, general, etc.)'),
          priority: z.enum(['low', 'medium', 'high', 'urgent']).describe('Issue priority level'),
          description: z.string().describe('Detailed description of the issue'),
          assignedTo: z.string().optional().describe('Support agent to assign the ticket to'),
        }),
        execute: async (
          { customerName, customerEmail, issueType, priority, description, assignedTo },
        ) => {
          const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          const ticketInstructions = `🎫 **SUPPORT TICKET CREATION INSTRUCTIONS**

**Ticket Details:**
- **Ticket ID:** ${ticketId}
- **Customer:** ${customerName} (${customerEmail})
- **Issue Type:** ${issueType}
- **Priority:** ${priority.toUpperCase()}
- **Description:** ${description}
- **Assigned To:** ${assignedTo || 'To be assigned'}

**Next Steps:**
1. **Create ticket in support system**
2. **Assign to:** ${assignedTo || 'Next available agent'}
3. **Send confirmation email to customer**
4. **Set priority level:** ${priority.toUpperCase()}
5. **Add to tracking system**

**Email Template:**
Subject: Support Ticket Created - ${ticketId}

Dear ${customerName},

We have received your support request and created ticket ${ticketId}.

**Issue Details:**
- Type: ${issueType}
- Priority: ${priority.toUpperCase()}
- Description: ${description}

**Next Steps:**
- A support agent will be assigned within 24 hours
- You will receive updates via email
- Expected resolution time: ${priority === 'urgent' ? '2-4 hours' : priority === 'high' ? '1-2 days' : '3-5 days'
            }

Thank you for your patience.

Best regards,
Customer Service Team`;

          return `✅ Support ticket creation instructions prepared successfully!\n\n${ticketInstructions}`;
        },
      }),

      schedule_interview: llm.tool({
        description: 'Schedule an interview with a candidate and provide detailed instructions.',
        parameters: z.object({
          candidateName: z.string().describe('Name of the candidate'),
          candidateEmail: z.string().email().describe('Candidate email address'),
          position: z.string().describe('Position being interviewed for'),
          interviewType: z.string().describe('Type of interview (phone, video, in-person)'),
          scheduledTime: z.string().describe('Scheduled interview time (ISO 8601 format)'),
          duration: z.number().optional().default(60).describe('Interview duration in minutes'),
          interviewer: z.string().optional().describe('Name of the interviewer'),
          location: z.string().optional().describe('Interview location or meeting link'),
        }),
        execute: async (
          {
            candidateName,
            candidateEmail,
            position,
            interviewType,
            scheduledTime,
            duration,
            interviewer,
            location,
          },
        ) => {
          const interviewId = `interview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const endTime = new Date(
            new Date(scheduledTime).getTime() + (duration ?? 60) * 60000,
          ).toISOString();

          const instructions = `🎯 **INTERVIEW SCHEDULING INSTRUCTIONS**

**Interview Details:**
- **Candidate:** ${candidateName} (${candidateEmail})
- **Position:** ${position}
- **Interview Type:** ${interviewType}
- **Scheduled Time:** ${scheduledTime}
- **Duration:** ${duration} minutes
- **End Time:** ${endTime}
- **Interviewer:** ${interviewer || 'To be assigned'}
- **Location:** ${location || 'To be determined'}

**Next Steps:**
1. **Send Calendar Invite:** Create calendar event with candidate and interviewer
2. **Send Confirmation Email:** Notify candidate with interview details
3. **Prepare Interview Materials:** Gather job description, resume, and interview questions
4. **Set Up Meeting:** ${interviewType === 'video'
              ? 'Prepare video conference link'
              : interviewType === 'phone'
                ? 'Prepare phone number'
                : 'Confirm meeting room availability'
            }

**Interview ID:** ${interviewId}

**Email Template:**
Subject: Interview Confirmation - ${position} at [Company Name]

Dear ${candidateName},

We are pleased to confirm your interview for the ${position} position.

**Interview Details:**
- Date & Time: ${new Date(scheduledTime).toLocaleString()}
- Duration: ${duration} minutes
- Type: ${interviewType}
- ${interviewType === 'video'
              ? 'Meeting Link: [To be provided]'
              : interviewType === 'phone'
                ? 'Phone Number: [To be provided]'
                : 'Location: [To be provided]'
            }

Please confirm your attendance by replying to this email.

Best regards,
[Your Name]
HR Department`;

          return `✅ Interview scheduling instructions prepared successfully!\n\n${instructions}`;
        },
      }),
    };

    // Create the Customer Service assistant with tools
    const assistant = new voice.Agent({
      instructions: `You are an Enterprise Customer Service Agent, a sophisticated AI assistant specialized in customer support, issue resolution, and satisfaction management.

🎯 **CUSTOMER SERVICE EXPERTISE:**
- Issue diagnosis and resolution
- Customer satisfaction management
- Support ticket management
- Escalation procedures
- Product knowledge and troubleshooting
- Billing and account support

🏢 **CORE CAPABILITIES:**
- **Issue Resolution**: Diagnose and resolve customer problems efficiently
- **Support Tickets**: Create, track, and manage support requests
- **Communication**: Maintain clear, empathetic communication
- **Documentation**: Track all customer interactions and resolutions
- **Follow-up**: Ensure customer satisfaction and issue closure

🛠️ **AVAILABLE TOOLS:**
- get_contacts: List all contacts from GoHighLevel for customer service
- create_contact: Create new customer contacts
- get_calendar_events: View customer service-related calendar events
- create_calendar_event: Provide instructions for manual calendar event creation
- create_support_ticket: Create support tickets for customer issues
- schedule_interview: Schedule interviews with detailed instructions

📋 **INSTRUCTIONS:**
- Be empathetic, patient, and solution-oriented
- Always prioritize customer satisfaction and quick resolution
- Document all interactions and follow-up actions
- Provide clear, actionable solutions
- Maintain professional and friendly communication
- Focus on first-call resolution when possible
- Ensure customers feel heard and valued

Always be helpful, understanding, and focused on resolving customer issues efficiently while maintaining high satisfaction levels.`,

      tools,
    });

    // Set up a voice AI pipeline with Customer Service tools
    const session = new voice.AgentSession({
      llm: llmProvider,
      stt: new deepgram.STT({ model: 'nova-3' }),
      tts,
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad! as silero.VAD,
    });

    console.log('✅ AgentSession created for Enterprise Customer Service Agent');

    // Metrics collection
    const usageCollector = new metrics.UsageCollector();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      console.log('📊 Customer Service Agent Metrics collected:', ev.metrics);
      metrics.logMetrics(ev.metrics);
      usageCollector.collect(ev.metrics);
    });

    // Error handling for LLM failures with runtime fallback
    session.on(voice.AgentSessionEventTypes.Error, async (ev) => {
      console.log('❌ Customer Service Agent Error:', ev.error);

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
      console.log(`📊 Customer Service Agent Usage Summary: ${JSON.stringify(summary)}`);
    };

    ctx.addShutdownCallback(logUsage);

    // Start the session
    console.log('🔧 Starting Enterprise Customer Service voice session...');
    await session.start({
      agent: assistant,
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });
    console.log('✅ Enterprise Customer Service voice session started successfully');

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

  console.log('✅ Worker options created, starting Enterprise Customer Service worker...');
  cli.runApp(workerOptions);
} catch (error) {
  console.error('❌ Failed to start Enterprise Customer Service LiveKit agent worker:', error);
  process.exit(1);
}

export default customerServiceAgent;
