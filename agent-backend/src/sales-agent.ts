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
import * as livekit from '@livekit/agents-plugin-livekit';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: '.env' });

// CRM Pipeline Stages
enum CRMStage {
  NEW_OPPORTUNITY = 'New Opportunity',
  PREQUALIFIED = 'Prequalified',
  DISCOVERY = 'Discovery',
  DISCOVERY_DONE = 'Discovery Done',
  BOOKED_CALL = 'Booked Call'
}

// Contact and Opportunity Data
interface ContactData {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  company?: string;
  companySize?: string;
  source: 'phone' | 'web';
}

interface OpportunityData {
  stage: CRMStage;
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
}

interface CallSession {
  contact: ContactData;
  opportunity: OpportunityData;
  currentStage: 'prequalification' | 'discovery' | 'scheduling' | 'completed';
  currentQuestionIndex: number;
  transcript: Array<{ role: 'user' | 'agent'; message: string; timestamp: Date }>;
  recordingUrl?: string;
  summary?: string;
  // Sentiment analysis
  sentiment?: {
    sentiment: 'positive' | 'neutral' | 'negative';
    engagement: 'high' | 'medium' | 'low';
    interestLevel: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
    notes: string;
  };
  // Competitive intelligence
  competitors?: string[];
  currentVendor?: string;
  competitorReasons?: string[];
  switchingReasons?: string[];
  // Objection handling
  objections?: string[];
  objectionCategories?: ('price' | 'timeline' | 'features' | 'trust' | 'competition' | 'budget' | 'authority' | 'need')[];
  objectionResponses?: string[];
  // Lead scoring
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
}

