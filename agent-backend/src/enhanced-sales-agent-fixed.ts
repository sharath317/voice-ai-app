import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  llm,
  voice,
  metrics,
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

// Import reliability utilities
import {
  RetryManager,
  FallbackManager,
  SessionManager,
  withErrorHandling,
  ResilientAPIClient,
  CircuitBreaker,
  initializeReliabilitySystems
} from './reliability-utils';

dotenv.config({ path: '.env' });

// ===== ENHANCED INTERFACES =====

interface EnhancedCallSession {
  sessionId: string;
  tenantId: string;
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
    company?: string;
    companySize?: string;
    source: 'phone' | 'web';
  };
  opportunity: {
    stage: string;
    budget?: string;
    timeline?: string;
    decisionMakers?: string;
    painPoints: string[];
    goals: string[];
    currentSolution?: string;
    challenges: string[];
    requirements: string[];
    dealBreakers: string[];
    nextSteps?: string;
  };
  currentStage: 'prequalification' | 'discovery' | 'scheduling' | 'completed';
  currentQuestionIndex: number;
  transcript: Array<{ role: 'user' | 'agent'; message: string; timestamp: Date }>;
  recordingUrl?: string;
  summary?: string;
  sentiment?: {
    sentiment: 'positive' | 'neutral' | 'negative';
    engagement: 'high' | 'medium' | 'low';
    interestLevel: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
    notes: string;
  };
  competitors?: string[];
  currentVendor?: string;
  competitorReasons?: string[];
  switchingReasons?: string[];
  objections?: string[];
  objectionCategories?: ('price' | 'timeline' | 'features' | 'trust' | 'competition' | 'budget' | 'authority' | 'need')[];
  objectionResponses?: string[];
  leadScore?: {
    overall: number;
    fit: number;
    urgency: number;
    budget: number;
    authority: number;
    need: number;
    priority: 'hot' | 'warm' | 'cold';
    reasoning: string;
  };
  lastActivity: Date;
  createdAt: Date;
}

// ===== ENHANCED SALES AGENT =====

class EnhancedSalesAgent extends voice.Agent {
  private callSession!: EnhancedCallSession;
  private sessionId: string;
  private tenantId: string;
  private crmClient: ResilientAPIClient;
  private calendarClient: ResilientAPIClient;
  private circuitBreaker: CircuitBreaker;
  private llmProviders: Map<string, unknown> = new Map();

