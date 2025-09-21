/**
 * Workflow Engine - Shared Service
 * Handles business logic and workflow orchestration
 */

import { WorkflowStep, AgentResponse, SessionContext } from './types.js';

export class WorkflowEngine {
  private workflows: Map<string, WorkflowStep[]> = new Map();
  private sessionContexts: Map<string, SessionContext> = new Map();

  constructor() {
    this.initializeDefaultWorkflows();
  }

  /**
   * Initialize default business workflows
   */
  private initializeDefaultWorkflows() {
    // Lead Qualification Workflow
    this.workflows.set('lead-qualification', [
      {
        id: 'qualify-lead',
        name: 'Qualify Lead',
        description: 'Assess lead quality and readiness',
        action: 'assess_lead_quality',
        parameters: {
          criteria: ['budget', 'authority', 'need', 'timeline'],
          scoring: { high: 8, medium: 5, low: 2 }
        },
        nextSteps: ['schedule-demo', 'send-info', 'nurture-lead'],
        conditions: {
          high: 'schedule-demo',
          medium: 'send-info',
          low: 'nurture-lead'
        }
      },
      {
        id: 'schedule-demo',
        name: 'Schedule Demo',
        description: 'Book a product demonstration',
        action: 'create_calendar_event',
        parameters: {
          duration: 30,
          type: 'demo',
          followUp: true
        },
        nextSteps: ['send-confirmation', 'prepare-demo']
      }
    ]);

    // Customer Onboarding Workflow
    this.workflows.set('customer-onboarding', [
      {
        id: 'welcome-customer',
        name: 'Welcome New Customer',
        description: 'Send welcome package and setup instructions',
        action: 'send_welcome_package',
        parameters: {
          package: 'onboarding',
          timeline: 'immediate'
        },
        nextSteps: ['schedule-kickoff', 'assign-success-manager']
      },
      {
        id: 'schedule-kickoff',
        name: 'Schedule Kickoff Call',
        description: 'Book initial setup call',
        action: 'create_calendar_event',
        parameters: {
          duration: 60,
          type: 'kickoff',
          attendees: ['customer', 'success-manager']
        },
        nextSteps: ['send-agenda', 'prepare-materials']
      }
    ]);

    // Support Ticket Workflow
    this.workflows.set('support-ticket', [
      {
        id: 'categorize-ticket',
        name: 'Categorize Support Ticket',
        description: 'Classify ticket type and priority',
        action: 'categorize_ticket',
        parameters: {
          categories: ['technical', 'billing', 'feature-request', 'bug'],
          priorities: ['critical', 'high', 'medium', 'low']
        },
        nextSteps: ['assign-agent', 'escalate', 'auto-resolve'],
        conditions: {
          critical: 'escalate',
          high: 'assign-agent',
          medium: 'assign-agent',
          low: 'auto-resolve'
        }
      }
    ]);

    // Sales Follow-up Workflow
    this.workflows.set('sales-followup', [
      {
        id: 'analyze-interaction',
        name: 'Analyze Sales Interaction',
        description: 'Review meeting notes and determine next steps',
        action: 'analyze_meeting_notes',
        parameters: {
          sentiment: true,
          keyPoints: true,
          objections: true,
          nextSteps: true
        },
        nextSteps: ['send-proposal', 'schedule-followup', 'nurture']
      },
      {
        id: 'send-proposal',
        name: 'Send Proposal',
        description: 'Generate and send customized proposal',
        action: 'generate_proposal',
        parameters: {
          template: 'standard',
          customization: true,
          pricing: 'dynamic'
        },
        nextSteps: ['schedule-review', 'follow-up']
      }
    ]);
  }