class Super1SalesAgent extends voice.Agent {
  private callSession!: CallSession;
  private prequalificationQuestions = [
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

  private discoveryQuestions = [
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

  constructor() {
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
        // Pre-qualification tools
        captureBasicInfo: llm.tool({
          description: "Capture basic contact information early in the conversation with email validation",
          parameters: z.object({
            name: z.string().describe('Contact name'),
            company: z.string().describe('Company name'),
            email: z.string().describe('Email address if provided - validate format'),
            phone: z.string().describe('Phone number if provided'),
            role: z.string().describe('Job title/role if mentioned')
          }),
          execute: async (data) => {
            console.log('📝 Capturing basic info:', data);

            // Validate and clean email
            let emailStatus = '';
            let finalEmail = data.email;
            
            if (data.email) {
              const emailValidation = this.validateEmail(data.email);
              
              if (emailValidation.isValid && emailValidation.cleanedEmail) {
                finalEmail = emailValidation.cleanedEmail;
                emailStatus = ' (Email validated and cleaned)';
              } else if (emailValidation.needsConfirmation) {
                emailStatus = ' (Email needs confirmation - use confirmEmail tool)';
              } else {
                emailStatus = ' (Invalid email format)';
              }
            }

            // Update session data
            this.callSession.contact.name = data.name;
            this.callSession.contact.company = data.company;
            this.callSession.contact.email = finalEmail;
            this.callSession.contact.phone = data.phone;
            this.callSession.contact.role = data.role;

            await this.updateGHLContact();
            
            return `Basic info captured: ${data.name} from ${data.company}${emailStatus}`;
          }
        }),

        confirmEmail: llm.tool({
          description: "Confirm and validate email address by asking user to repeat or spell it out",
          parameters: z.object({
            email: z.string().describe('The email address to confirm'),
            needsSpelling: z.boolean().describe('Whether the user needs to spell out the email')
          }),
          execute: async (data) => {
            console.log('📧 Confirming email:', data);

            // Validate and clean the email
            const emailValidation = this.validateEmail(data.email);
            let finalEmail = data.email;
            let responseMessage = '';

            if (emailValidation.isValid && emailValidation.cleanedEmail) {
              finalEmail = emailValidation.cleanedEmail;
              responseMessage = `Perfect! I have your email as: ${finalEmail}. Is that correct?`;
            } else if (data.needsSpelling) {
              responseMessage = `I want to make sure I have your email correct. Could you please spell it out letter by letter?`;
            } else {
              responseMessage = `I heard: ${data.email}. Let me confirm - could you spell that email address for me?`;
            }

            // Update session with confirmed email
            this.callSession.contact.email = finalEmail;
            await this.updateGHLContact();

            return responseMessage;
          }
        }),

        captureContactInfo: llm.tool({
          description: "Capture and validate contact information",
          parameters: z.object({
            name: z.string(),
            email: z.string().email(),
            phone: z.string(),
            role: z.string(),
            companySize: z.string()
          }),
          execute: async (data) => {
            console.log('📝 Capturing contact info:', data);
            
            // Update session data
            if (data.name) this.callSession.contact.name = data.name;
            if (data.email) this.callSession.contact.email = data.email;
            if (data.phone) this.callSession.contact.phone = data.phone;
            if (data.role) this.callSession.contact.role = data.role;
            if (data.companySize) this.callSession.contact.companySize = data.companySize;

            // Create/update GHL CRM contact
            await this.updateGHLContact();
            
            return `Contact information captured: ${data.name || 'Name pending'}, ${data.email || 'Email pending'}`;
          }
        }),

        assessFit: llm.tool({
          description: "Assess if prospect is a good fit based on pre-qualification",
          parameters: z.object({
            budget: z.string(),
            timeline: z.string(),
            decisionMakers: z.string(),
            mainProblem: z.string(),
            fitScore: z.number().min(0).max(10).describe('Fit score from 0-10')
          }),
          execute: async (data) => {
            console.log('🎯 Assessing fit:', data);
            
            // Update opportunity data
            this.callSession.opportunity.budget = data.budget;
            this.callSession.opportunity.timeline = data.timeline;
            this.callSession.opportunity.decisionMakers = data.decisionMakers;
            this.callSession.opportunity.painPoints.push(data.mainProblem);

            // Determine if qualified
            const isQualified = data.fitScore >= 6;
            
            if (isQualified) {
              this.callSession.opportunity.stage = CRMStage.PREQUALIFIED;
              this.callSession.currentStage = 'discovery';
              await this.updateGHLOpportunity();
              return `Qualified! Fit score: ${data.fitScore}/10. Proceeding to discovery phase.`;
            } else {
              this.callSession.opportunity.stage = CRMStage.NEW_OPPORTUNITY;
              await this.updateGHLOpportunity();
              return `Not qualified. Fit score: ${data.fitScore}/10. Will politely disqualify.`;
            }
          }
        }),

        // Discovery tools
        captureDiscoveryData: llm.tool({
          description: "Capture structured discovery data",
          parameters: z.object({
            category: z.enum(['currentSolution', 'challenges', 'goals', 'requirements', 'dealBreakers']),
            data: z.array(z.string()).describe('Array of responses for this category')
          }),
          execute: async (data) => {
            console.log(`📊 Capturing ${data.category}:`, data.data);
            
            // Update opportunity data based on category
            switch (data.category) {
              case 'currentSolution':
                this.callSession.opportunity.currentSolution = data.data[0] as string;
                break;
              case 'challenges':
                this.callSession.opportunity.challenges.push(...data.data);
                break;
              case 'goals':
                this.callSession.opportunity.goals.push(...data.data);
                break;
              case 'requirements':
                this.callSession.opportunity.requirements.push(...data.data);
                break;
              case 'dealBreakers':
                this.callSession.opportunity.dealBreakers.push(...data.data);
                break;
            }

            // Update GHL CRM progressively
            await this.updateGHLOpportunity();
            
            return `${data.category} captured: ${data.data.length} items`;
          }
        }),

        // Scheduling tools
        checkCalendarAvailability: llm.tool({
          description: "Check GHL Calendar for available slots",
          parameters: z.object({
            preferredDate: z.string(),
            preferredTime: z.string()
          }),
          execute: async (data) => {
            console.log('📅 Checking calendar availability:', data);
            
            // Mock calendar check - in real implementation, call GHL Calendar API
            const availableSlots = [
              'Tomorrow at 2:00 PM',
              'Thursday at 10:00 AM',
              'Friday at 3:00 PM',
              'Next Monday at 11:00 AM'
            ];
            
            return `Available slots: ${availableSlots.join(', ')}`;
          }
        }),

        bookFollowUpCall: llm.tool({
          description: "Book a follow-up call in GHL Calendar",
          parameters: z.object({
            selectedSlot: z.string(),
            contactName: z.string(),
            contactEmail: z.string(),
            contactPhone: z.string()
          }),
          execute: async (data) => {
            console.log('📞 Booking follow-up call:', data);
            
            // Mock booking - in real implementation, call GHL Calendar API
            const bookingId = `booking_${Date.now()}`;
            
            // Update CRM stage
            this.callSession.opportunity.stage = CRMStage.BOOKED_CALL;
            this.callSession.opportunity.nextSteps = `Follow-up call booked for ${data.selectedSlot}`;
            this.callSession.currentStage = 'completed';
            
            await this.updateGHLOpportunity();
            
            return `Call booked successfully! Booking ID: ${bookingId}. Confirmation sent to ${data.contactEmail}`;
          }
        }),


        // Session management
        addToTranscript: llm.tool({
          description: "Add message to call transcript",
          parameters: z.object({
            role: z.enum(['user', 'agent']),
            message: z.string()
          }),
          execute: async (data) => {
            this.callSession.transcript.push({
              role: data.role,
              message: data.message,
              timestamp: new Date()
            });
            
            return 'Added to transcript';
          }
        }),

        // Sentiment and engagement analysis
        analyzeSentiment: llm.tool({
          description: "Analyze prospect sentiment and engagement level during the conversation",
          parameters: z.object({
            sentiment: z.enum(['positive', 'neutral', 'negative']).describe('Overall prospect sentiment'),
            engagement: z.enum(['high', 'medium', 'low']).describe('Prospect engagement level'),
            interestLevel: z.enum(['very_high', 'high', 'medium', 'low', 'very_low']).describe('Interest in our solution'),
            notes: z.string().describe('Key observations about prospect behavior and responses')
          }),
          execute: async (data) => {
            console.log('🎯 Analyzing sentiment:', data);
            
            // Store sentiment data in session for summary
            this.callSession.sentiment = {
              sentiment: data.sentiment,
              engagement: data.engagement,
              interestLevel: data.interestLevel,
              notes: data.notes
            };
            
            // Update CRM with sentiment data
            await this.updateGHLOpportunity();
            
            return `Sentiment: ${data.sentiment}, Engagement: ${data.engagement}, Interest: ${data.interestLevel}`;
          }
        }),

        // Competitive intelligence
        captureCompetitorInfo: llm.tool({
          description: "Capture information about competitors they're considering or currently using",
          parameters: z.object({
            competitors: z.array(z.string()).describe('List of competitor names mentioned'),
            currentVendor: z.string().describe('Current solution provider if mentioned'),
            reasons: z.array(z.string()).describe('Why they are considering each competitor or current vendor'),
            switchingReasons: z.array(z.string()).describe('Reasons for wanting to switch from current solution')
          }),
          execute: async (data) => {
            console.log('🏢 Capturing competitor info:', data);

            // Store competitive intelligence
            this.callSession.competitors = data.competitors;
            this.callSession.currentVendor = data.currentVendor;
            this.callSession.competitorReasons = data.reasons;
            this.callSession.switchingReasons = data.switchingReasons;
            
            // Update CRM with competitive data
            await this.updateGHLOpportunity();
            
            return `Competitors captured: ${data.competitors.join(', ')}. Current vendor: ${data.currentVendor}`;
          }
        }),
        scoreLead: llm.tool({
          description: "Score the lead based on qualification criteria and assign priority level",
          parameters: z.object({
            fitScore: z.number().min(0).max(10).describe('Overall fit score from 0-10'),
            urgencyScore: z.number().min(0).max(10).describe('Urgency level from 0-10'),
            budgetScore: z.number().min(0).max(10).describe('Budget qualification score from 0-10'),
            authorityScore: z.number().min(0).max(10).describe('Decision-making authority score from 0-10'),
            needScore: z.number().min(0).max(10).describe('Need/pain point severity score from 0-10'),
            priority: z.enum(['hot', 'warm', 'cold']).describe('Lead priority classification'),
            reasoning: z.string().describe('Explanation for the scoring')
          }),
          execute: async (data) => {
            console.log('🎯 Scoring lead:', data);
            
            // Calculate overall score
            const overallScore = Math.round((data.fitScore + data.urgencyScore + data.budgetScore + data.authorityScore + data.needScore) / 5);
            
            // Store scoring data
            this.callSession.leadScore = {
              overall: overallScore,
              fit: data.fitScore,
              urgency: data.urgencyScore,
              budget: data.budgetScore,
              authority: data.authorityScore,
              need: data.needScore,
              priority: data.priority,
              reasoning: data.reasoning
            };
            
            // Update CRM with lead score
            await this.updateGHLOpportunity();
            
            return `Lead scored: ${overallScore}/10 (${data.priority} priority). Reasoning: ${data.reasoning}`;
          }
        }),

        // Objection handling
        captureObjections: llm.tool({
          description: "Capture and categorize any objections or concerns raised by the prospect",
          parameters: z.object({
            objections: z.array(z.string()).describe('List of objections or concerns raised'),
            categories: z.array(z.enum(['price', 'timeline', 'features', 'trust', 'competition', 'budget', 'authority', 'need'])).describe('Categories of objections'),
            responses: z.array(z.string()).describe('How objections were addressed or need to be addressed')
          }),
          execute: async (data) => {
            console.log('⚠️ Capturing objections:', data);
            
            // Store objection data
            this.callSession.objections = data.objections;
            this.callSession.objectionCategories = data.categories;
            this.callSession.objectionResponses = data.responses;
            
            // Update CRM with objection data
            await this.updateGHLOpportunity();
            
            return `Objections captured: ${data.objections.length} objections in categories: ${data.categories.join(', ')}`;
          }
        }),

        generateCallSummary: llm.tool({
          description: "Generate comprehensive AI summary of the call including sentiment and competitive analysis",
          parameters: z.object({}),
          execute: async () => {
            console.log('📝 Generating comprehensive call summary...');
            
            const summary = `
CALL SUMMARY:
Contact: ${this.callSession.contact.name || 'Not captured'} (${this.callSession.contact.email || 'Not captured'})
Company: ${this.callSession.contact.company || 'Not captured'} (${this.callSession.contact.companySize || 'Size not specified'} team)
Role: ${this.callSession.contact.role || 'Not specified'}

SENTIMENT ANALYSIS:
Sentiment: ${this.callSession.sentiment?.sentiment || 'Not analyzed'}
Engagement: ${this.callSession.sentiment?.engagement || 'Not analyzed'}
Interest Level: ${this.callSession.sentiment?.interestLevel || 'Not analyzed'}
Notes: ${this.callSession.sentiment?.notes || 'No notes'}

MAIN PROBLEMS:
${this.callSession.opportunity.painPoints.length > 0 ? this.callSession.opportunity.painPoints.join('\n- ') : 'Not specified'}

CURRENT SOLUTION:
${this.callSession.opportunity.currentSolution || 'Not specified'}

KEY CHALLENGES:
${this.callSession.opportunity.challenges.length > 0 ? this.callSession.opportunity.challenges.join('\n- ') : 'Not specified'}

GOALS:
${this.callSession.opportunity.goals.length > 0 ? this.callSession.opportunity.goals.join('\n- ') : 'Not specified'}

REQUIREMENTS:
${this.callSession.opportunity.requirements.length > 0 ? this.callSession.opportunity.requirements.join('\n- ') : 'Not specified'}

DEAL BREAKERS:
${this.callSession.opportunity.dealBreakers.length > 0 ? this.callSession.opportunity.dealBreakers.join('\n- ') : 'Not specified'}

COMPETITIVE LANDSCAPE:
Current Vendor: ${this.callSession.currentVendor || 'Not specified'}
Competitors: ${(this.callSession.competitors && this.callSession.competitors.length > 0) ? this.callSession.competitors.join(', ') : 'Not mentioned'}
Competitor Reasons: ${(this.callSession.competitorReasons && this.callSession.competitorReasons.length > 0) ? this.callSession.competitorReasons.join('\n- ') : 'Not specified'}
Switching Reasons: ${(this.callSession.switchingReasons && this.callSession.switchingReasons.length > 0) ? this.callSession.switchingReasons.join('\n- ') : 'Not specified'}

OBJECTIONS & CONCERNS:
${Array.isArray(this.callSession.objections) && this.callSession.objections.length > 0 ? this.callSession.objections.join('\n- ') : 'No objections raised'}
Categories: ${Array.isArray(this.callSession.objectionCategories) && this.callSession.objectionCategories.length > 0 ? this.callSession.objectionCategories.join(', ') : 'None'}
Responses: ${Array.isArray(this.callSession.objectionResponses) && this.callSession.objectionResponses.length > 0 ? this.callSession.objectionResponses.join('\n- ') : 'None'}

LEAD SCORING:
Overall Score: ${this.callSession.leadScore?.overall || 'Not scored'}/10
Priority: ${this.callSession.leadScore?.priority || 'Not classified'}
Fit Score: ${this.callSession.leadScore?.fit || 'Not scored'}/10
Urgency Score: ${this.callSession.leadScore?.urgency || 'Not scored'}/10
Budget Score: ${this.callSession.leadScore?.budget || 'Not scored'}/10
Authority Score: ${this.callSession.leadScore?.authority || 'Not scored'}/10
Need Score: ${this.callSession.leadScore?.need || 'Not scored'}/10
Reasoning: ${this.callSession.leadScore?.reasoning || 'No reasoning provided'}

BUDGET: ${this.callSession.opportunity.budget || 'Not specified'}
TIMELINE: ${this.callSession.opportunity.timeline || 'Not specified'}
DECISION MAKERS: ${this.callSession.opportunity.decisionMakers || 'Not specified'}

NEXT STEPS: ${this.callSession.opportunity.nextSteps || 'Follow-up required'}

CALL STAGE: ${this.callSession.opportunity.stage}
            `;
            
            this.callSession.summary = summary;
            
            // Attach summary to GHL CRM
            await this.attachToGHL();
            
            return summary;
          }
        }),

      }
    });
  }

  // Method to send quota alerts to frontend
  public async sendQuotaAlert(message: string, ctx: JobContext) {
    try {
      if (ctx.room && ctx.room.localParticipant) {
        await ctx.room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({
            type: 'quota_alert',
            message: message,
            timestamp: new Date().toISOString(),
            severity: 'error'
          })),
          { destination_identities: [] } // Send to all participants
        );
        console.log('🚨 Quota alert sent to frontend:', message);
      }
    } catch (error) {
      console.error('Failed to send quota alert:', error);
    }
  }

  // Method to create OpenRouter LLM
  public createOpenRouterLLM() {
    try {
      const openRouterLLM = new openai.LLM({
        model: 'openai/gpt-4o-mini',
        apiKey: process.env.OPENROUTER_API_KEY!,
        baseURL: 'https://openrouter.ai/api/v1',
        temperature: 0.7
      });
      
      console.log('✅ OpenRouter LLM created successfully');
      return openRouterLLM;
    } catch (error) {
      console.error('❌ Failed to create OpenRouter LLM:', error);
      return null;
    }
  }

  // Method to handle quota exceeded scenarios (OpenRouter handles this automatically)
  public async handleQuotaExceeded(ctx: JobContext) {
    await this.sendQuotaAlert(
      '⚠️ AI service experiencing issues. Please try again.',
      ctx
    );
    
    console.log('OpenRouter quota exceeded - fallback message sent');
  }

  // Initialize session
  public initializeSession() {
    this.callSession = {
      contact: { source: 'web' },
      opportunity: {
        stage: CRMStage.NEW_OPPORTUNITY,
        painPoints: [],
        goals: [],
        challenges: [],
        requirements: [],
        dealBreakers: []
      },
      currentStage: 'prequalification',
      currentQuestionIndex: 0,
      transcript: []
    };
  }


  // Get current question based on stage
  getCurrentQuestion(): string {
    if (this.callSession.currentStage === 'prequalification') {
      return this.prequalificationQuestions[this.callSession.currentQuestionIndex] || 
             "Thank you for your time. Based on our conversation, I don't think we're the right fit for your needs. I'll update our records and you can reach out if anything changes.";
    } else if (this.callSession.currentStage === 'discovery') {
      return this.discoveryQuestions[this.callSession.currentQuestionIndex] || 
             "That covers our discovery questions. Let me summarize what I've learned and then we can discuss next steps.";
    } else if (this.callSession.currentStage === 'scheduling') {
      return "To wrap up, would you like to go ahead and book a 20-min call to discuss how we can help?";
    }
    return "Thank you for your time today. Have a great day!";
  }


  // Move to next question
  nextQuestion(): void {
    this.callSession.currentQuestionIndex++;
  }

  // Helper method to validate and clean email addresses
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

  // GHL CRM integration methods
  private async updateGHLContact(): Promise<void> {
    // Mock implementation - in real app, call GHL API
    console.log('🔄 Updating GHL contact:', this.callSession.contact);
  }

  private async updateGHLOpportunity(): Promise<void> {
    // Mock implementation - in real app, call GHL API
    console.log('🔄 Updating GHL opportunity:', this.callSession.opportunity);
  }

  private async attachToGHL(): Promise<void> {
    // Mock implementation - in real app, attach transcript, recording, and summary to GHL
    console.log('📎 Attaching files to GHL CRM');
  }
}