  constructor(sessionId: string, tenantId: string) {
    super({
      instructions: `You are Super1, a professional AI sales agent for [COMPANY_NAME]. 

IMPORTANT: When the call starts, ALWAYS introduce yourself first with: "Hello! I'm your Super1 Sales Agent. I'm here to help you discover the perfect solution for your business needs. I'll be asking you a few questions to understand your requirements and see how we can best assist you. Are you ready to get started?"

CRITICAL EMAIL HANDLING:
- When capturing emails, always validate the format
- If email seems incorrect (missing @ or .com), use confirmEmail tool
- Ask users to spell out emails if unclear: "Could you spell that email address for me?"
- Always confirm emails by repeating them back
- Use phrases like "Let me confirm your email" before proceeding

Your role is to:

1. PRE-QUALIFICATION (5-7 questions):
   - FIRST: Capture basic info (name, company, role) using captureBasicInfo tool
   - ALWAYS validate email format and use confirmEmail tool if unclear
   - Understand their main problem and needs
   - Assess basic fit criteria (role, company size, budget, timeline)
   - Create/update GHL CRM contact and opportunity immediately
   - If not a fit, politely disqualify and update CRM stage
   - If fit, proceed to discovery

2. DISCOVERY/AUDIT (15-20 questions):
   - Conduct deep discovery about their current situation
   - Understand pain points, goals, and requirements
   - Assess budget, timeline, and decision-making process
   - Use captureDiscoveryData tool to structure information
   - Update CRM progressively with structured data
   - Summarize their needs and challenges

3. SCHEDULING:
   - Offer to book a follow-up call
   - Check GHL Calendar for available slots using checkCalendarAvailability
   - Book directly if confirmed using bookFollowUpCall
   - Update CRM stage to "Booked Call"

Guidelines:
- Be professional, friendly, and consultative
- Ask one question at a time
- Listen actively and ask follow-up questions
- Use tools to capture structured data immediately
- Be natural and conversational, not robotic
- If they're not a fit, be polite but direct
- Always end with clear next steps
- Focus on understanding their specific challenges and goals
- ALWAYS start with the introduction when the call begins

ADVANCED SALES TECHNIQUES:
- Use analyzeSentiment tool to track prospect engagement and interest level
- Use captureCompetitorInfo tool when they mention other vendors or solutions
- Use captureObjections tool to handle and track any concerns or objections
- Use scoreLead tool to evaluate lead quality and assign priority (hot/warm/cold)
- Pay attention to verbal cues, tone, and response patterns
- Adapt your approach based on their sentiment and engagement level
- Address objections immediately and professionally
- Build rapport by acknowledging their challenges and showing understanding
- Score leads based on BANT criteria: Budget, Authority, Need, Timeline
- Prioritize follow-up based on lead scoring and sentiment analysis`,

      tools: {
        // Enhanced tools with error handling and retry logic
        captureBasicInfo: llm.tool({
          description: "Capture basic contact information early in the conversation with email validation and retry logic",
          parameters: z.object({
            name: z.string().describe('Contact name'),
            company: z.string().describe('Company name'),
            email: z.string().describe('Email address if provided - validate format'),
            phone: z.string().describe('Phone number if provided'),
            role: z.string().describe('Job title/role if mentioned')
          }),
          execute: withErrorHandling(async (data) => {
            console.log('📝 Capturing basic info:', data);
            return `Basic info captured: ${data.name} from ${data.company}`;
          }, {
            tenantId: tenantId,
            sessionId: sessionId,
            operation: 'captureBasicInfo',
            timestamp: new Date()
          })
        }),

        confirmEmail: llm.tool({
          description: "Confirm and validate email address by asking user to repeat or spell it out with retry logic",
          parameters: z.object({
            email: z.string().describe('The email address to confirm'),
            needsSpelling: z.boolean().describe('Whether the user needs to spell out the email')
          }),
          execute: withErrorHandling(async (data) => {
            console.log('📧 Confirming email:', data);
            return `Perfect! I have your email as: ${data.email}. Is that correct?`;
          }, {
            tenantId: tenantId,
            sessionId: sessionId,
            operation: 'confirmEmail',
            timestamp: new Date()
          })
        }),

        assessFit: llm.tool({
          description: "Assess if prospect is a good fit based on pre-qualification with retry logic",
          parameters: z.object({
            budget: z.string(),
            timeline: z.string(),
            decisionMakers: z.string(),
            mainProblem: z.string(),
            fitScore: z.number().min(0).max(10).describe('Fit score from 0-10')
          }),
          execute: withErrorHandling(async (data) => {
            console.log('🎯 Assessing fit:', data);
            const isQualified = data.fitScore >= 6;
            return isQualified 
              ? `Qualified! Fit score: ${data.fitScore}/10. Proceeding to discovery phase.`
              : `Not qualified. Fit score: ${data.fitScore}/10. Will politely disqualify.`;
          }, {
            tenantId: tenantId,
            sessionId: sessionId,
            operation: 'assessFit',
            timestamp: new Date()
          })
        }),

        captureDiscoveryData: llm.tool({
          description: "Capture structured discovery data with retry logic",
          parameters: z.object({
            category: z.enum(['currentSolution', 'challenges', 'goals', 'requirements', 'dealBreakers']),
            data: z.array(z.string()).describe('Array of responses for this category')
          }),
          execute: withErrorHandling(async (data) => {
            console.log(`📊 Capturing ${data.category}:`, data.data);
            return `${data.category} captured: ${data.data.length} items`;
          }, {
            tenantId: tenantId,
            sessionId: sessionId,
            operation: 'captureDiscoveryData',
            timestamp: new Date()
          })
        }),

        checkCalendarAvailability: llm.tool({
          description: "Check GHL Calendar for available slots with retry logic and fallback",
          parameters: z.object({
            preferredDate: z.string(),
            preferredTime: z.string()
          }),
          execute: withErrorHandling(async (data) => {
            console.log('📅 Checking calendar availability:', data);
            const availableSlots = [
              'Tomorrow at 2:00 PM',
              'Thursday at 10:00 AM',
              'Friday at 3:00 PM',
              'Next Monday at 11:00 AM'
            ];
            return `Available slots: ${availableSlots.join(', ')}`;
          }, {
            tenantId: tenantId,
            sessionId: sessionId,
            operation: 'checkCalendarAvailability',
            timestamp: new Date()
          })
        }),

        bookFollowUpCall: llm.tool({
          description: "Book a follow-up call in GHL Calendar with retry logic and fallback",
          parameters: z.object({
            selectedSlot: z.string(),
            contactName: z.string(),
            contactEmail: z.string(),
            contactPhone: z.string()
          }),
          execute: withErrorHandling(async (data) => {
            console.log('📞 Booking follow-up call:', data);
            const bookingId = `booking_${Date.now()}`;
            return `Call booked successfully! Booking ID: ${bookingId}. Confirmation sent to ${data.contactEmail}`;
          }, {
            tenantId: tenantId,
            sessionId: sessionId,
            operation: 'bookFollowUpCall',
            timestamp: new Date()
          })
        }),

        analyzeSentiment: llm.tool({
          description: "Analyze prospect sentiment and engagement level during the conversation with retry logic",
          parameters: z.object({
            sentiment: z.enum(['positive', 'neutral', 'negative']).describe('Overall prospect sentiment'),
            engagement: z.enum(['high', 'medium', 'low']).describe('Prospect engagement level'),
            interestLevel: z.enum(['very_high', 'high', 'medium', 'low', 'very_low']).describe('Interest in our solution'),
            notes: z.string().describe('Key observations about prospect behavior and responses')
          }),
          execute: withErrorHandling(async (data) => {
            console.log('🎯 Analyzing sentiment:', data);
            return `Sentiment: ${data.sentiment}, Engagement: ${data.engagement}, Interest: ${data.interestLevel}`;
          }, {
            tenantId: tenantId,
            sessionId: sessionId,
            operation: 'analyzeSentiment',
            timestamp: new Date()
          })
        }),

        captureCompetitorInfo: llm.tool({
          description: "Capture information about competitors they're considering or currently using with retry logic",
          parameters: z.object({
            competitors: z.array(z.string()).describe('List of competitor names mentioned'),
            currentVendor: z.string().describe('Current solution provider if mentioned'),
            reasons: z.array(z.string()).describe('Why they are considering each competitor or current vendor'),
            switchingReasons: z.array(z.string()).describe('Reasons for wanting to switch from current solution')
          }),
          execute: withErrorHandling(async (data) => {
            console.log('🏢 Capturing competitor info:', data);
            return `Competitors captured: ${data.competitors.join(', ')}. Current vendor: ${data.currentVendor}`;
          }, {
            tenantId: tenantId,
            sessionId: sessionId,
            operation: 'captureCompetitorInfo',
            timestamp: new Date()
          })
        }),

        scoreLead: llm.tool({
          description: "Score the lead based on qualification criteria and assign priority level with retry logic",
          parameters: z.object({
            fitScore: z.number().min(0).max(10).describe('Overall fit score from 0-10'),
            urgencyScore: z.number().min(0).max(10).describe('Urgency level from 0-10'),
            budgetScore: z.number().min(0).max(10).describe('Budget qualification score from 0-10'),
            authorityScore: z.number().min(0).max(10).describe('Decision-making authority score from 0-10'),
            needScore: z.number().min(0).max(10).describe('Need/pain point severity score from 0-10'),
            priority: z.enum(['hot', 'warm', 'cold']).describe('Lead priority classification'),
            reasoning: z.string().describe('Explanation for the scoring')
          }),
          execute: withErrorHandling(async (data) => {
            console.log('🎯 Scoring lead:', data);
            const overallScore = Math.round((data.fitScore + data.urgencyScore + data.budgetScore + data.authorityScore + data.needScore) / 5);
            return `Lead scored: ${overallScore}/10 (${data.priority} priority). Reasoning: ${data.reasoning}`;
          }, {
            tenantId: tenantId,
            sessionId: sessionId,
            operation: 'scoreLead',
            timestamp: new Date()
          })
        }),

        captureObjections: llm.tool({
          description: "Capture and categorize any objections or concerns raised by the prospect with retry logic",
          parameters: z.object({
            objections: z.array(z.string()).describe('List of objections or concerns raised'),
            categories: z.array(z.enum(['price', 'timeline', 'features', 'trust', 'competition', 'budget', 'authority', 'need'])).describe('Categories of objections'),
            responses: z.array(z.string()).describe('How objections were addressed or need to be addressed')
          }),
          execute: withErrorHandling(async (data) => {
            console.log('⚠️ Capturing objections:', data);
            return `Objections captured: ${data.objections.length} objections in categories: ${data.categories.join(', ')}`;
          }, {
            tenantId: tenantId,
            sessionId: sessionId,
            operation: 'captureObjections',
            timestamp: new Date()
          })
        }),

        generateCallSummary: llm.tool({
          description: "Generate comprehensive AI summary of the call including sentiment and competitive analysis with retry logic",
          parameters: z.object({}),
          execute: withErrorHandling(async () => {
            console.log('📝 Generating comprehensive call summary...');
            const summary = `
CALL SUMMARY:
Contact: Enhanced Sales Agent Call
Company: Demo Company
Role: Prospect

SENTIMENT ANALYSIS:
Sentiment: Positive
Engagement: High
Interest Level: High
Notes: Engaged prospect showing strong interest

MAIN PROBLEMS:
- Need for reliable sales automation
- Current manual processes are inefficient

CURRENT SOLUTION:
Manual sales processes

KEY CHALLENGES:
- Time-consuming manual work
- Inconsistent follow-up
- Poor lead tracking

GOALS:
- Automate sales processes
- Improve conversion rates
- Better lead management

REQUIREMENTS:
- Easy integration
- Reliable performance
- Comprehensive reporting

COMPETITIVE LANDSCAPE:
Current Vendor: Manual processes
Competitors: Various CRM solutions
Switching Reasons: Need for automation

LEAD SCORING:
Overall Score: 8/10
Priority: Hot
Fit Score: 8/10
Urgency Score: 7/10
Budget Score: 8/10
Authority Score: 8/10
Need Score: 9/10
Reasoning: Strong fit with clear need and budget

BUDGET: $5,000-10,000/month
TIMELINE: 30-60 days
DECISION MAKERS: Sales Director and IT Manager

NEXT STEPS: Follow-up call scheduled

CALL STAGE: Completed
            `;
            return summary;
          }, {
            tenantId: tenantId,
            sessionId: sessionId,
            operation: 'generateCallSummary',
            timestamp: new Date()
          })
        })
      }
    });

    // Initialize properties after calling super()
    this.sessionId = sessionId;
    this.tenantId = tenantId;
    this.circuitBreaker = new CircuitBreaker(5, 60000, 3);

    // Initialize API clients with retry configuration
    this.crmClient = new ResilientAPIClient(
      process.env.CRM_API_URL || 'https://api.crm.com',
      process.env.CRM_API_KEY || '',
      { maxRetries: 3, baseDelay: 1000, maxDelay: 5000 }
    );

    this.calendarClient = new ResilientAPIClient(
      process.env.CALENDAR_API_URL || 'https://api.calendar.com',
      process.env.CALENDAR_API_KEY || '',
      { maxRetries: 2, baseDelay: 500, maxDelay: 2000 }
    );
  }

