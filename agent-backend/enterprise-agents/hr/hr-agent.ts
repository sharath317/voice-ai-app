/**
 * Enterprise HR Agent
 * Specialized agent for human resources, employee management, and organizational operations
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

const hrAgent = defineAgent({
    prewarm: async (proc: JobProcess) => {
        console.log('🔧 Prewarming Enterprise HR Agent...');
        proc.userData.vad = await silero.VAD.load();
        console.log('✅ VAD model loaded');
    },

    entry: async (ctx: JobContext) => {
        console.log('🚀 Enterprise HR Agent starting...');

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
                description: 'Create a new employee contact in GoHighLevel.',
                parameters: z.object({
                    firstName: z.string(),
                    lastName: z.string().optional(),
                    email: z.string().email().optional(),
                    phone: z.string().optional(),
                    department: z.string().optional().describe('Employee department'),
                    position: z.string().optional().describe('Employee position/title'),
                }),
                execute: async ({ firstName, lastName, email, phone, department, position }) => {
                    try {
                        const result = await ghlClient.callTool('contacts_create-contact', {
                            firstName,
                            lastName,
                            email,
                            phone,
                            locationId: process.env.GHL_LOCATION_ID,
                            customFields: {
                                department: department || '',
                                position: position || '',
                                employeeType: 'Employee',
                            },
                        });
                        return result.success
                            ? `Employee contact created: ${JSON.stringify(result.data, null, 2)}`
                            : `Error: ${result.error}`;
                    } catch (error) {
                        return `Error creating employee contact: ${error}`;
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

        // Create the HR assistant with tools
        const assistant = new voice.Agent({
            instructions: `You are an Enterprise HR Agent, a sophisticated AI assistant specialized in human resources, employee management, and organizational operations.

🎯 **HR EXPERTISE:**
- Employee lifecycle management
- Recruitment and onboarding
- Performance management
- Training and development
- Compliance and policy management
- Employee engagement and retention

🏢 **CORE CAPABILITIES:**
- **Recruitment**: Manage hiring processes and candidate evaluation
- **Onboarding**: Guide new employees through company integration
- **Performance**: Track and manage employee performance reviews
- **Training**: Coordinate learning and development programs
- **Compliance**: Ensure adherence to HR policies and regulations
- **Analytics**: Generate HR insights and workforce analytics

🛠️ **AVAILABLE TOOLS:**
- get_contacts: List all contacts from GoHighLevel for HR purposes
- create_contact: Create new employee contacts
- get_calendar_events: View HR-related calendar events
- create_calendar_event: Provide instructions for manual calendar event creation
- schedule_interview: Schedule interviews with detailed instructions

📋 **INSTRUCTIONS:**
- Be professional, supportive, and knowledgeable about HR best practices
- Always maintain confidentiality and follow HR compliance guidelines
- Provide detailed, actionable instructions for HR processes
- Focus on employee experience and organizational effectiveness
- Track all HR interactions and follow-up activities
- For calendar creation, provide the booking widget URL and detailed instructions
- Ensure all processes follow company policies and legal requirements

Always be empathetic, organized, and focused on creating a positive employee experience while maintaining operational excellence.`,

            tools,
        });

        // Set up a voice AI pipeline with HR tools
        const session = new voice.AgentSession({
            llm: llmProvider,
            stt: new deepgram.STT({ model: 'nova-3' }),
            tts,
            turnDetection: new livekit.turnDetector.MultilingualModel(),
            vad: ctx.proc.userData.vad! as silero.VAD,
        });

        console.log('✅ AgentSession created for Enterprise HR Agent');

        // Metrics collection
        const usageCollector = new metrics.UsageCollector();
        session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
            console.log('📊 HR Agent Metrics collected:', ev.metrics);
            metrics.logMetrics(ev.metrics);
            usageCollector.collect(ev.metrics);
        });

        // Error handling for LLM failures with runtime fallback
        session.on(voice.AgentSessionEventTypes.Error, async (ev) => {
            console.log('❌ HR Agent Error:', ev.error);

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
            console.log(`📊 HR Agent Usage Summary: ${JSON.stringify(summary)}`);
        };

        ctx.addShutdownCallback(logUsage);

        // Start the session
        console.log('🔧 Starting Enterprise HR voice session...');
        await session.start({
            agent: assistant,
            room: ctx.room,
            inputOptions: {
                noiseCancellation: BackgroundVoiceCancellation(),
            },
        });
        console.log('✅ Enterprise HR voice session started successfully');

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

    console.log('✅ Worker options created, starting Enterprise HR worker...');
    cli.runApp(workerOptions);
} catch (error) {
    console.error('❌ Failed to start Enterprise HR LiveKit agent worker:', error);
    process.exit(1);
}

export default hrAgent;