const agent = defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  
  entry: async (ctx: JobContext) => {
    console.log('🚀 Super1 Sales Agent starting...');
    console.log('📋 Job Context:', {
      room: ctx.room?.name,
      participant: ctx.room?.localParticipant?.identity
    });
    
    try {
      // Create and initialize agent first
      console.log('🔧 Creating Super1SalesAgent instance...');
      const agent = new Super1SalesAgent();
      console.log('✅ Super1SalesAgent created');
      
      console.log('🔧 Initializing session...');
      agent.initializeSession();
      console.log('✅ Session initialized');

      // Initialize OpenRouter LLM
      console.log('🔧 Initializing OpenRouter LLM...');
      const llm = agent.createOpenRouterLLM();
      if (!llm) {
        throw new Error('OpenRouter LLM not available - check OPENROUTER_API_KEY');
      }
      console.log('✅ OpenRouter LLM initialized successfully');

      console.log('🔧 Creating AgentSession...');
      const session = new voice.AgentSession({
        llm: llm,
        stt: new deepgram.STT({ model: 'nova-3' }),
        tts: new cartesia.TTS({
          voice: '794f9389-aac1-45b6-b726-9d9369183238',
          // Add voice customization options
          speed: 1.0,        // Speech speed (0.5 to 2.0)
          // Note: stability, clarity, style are not available in current Cartesia version
        }),
        turnDetection: new livekit.turnDetector.MultilingualModel(),
        vad: ctx.proc.userData.vad! as silero.VAD,
      });
      console.log('✅ AgentSession created');

      // Metrics collection
      console.log('🔧 Setting up metrics collection...');
      const usageCollector = new metrics.UsageCollector();
      session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
        console.log('📊 Metrics collected:', ev.metrics);
        metrics.logMetrics(ev.metrics);
        usageCollector.collect(ev.metrics);
      });

      const logUsage = async () => {
        const summary = usageCollector.getSummary();
        console.log(`📊 Usage Summary: ${JSON.stringify(summary)}`);
      };

      ctx.addShutdownCallback(logUsage);
      console.log('✅ Metrics collection setup complete');

      // Add event listeners for debugging (same as working agent.ts)
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

      // Agent metadata will be set automatically by LiveKit

      console.log('🚀 Super1 Sales Agent connected to room');
      console.log('🔧 Connecting to room...');
      await ctx.connect();
      console.log('✅ Connected to room successfully');
      
    } catch (error) {
      console.error('❌ Error in Super1 Sales Agent:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
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
  console.log('🔧 Initializing Super1 Sales Agent worker...');
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
  
  console.log('✅ Worker options created, starting Super1 Sales Agent worker...');
  cli.runApp(workerOptions);
} catch (error) {
  console.error('❌ Failed to start Super1 Sales Agent worker:', error);
  console.error('Error details:', error);
  console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
  process.exit(1);
}

// Export the agent as default
export default agent;