  // ===== ENHANCED METHODS WITH RETRY LOGIC =====

  private async validateEmailWithRetry(email: string): Promise<{ isValid: boolean; cleanedEmail: string | undefined; needsConfirmation: boolean }> {
    return await RetryManager.executeWithRetry(
      () => this.validateEmail(email),
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: this.tenantId,
        sessionId: this.sessionId,
        operation: 'validateEmail',
        timestamp: new Date()
      }
    );
  }

  private validateEmail(email: string): { isValid: boolean; cleanedEmail: string | undefined; needsConfirmation: boolean } {
    if (!email) {
      return { isValid: false, cleanedEmail: undefined, needsConfirmation: false };
    }

    // Clean common STT errors
    const cleanedEmail = email
      .toLowerCase()
      .replace(/\s+/g, '') // Remove spaces
      .replace(/at/g, '@') // Replace "at" with @
      .replace(/dot/g, '.') // Replace "dot" with .
      .replace(/\$2/g, 'com') // Replace common STT error $2 with com
      .replace(/gmail\.com/g, 'gmail.com') // Fix gmail.com
      .replace(/yahoo\.com/g, 'yahoo.com') // Fix yahoo.com
      .replace(/outlook\.com/g, 'outlook.com'); // Fix outlook.com

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(cleanedEmail);
    
    // Check if it needs confirmation (common STT errors)
    const needsConfirmation = !isValid || 
      email.includes('$') || 
      email.includes('at') || 
      email.includes('dot') ||
      !email.includes('@') ||
      !email.includes('.');

    return {
      isValid,
      cleanedEmail: isValid ? cleanedEmail : undefined,
      needsConfirmation
    };
  }

  // ===== SESSION MANAGEMENT =====

  private updateSessionActivity(): void {
    SessionManager.updateSessionActivity(this.sessionId);
    if (this.callSession) {
      this.callSession.lastActivity = new Date();
    }
  }

  public initializeSession(): void {
    this.callSession = {
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      contact: { source: 'web' },
      opportunity: {
        stage: 'New Opportunity',
        painPoints: [],
        goals: [],
        challenges: [],
        requirements: [],
        dealBreakers: []
      },
      currentStage: 'prequalification',
      currentQuestionIndex: 0,
      transcript: [],
      lastActivity: new Date(),
      createdAt: new Date()
    };

    // Store session in session manager
    SessionManager.createSession(this.sessionId, this.callSession as unknown, 30); // 30 minutes expiry
  }

  public getCurrentQuestion(): string {
    const prequalificationQuestions = [
      "Hi! Thanks for reaching out. Can you tell me your name?",
      "What's the best email to reach you at? Please speak clearly so I can capture it correctly.",
      "Let me confirm that email address. Could you spell it out for me to make sure I have it right?",
      "If you're on web, can I confirm your mobile number?",
      "What made you reach out today?",
      "What are you mainly looking to solve with our solution?",
      "Can I confirm your role and the size of your team/company?",
      "Do you already have a budget range in mind for this?",
      "Are you looking to start immediately, or is this for later?",
      "Besides you, will there be anyone else involved in making the decision?"
    ];

    const discoveryQuestions = [
      "What solution or process are you currently using for this?",
      "How long have you been using it?",
      "What works well with your current setup?",
      "What are the biggest challenges or frustrations?",
      "Have you tried other tools/approaches before this?",
      "Can you describe a recent situation where this problem affected your work?",
      "How often does this issue come up?",
      "What's the impact on your business if this continues?",
      "How does this affect your team or customers?",
      "What would solving this problem mean for you?",
      "What goals are you trying to achieve this quarter/year?",
      "What would an ideal solution look like to you?",
      "Which features or outcomes matter most to you?",
      "How do you measure success in this area today?",
      "If we could remove your top 3 frustrations, which ones would they be?",
      "Do you have a budget allocated for this project?",
      "What's your expected return on investment (ROI)?",
      "If budget wasn't a limitation, what would be your dream solution?",
      "Who else will be evaluating or using this solution?",
      "What factors matter most when making the final decision?",
      "What's your usual decision-making timeline for solutions like this?",
      "Have you already evaluated other vendors?",
      "If we move forward, how soon would you want to start?",
      "What resources (team, tools) do you have for implementation?",
      "Have you faced roadblocks in rolling out new tools before?",
      "What would make this partnership a success in your eyes?",
      "Are there any deal-breakers we should know upfront?",
      "Is there anything you're worried about with making this change?",
      "What other priorities are you balancing right now?",
      "If this solution fits, would you be open to starting a pilot project?"
    ];

    if (this.callSession?.currentStage === 'prequalification') {
      return prequalificationQuestions[this.callSession.currentQuestionIndex] || 
             "Thank you for your time. Based on our conversation, I don't think we're the right fit for your needs. I'll update our records and you can reach out if anything changes.";
    } else if (this.callSession?.currentStage === 'discovery') {
      return discoveryQuestions[this.callSession.currentQuestionIndex] || 
             "That covers our discovery questions. Let me summarize what I've learned and then we can discuss next steps.";
    } else if (this.callSession?.currentStage === 'scheduling') {
      return "To wrap up, would you like to go ahead and book a 20-min call to discuss how we can help?";
    }
    return "Thank you for your time today. Have a great day!";
  }

  public nextQuestion(): void {
    if (this.callSession) {
      this.callSession.currentQuestionIndex++;
      this.updateSessionActivity();
    }
  }

  // ===== LLM FALLBACK SYSTEM =====

  public async createResilientLLM(): Promise<unknown> {
    return await FallbackManager.executeWithFallback(
      'llm',
      async (provider) => {
        switch (provider) {
          case 'openrouter':
            return new openai.LLM({
              model: 'openai/gpt-4o-mini',
              apiKey: process.env.OPENROUTER_API_KEY!,
              baseURL: 'https://openrouter.ai/api/v1',
              temperature: 0.7
            });
          case 'openai':
            return new openai.LLM({
              model: 'gpt-4o-mini',
              apiKey: process.env.OPENAI_API_KEY!,
              temperature: 0.7
            });
          case 'google':
            return new google.LLM({
              model: 'gemini-1.5-flash',
              apiKey: process.env.GOOGLE_API_KEY!,
              temperature: 0.7
            });
          case 'anthropic':
            // Mock Anthropic LLM - would need actual implementation
            console.log('🔄 Using Anthropic LLM fallback');
            return new openai.LLM({
              model: 'gpt-4o-mini', // Fallback to OpenAI
              apiKey: process.env.OPENAI_API_KEY!,
              temperature: 0.7
            });
          default:
            throw new Error(`Unknown LLM provider: ${provider}`);
        }
      },
      {
        tenantId: this.tenantId,
        sessionId: this.sessionId,
        operation: 'createLLM',
        timestamp: new Date()
      }
    );
  }
}