  /**
   * Execute a workflow step
   */
  async executeStep(
    workflowId: string,
    stepId: string,
    context: SessionContext,
    parameters: Record<string, any> = {}
  ): Promise<AgentResponse> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return {
        success: false,
        message: `Workflow ${workflowId} not found`,
        confidence: 0.0,
        metadata: {
          agentType: 'WorkflowEngine',
          timestamp: new Date().toISOString(),
          processingTime: 0,
          toolsUsed: []
        }
      };
    }

    const step = workflow.find(s => s.id === stepId);
    if (!step) {
      return {
        success: false,
        message: `Step ${stepId} not found in workflow ${workflowId}`,
        confidence: 0.0,
        metadata: {
          agentType: 'WorkflowEngine',
          timestamp: new Date().toISOString(),
          processingTime: 0,
          toolsUsed: []
        }
      };
    }

    const startTime = Date.now();
    
    try {
      // Execute the step action
      const result = await this.executeAction(step.action, { ...step.parameters, ...parameters }, context);
      
      // Update session context
      this.updateSessionContext(context.sessionId, {
        ...context,
        lastActivity: new Date().toISOString(),
        context: {
          ...context.context,
          [stepId]: result,
          lastStep: stepId,
          lastWorkflow: workflowId
        }
      });

      // Determine next steps based on conditions
      const nextSteps = this.determineNextSteps(step, result, context);

      return {
        success: true,
        message: `Successfully executed ${step.name}`,
        data: result,
        nextActions: nextSteps,
        confidence: 0.9,
        metadata: {
          agentType: 'WorkflowEngine',
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          toolsUsed: [step.action]
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to execute ${step.name}: ${error}`,
        confidence: 0.0,
        metadata: {
          agentType: 'WorkflowEngine',
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          toolsUsed: [step.action]
        }
      };
    }
  }

  /**
   * Execute a specific action
   */
  private async executeAction(
    action: string,
    parameters: Record<string, any>,
    context: SessionContext
  ): Promise<any> {
    switch (action) {
      case 'assess_lead_quality':
        return this.assessLeadQuality(parameters, context);
      
      case 'create_calendar_event':
        return this.createCalendarEvent(parameters, context);
      
      case 'send_welcome_package':
        return this.sendWelcomePackage(parameters, context);
      
      case 'categorize_ticket':
        return this.categorizeTicket(parameters, context);
      
      case 'analyze_meeting_notes':
        return this.analyzeMeetingNotes(parameters, context);
      
      case 'generate_proposal':
        return this.generateProposal(parameters, context);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Assess lead quality based on BANT criteria
   */
  private async assessLeadQuality(parameters: Record<string, any>, context: SessionContext): Promise<any> {
    const { criteria, scoring } = parameters;
    const leadData = context.context.leadData || {};
    
    let score = 0;
    const assessment: Record<string, any> = {};
    
    criteria.forEach((criterion: string) => {
      const value = leadData[criterion] || 'unknown';
      let criterionScore = 0;
      
      switch (criterion) {
        case 'budget':
          criterionScore = value === 'confirmed' ? scoring.high : 
                          value === 'estimated' ? scoring.medium : scoring.low;
          break;
        case 'authority':
          criterionScore = value === 'decision-maker' ? scoring.high :
                          value === 'influencer' ? scoring.medium : scoring.low;
          break;
        case 'need':
          criterionScore = value === 'urgent' ? scoring.high :
                          value === 'moderate' ? scoring.medium : scoring.low;
          break;
        case 'timeline':
          criterionScore = value === 'immediate' ? scoring.high :
                          value === 'quarter' ? scoring.medium : scoring.low;
          break;
      }
      
      assessment[criterion] = { value, score: criterionScore };
      score += criterionScore;
    });
    
    const averageScore = score / criteria.length;
    const quality = averageScore >= scoring.high ? 'high' :
                   averageScore >= scoring.medium ? 'medium' : 'low';
    
    return {
      quality,
      score: averageScore,
      assessment,
      recommendation: this.getQualityRecommendation(quality)
    };
  }

  /**
   * Create calendar event (instructions-based)
   */
  private async createCalendarEvent(parameters: Record<string, any>, context: SessionContext): Promise<any> {
    const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      eventId,
      instructions: this.generateCalendarInstructions(parameters, context),
      method: 'instructions-based',
      status: 'pending-creation'
    };
  }

  /**
   * Send welcome package
   */
  private async sendWelcomePackage(parameters: Record<string, any>, context: SessionContext): Promise<any> {
    return {
      package: parameters.package,
      sent: true,
      timestamp: new Date().toISOString(),
      contents: [
        'Welcome email',
        'Getting started guide',
        'Account setup instructions',
        'Support contact information'
      ]
    };
  }

  /**
   * Categorize support ticket
   */
  private async categorizeTicket(parameters: Record<string, any>, context: SessionContext): Promise<any> {
    const ticketData = context.context.ticketData || {};
    const { categories, priorities } = parameters;
    
    // Simple categorization logic (in real implementation, use ML)
    const category = this.determineCategory(ticketData, categories);
    const priority = this.determinePriority(ticketData, priorities);
    
    return {
      category,
      priority,
      confidence: 0.85,
      reasoning: this.getCategorizationReasoning(category, priority, ticketData)
    };
  }

  /**
   * Analyze meeting notes
   */
  private async analyzeMeetingNotes(parameters: Record<string, any>, context: SessionContext): Promise<any> {
    const notes = context.context.meetingNotes || '';
    
    return {
      sentiment: this.analyzeSentiment(notes),
      keyPoints: this.extractKeyPoints(notes),
      objections: this.identifyObjections(notes),
      nextSteps: this.suggestNextSteps(notes),
      confidence: 0.8
    };
  }

  /**
   * Generate proposal
   */
  private async generateProposal(parameters: Record<string, any>, context: SessionContext): Promise<any> {
    const leadData = context.context.leadData || {};
    
    return {
      proposalId: `prop-${Date.now()}`,
      template: parameters.template,
      customized: true,
      sections: [
        'Executive Summary',
        'Solution Overview',
        'Pricing',
        'Implementation Timeline',
        'Terms & Conditions'
      ],
      status: 'draft',
      nextSteps: ['review', 'customize', 'send']
    };
  }

  /**
   * Helper methods
   */
  private getQualityRecommendation(quality: string): string {
    switch (quality) {
      case 'high': return 'Schedule immediate demo and prepare proposal';
      case 'medium': return 'Send detailed information and schedule follow-up';
      case 'low': return 'Add to nurture campaign and follow up in 30 days';
      default: return 'Requires further qualification';
    }
  }

  private generateCalendarInstructions(parameters: Record<string, any>, context: SessionContext): string {
    return `📅 **CALENDAR EVENT CREATION INSTRUCTIONS**

**Event Details:**
- **Type:** ${parameters.type || 'Meeting'}
- **Duration:** ${parameters.duration || 30} minutes
- **Attendees:** ${parameters.attendees?.join(', ') || 'TBD'}

**How to Create:**
1. Go to your calendar application
2. Create new event
3. Set duration to ${parameters.duration || 30} minutes
4. Add attendees: ${parameters.attendees?.join(', ') || 'TBD'}
5. Save the event

**Event ID for Reference:** event-${Date.now()}`;
  }

  private determineCategory(ticketData: any, categories: string[]): string {
    // Simple keyword-based categorization
    const content = (ticketData.description || '').toLowerCase();
    
    if (content.includes('bug') || content.includes('error') || content.includes('broken')) {
      return 'bug';
    } else if (content.includes('billing') || content.includes('payment') || content.includes('invoice')) {
      return 'billing';
    } else if (content.includes('feature') || content.includes('enhancement') || content.includes('request')) {
      return 'feature-request';
    } else {
      return 'technical';
    }
  }

  private determinePriority(ticketData: any, priorities: string[]): string {
    const content = (ticketData.description || '').toLowerCase();
    
    if (content.includes('urgent') || content.includes('critical') || content.includes('down')) {
      return 'critical';
    } else if (content.includes('important') || content.includes('asap')) {
      return 'high';
    } else if (content.includes('minor') || content.includes('low')) {
      return 'low';
    } else {
      return 'medium';
    }
  }

  private getCategorizationReasoning(category: string, priority: string, ticketData: any): string {
    return `Categorized as ${category} with ${priority} priority based on content analysis of ticket description.`;
  }

  private analyzeSentiment(notes: string): string {
    // Simple sentiment analysis (in real implementation, use proper NLP)
    const positiveWords = ['good', 'great', 'excellent', 'interested', 'excited'];
    const negativeWords = ['concerned', 'worried', 'issue', 'problem', 'not interested'];
    
    const lowerNotes = notes.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerNotes.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerNotes.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private extractKeyPoints(notes: string): string[] {
    // Simple key point extraction (in real implementation, use proper NLP)
    const sentences = notes.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.slice(0, 3); // Return first 3 sentences as key points
  }

  private identifyObjections(notes: string): string[] {
    const objections: string[] = [];
    const lowerNotes = notes.toLowerCase();
    
    if (lowerNotes.includes('price') || lowerNotes.includes('cost')) {
      objections.push('Pricing concerns');
    }
    if (lowerNotes.includes('time') || lowerNotes.includes('busy')) {
      objections.push('Time constraints');
    }
    if (lowerNotes.includes('budget') || lowerNotes.includes('money')) {
      objections.push('Budget limitations');
    }
    
    return objections;
  }

  private suggestNextSteps(notes: string): string[] {
    const steps: string[] = [];
    const lowerNotes = notes.toLowerCase();
    
    if (lowerNotes.includes('demo') || lowerNotes.includes('show')) {
      steps.push('Schedule product demonstration');
    }
    if (lowerNotes.includes('proposal') || lowerNotes.includes('quote')) {
      steps.push('Prepare detailed proposal');
    }
    if (lowerNotes.includes('follow') || lowerNotes.includes('next')) {
      steps.push('Schedule follow-up meeting');
    }
    
    return steps.length > 0 ? steps : ['Schedule follow-up call'];
  }

  private determineNextSteps(step: WorkflowStep, result: any, context: SessionContext): string[] {
    if (step.conditions && result.quality) {
      const nextStep = step.conditions[result.quality];
      return nextStep ? [nextStep] : step.nextSteps;
    }
    return step.nextSteps;
  }

  private updateSessionContext(sessionId: string, context: SessionContext): void {
    this.sessionContexts.set(sessionId, context);
  }

  /**
   * Get available workflows
   */
  getAvailableWorkflows(): string[] {
    return Array.from(this.workflows.keys());
  }

  /**
   * Get workflow steps
   */
  getWorkflowSteps(workflowId: string): WorkflowStep[] {
    return this.workflows.get(workflowId) || [];
  }
}