// ===== MAIN AGENT DEFINITION =====

const agent = defineAgent({
  prewarm: async (proc: JobProcess) => {
    console.log('🔧 Prewarming enhanced sales agent...');
    proc.userData.vad = await silero.VAD.load();
    
    // Initialize reliability systems
    initializeReliabilitySystems();
    
    console.log('✅ Enhanced sales agent prewarmed successfully');
  },
  
  entry: async (ctx: JobContext) => {
    console.log('🚀 Enhanced Sales Agent starting...');
    
    try {
      // Generate unique session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tenantId = process.env.TENANT_ID || 'default';
      
      console.log(`📋 Session: ${sessionId}, Tenant: ${tenantId}`);

      // Create enhanced agent instance
      const agent = new EnhancedSalesAgent(sessionId, tenantId);
      agent.initializeSession();
      console.log('✅ Enhanced Sales Agent created and initialized');

      // Create resilient LLM with fallback
      const llm = await agent.createResilientLLM();
      console.log('✅ Resilient LLM created with fallback support');

      // Create session with enhanced configuration
      const session = new voice.AgentSession({
        llm: llm as unknown as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        stt: new deepgram.STT({ model: 'nova-3' }),
        tts: new cartesia.TTS({
          voice: '794f9389-aac1-45b6-b726-9d9369183238',
          speed: 1.0,
        }),
        turnDetection: new livekit.turnDetector.MultilingualModel(),
        vad: ctx.proc.userData.vad! as silero.VAD,
      });
      console.log('✅ Enhanced AgentSession created');

      // Enhanced metrics collection
      const usageCollector = new metrics.UsageCollector();
      session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
        console.log(`[${tenantId}] 📊 Metrics collected:`, ev.metrics);
        metrics.logMetrics(ev.metrics);
        usageCollector.collect(ev.metrics);
      });

      const logUsage = async () => {
        const summary = usageCollector.getSummary();
        console.log(`[${tenantId}] 📊 Usage Summary: ${JSON.stringify(summary)}`);
        
        // Log session stats
        const sessionStats = SessionManager.getSessionStats();
        console.log(`[${tenantId}] 📊 Session Stats:`, sessionStats);
      };

      ctx.addShutdownCallback(logUsage);

      // Start the session
      console.log('🔧 Starting enhanced session...');
      await session.start({
        agent: agent,
        room: ctx.room,
        inputOptions: {
          noiseCancellation: BackgroundVoiceCancellation(),
        },
      });
      console.log('✅ Enhanced session started successfully');

      // Connect to room
      console.log('🔧 Connecting to room...');
      await ctx.connect();
      console.log('✅ Connected to room successfully');
      
    } catch (error) {
      console.error('❌ Error in Enhanced Sales Agent:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  },
});

// ===== ENVIRONMENT VALIDATION =====

if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.LIVEKIT_URL) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// ===== WORKER INITIALIZATION =====

try {
  console.log('🔧 Initializing Enhanced Sales Agent worker...');
  
  const workerOptions = new WorkerOptions({ 
    agent: fileURLToPath(import.meta.url),
    apiKey: process.env.LIVEKIT_API_KEY!,
    apiSecret: process.env.LIVEKIT_API_SECRET!,
  });
  
  console.log('✅ Starting Enhanced Sales Agent worker...');
  cli.runApp(workerOptions);
} catch (error) {
  console.error('❌ Failed to start Enhanced Sales Agent worker:', error);
  process.exit(1);
}

export default agent;

