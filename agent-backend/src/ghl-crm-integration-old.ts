// ===== GHL (GoHighLevel) CRM INTEGRATION =====
import { ResilientAPIClient, RetryManager, withErrorHandling } from './reliability-utils';

// ===== GHL CRM INTERFACES =====

export interface GHLContact {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  source?: string;
  tags?: string[];
  customFields?: Record;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  timezone?: string;
  dnd?: boolean;
  type?: 'contact' | 'lead';
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GHLOpportunity {
  id?: string;
  contactId?: string;
  name?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: 'open' | 'won' | 'lost';
  monetaryValue?: number;
  currency?: string;
  source?: string;
  tags?: string[];
  customFields?: Record;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: GHLPipelineStage[];
}

export interface GHLPipelineStage {
  id: string;
  name: string;
  pipelineId: string;
  order: number;
  probability: number;
}

export interface GHLCalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  contactId?: string;
  opportunityId?: string;
  assignedTo?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  type?: 'call' | 'meeting' | 'appointment';
  customFields?: Record;
}

export interface GHLWebhook {
  id?: string;
  url: string;
  events: string[];
  active?: boolean;
}

// ===== GHL CRM CLIENT =====

export class GHLCRMClient {
  private client: ResilientAPIClient;
  private apiKey: string;
  private locationId: string;
  private baseURL: string;

  constructor(apiKey: string, locationId?: string) {
    this.apiKey = apiKey;
    this.locationId = locationId || this.extractLocationIdFromToken(apiKey);
    this.baseURL = 'https://rest.gohighlevel.com/v1';

    this.client = new ResilientAPIClient(this.baseURL, apiKey, {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 2,
      jitter: true,
    });
  }

  private extractLocationIdFromToken(token: string): string {
    try {
      // Decode JWT token to extract location_id
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.location_id;
    } catch (error) {
      console.error('Failed to extract location_id from token:', error);
      throw new Error('Invalid GHL API token format');
    }
  }

  // ===== CONTACT MANAGEMENT =====

  async createContact(contact: GHLContact): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.post<GHLContact>(
          `/contacts/`,
          {
            ...contact,
            locationId: this.locationId,
          },
          {
            tenantId: 'ghl',
            sessionId: 'contact-creation',
            operation: 'createContact',
            timestamp: new Date(),
          },
        );
        return response;
      },
      { maxRetries: 3, baseDelay: 1000 },
      {
        tenantId: 'ghl',
        sessionId: 'contact-creation',
        operation: 'createContact',
        timestamp: new Date(),
      },
    );
  }

  async updateContact(contactId: string, contact: Partial): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.put<GHLContact>(
          `/contacts/${contactId}`,
          {
            ...contact,
            locationId: this.locationId,
          },
          {
            tenantId: 'ghl',
            sessionId: 'contact-update',
            operation: 'updateContact',
            timestamp: new Date(),
          },
        );
        return response;
      },
      { maxRetries: 3, baseDelay: 1000 },
      {
        tenantId: 'ghl',
        sessionId: 'contact-update',
        operation: 'updateContact',
        timestamp: new Date(),
      },
    );
  }

  async getContact(contactId: string): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.get<GHLContact>(
          `/contacts/${contactId}?locationId=${this.locationId}`,
          {
            tenantId: 'ghl',
            sessionId: 'contact-fetch',
            operation: 'getContact',
            timestamp: new Date(),
          },
        );
        return response;
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'contact-fetch',
        operation: 'getContact',
        timestamp: new Date(),
      },
    );
  }

  async searchContacts(query: string, limit: number = 10): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.get<{ contacts: GHLContact[] }>(
          `/contacts/search?locationId=${this.locationId}&query=${encodeURIComponent(
            query,
          )}&limit=${limit}`,
          {
            tenantId: 'ghl',
            sessionId: 'contact-search',
            operation: 'searchContacts',
            timestamp: new Date(),
          },
        );
        return response.contacts || [];
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'contact-search',
        operation: 'searchContacts',
        timestamp: new Date(),
      },
    );
  }

  async addContactTag(contactId: string, tag: string): Promise {
    await RetryManager.executeWithRetry(
      async () => {
        await this.client.post(
          `/contacts/${contactId}/tags`,
          { tag, locationId: this.locationId },
          {
            tenantId: 'ghl',
            sessionId: 'contact-tag',
            operation: 'addContactTag',
            timestamp: new Date(),
          },
        );
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'contact-tag',
        operation: 'addContactTag',
        timestamp: new Date(),
      },
    );
  }

  // ===== OPPORTUNITY MANAGEMENT =====

  async createOpportunity(opportunity: GHLOpportunity): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.post<GHLOpportunity>(
          `/opportunities/`,
          {
            ...opportunity,
            locationId: this.locationId,
          },
          {
            tenantId: 'ghl',
            sessionId: 'opportunity-creation',
            operation: 'createOpportunity',
            timestamp: new Date(),
          },
        );
        return response;
      },
      { maxRetries: 3, baseDelay: 1000 },
      {
        tenantId: 'ghl',
        sessionId: 'opportunity-creation',
        operation: 'createOpportunity',
        timestamp: new Date(),
      },
    );
  }

  async updateOpportunity(opportunityId: string, opportunity: Partial): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.put<GHLOpportunity>(
          `/opportunities/${opportunityId}`,
          {
            ...opportunity,
            locationId: this.locationId,
          },
          {
            tenantId: 'ghl',
            sessionId: 'opportunity-update',
            operation: 'updateOpportunity',
            timestamp: new Date(),
          },
        );
        return response;
      },
      { maxRetries: 3, baseDelay: 1000 },
      {
        tenantId: 'ghl',
        sessionId: 'opportunity-update',
        operation: 'updateOpportunity',
        timestamp: new Date(),
      },
    );
  }

  async getOpportunity(opportunityId: string): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.get<GHLOpportunity>(
          `/opportunities/${opportunityId}?locationId=${this.locationId}`,
          {
            tenantId: 'ghl',
            sessionId: 'opportunity-fetch',
            operation: 'getOpportunity',
            timestamp: new Date(),
          },
        );
        return response;
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'opportunity-fetch',
        operation: 'getOpportunity',
        timestamp: new Date(),
      },
    );
  }

  async getOpportunitiesByContact(contactId: string): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.get<{ opportunities: GHLOpportunity[] }>(
          `/opportunities/?locationId=${this.locationId}&contactId=${contactId}`,
          {
            tenantId: 'ghl',
            sessionId: 'opportunities-fetch',
            operation: 'getOpportunitiesByContact',
            timestamp: new Date(),
          },
        );
        return response.opportunities || [];
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'opportunities-fetch',
        operation: 'getOpportunitiesByContact',
        timestamp: new Date(),
      },
    );
  }

  // ===== PIPELINE MANAGEMENT =====

  async getPipelines(): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.get<{ pipelines: GHLPipeline[] }>(
          `/pipelines/?locationId=${this.locationId}`,
          {
            tenantId: 'ghl',
            sessionId: 'pipelines-fetch',
            operation: 'getPipelines',
            timestamp: new Date(),
          },
        );
        return response.pipelines || [];
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'pipelines-fetch',
        operation: 'getPipelines',
        timestamp: new Date(),
      },
    );
  }

  async getPipelineStages(pipelineId: string): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.get<{ stages: GHLPipelineStage[] }>(
          `/pipelines/${pipelineId}/stages?locationId=${this.locationId}`,
          {
            tenantId: 'ghl',
            sessionId: 'pipeline-stages-fetch',
            operation: 'getPipelineStages',
            timestamp: new Date(),
          },
        );
        return response.stages || [];
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'pipeline-stages-fetch',
        operation: 'getPipelineStages',
        timestamp: new Date(),
      },
    );
  }

  // ===== CALENDAR MANAGEMENT =====

  async createCalendarEvent(event: GHLCalendarEvent): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.post<GHLCalendarEvent>(
          `/calendars/events/`,
          {
            ...event,
            locationId: this.locationId,
          },
          {
            tenantId: 'ghl',
            sessionId: 'calendar-event-creation',
            operation: 'createCalendarEvent',
            timestamp: new Date(),
          },
        );
        return response;
      },
      { maxRetries: 3, baseDelay: 1000 },
      {
        tenantId: 'ghl',
        sessionId: 'calendar-event-creation',
        operation: 'createCalendarEvent',
        timestamp: new Date(),
      },
    );
  }

  async getAvailableTimeSlots(
    startDate: string,
    endDate: string,
    duration: number = 30,
    assignedTo?: string,
  ): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.get<{ slots: { startTime: string; endTime: string }[] }>(
          `/calendars/availability?locationId=${
            this.locationId
          }&startDate=${startDate}&endDate=${endDate}&duration=${duration}${
            assignedTo ? `&assignedTo=${assignedTo}` : ''
          }`,
          {
            tenantId: 'ghl',
            sessionId: 'calendar-availability',
            operation: 'getAvailableTimeSlots',
            timestamp: new Date(),
          },
        );
        return response.slots || [];
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'calendar-availability',
        operation: 'getAvailableTimeSlots',
        timestamp: new Date(),
      },
    );
  }

  // ===== CUSTOM FIELDS =====

  async updateContactCustomField(contactId: string, fieldKey: string, value: any): Promise {
    await RetryManager.executeWithRetry(
      async () => {
        await this.client.put(
          `/contacts/${contactId}/custom-fields`,
          {
            [fieldKey]: value,
            locationId: this.locationId,
          },
          {
            tenantId: 'ghl',
            sessionId: 'contact-custom-field',
            operation: 'updateContactCustomField',
            timestamp: new Date(),
          },
        );
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'contact-custom-field',
        operation: 'updateContactCustomField',
        timestamp: new Date(),
      },
    );
  }

  async updateOpportunityCustomField(opportunityId: string, fieldKey: string, value: any): Promise {
    await RetryManager.executeWithRetry(
      async () => {
        await this.client.put(
          `/opportunities/${opportunityId}/custom-fields`,
          {
            [fieldKey]: value,
            locationId: this.locationId,
          },
          {
            tenantId: 'ghl',
            sessionId: 'opportunity-custom-field',
            operation: 'updateOpportunityCustomField',
            timestamp: new Date(),
          },
        );
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'opportunity-custom-field',
        operation: 'updateOpportunityCustomField',
        timestamp: new Date(),
      },
    );
  }

  // ===== NOTES AND ACTIVITIES =====

  async addContactNote(
    contactId: string,
    note: string,
    type: 'note' | 'call' | 'email' = 'note',
  ): Promise {
    await RetryManager.executeWithRetry(
      async () => {
        await this.client.post(
          `/contacts/${contactId}/notes`,
          {
            body: note,
            type,
            locationId: this.locationId,
          },
          {
            tenantId: 'ghl',
            sessionId: 'contact-note',
            operation: 'addContactNote',
            timestamp: new Date(),
          },
        );
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'contact-note',
        operation: 'addContactNote',
        timestamp: new Date(),
      },
    );
  }

  async addOpportunityNote(
    opportunityId: string,
    note: string,
    type: 'note' | 'call' | 'email' = 'note',
  ): Promise {
    await RetryManager.executeWithRetry(
      async () => {
        await this.client.post(
          `/opportunities/${opportunityId}/notes`,
          {
            body: note,
            type,
            locationId: this.locationId,
          },
          {
            tenantId: 'ghl',
            sessionId: 'opportunity-note',
            operation: 'addOpportunityNote',
            timestamp: new Date(),
          },
        );
      },
      { maxRetries: 2, baseDelay: 500 },
      {
        tenantId: 'ghl',
        sessionId: 'opportunity-note',
        operation: 'addOpportunityNote',
        timestamp: new Date(),
      },
    );
  }

  // ===== WEBHOOK MANAGEMENT =====

  async createWebhook(webhook: GHLWebhook): Promise {
    return await RetryManager.executeWithRetry(
      async () => {
        const response = await this.client.post<GHLWebhook>(
          `/webhooks/`,
          {
            ...webhook,
            locationId: this.locationId,
          },
          {
            tenantId: 'ghl',
            sessionId: 'webhook-creation',
            operation: 'createWebhook',
            timestamp: new Date(),
          },
        );
        return response;
      },
      { maxRetries: 3, baseDelay: 1000 },
      {
        tenantId: 'ghl',
        sessionId: 'webhook-creation',
        operation: 'createWebhook',
        timestamp: new Date(),
      },
    );
  }

  // ===== UTILITY METHODS =====

  async testConnection(): Promise {
    try {
      await this.getPipelines();
      return true;
    } catch (error) {
      console.error('GHL connection test failed:', error);
      return false;
    }
  }

  getLocationId(): string {
    return this.locationId;
  }

  // ===== SALES AGENT SPECIFIC METHODS =====

  async createSalesContact(
    contactData: {
      name: string;
      email: string;
      phone?: string;
      company?: string;
      role?: string;
      source?: string;
    },
  ): Promise {
    const [firstName, ...lastNameParts] = contactData.name.split(' ');
    const lastName = lastNameParts.join(' ');

    return await this.createContact({
      firstName,
      lastName,
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone,
      companyName: contactData.company,
      source: contactData.source || 'AI Sales Agent',
      type: 'lead',
      tags: ['ai-sales-agent', 'inbound-lead'],
    });
  }

  async createSalesOpportunity(
    contactId: string,
    opportunityData: {
      name: string;
      pipelineId?: string;
      pipelineStageId?: string;
      monetaryValue?: number;
      source?: string;
    },
  ): Promise {
    return await this.createOpportunity({
      contactId,
      name: opportunityData.name,
      pipelineId: opportunityData.pipelineId,
      pipelineStageId: opportunityData.pipelineStageId,
      monetaryValue: opportunityData.monetaryValue,
      source: opportunityData.source || 'AI Sales Agent',
      status: 'open',
      tags: ['ai-sales-agent', 'inbound-opportunity'],
    });
  }

  async scheduleFollowUpCall(
    contactId: string,
    opportunityId: string,
    callData: {
      title: string;
      startTime: string;
      endTime: string;
      description?: string;
      assignedTo?: string;
    },
  ): Promise {
    return await this.createCalendarEvent({
      title: callData.title,
      description: callData.description || 'Follow-up call scheduled by AI Sales Agent',
      startTime: callData.startTime,
      endTime: callData.endTime,
      contactId,
      opportunityId,
      assignedTo: callData.assignedTo,
      type: 'call',
      status: 'scheduled',
    });
  }

  async updateLeadScore(
    opportunityId: string,
    leadScore: {
      overall: number;
      fit: number;
      urgency: number;
      budget: number;
      authority: number;
      need: number;
      priority: 'hot' | 'warm' | 'cold';
      reasoning: string;
    },
  ): Promise {
    await this.updateOpportunityCustomField(opportunityId, 'lead_score_overall', leadScore.overall);
    await this.updateOpportunityCustomField(opportunityId, 'lead_score_fit', leadScore.fit);
    await this.updateOpportunityCustomField(opportunityId, 'lead_score_urgency', leadScore.urgency);
    await this.updateOpportunityCustomField(opportunityId, 'lead_score_budget', leadScore.budget);
    await this.updateOpportunityCustomField(
      opportunityId,
      'lead_score_authority',
      leadScore.authority,
    );
    await this.updateOpportunityCustomField(opportunityId, 'lead_score_need', leadScore.need);
    await this.updateOpportunityCustomField(opportunityId, 'lead_priority', leadScore.priority);
    await this.updateOpportunityCustomField(opportunityId, 'lead_reasoning', leadScore.reasoning);
  }

  async updateSentimentAnalysis(
    opportunityId: string,
    sentiment: {
      sentiment: 'positive' | 'neutral' | 'negative';
      engagement: 'high' | 'medium' | 'low';
      interestLevel: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
      notes: string;
    },
  ): Promise {
    await this.updateOpportunityCustomField(opportunityId, 'sentiment', sentiment.sentiment);
    await this.updateOpportunityCustomField(opportunityId, 'engagement', sentiment.engagement);
    await this.updateOpportunityCustomField(
      opportunityId,
      'interest_level',
      sentiment.interestLevel,
    );
    await this.updateOpportunityCustomField(opportunityId, 'sentiment_notes', sentiment.notes);
  }

  async updateCompetitiveInfo(
    opportunityId: string,
    competitiveData: {
      competitors: string[];
      currentVendor?: string;
      competitorReasons?: string[];
      switchingReasons?: string[];
    },
  ): Promise {
    await this.updateOpportunityCustomField(
      opportunityId,
      'competitors',
      competitiveData.competitors.join(', '),
    );
    if (competitiveData.currentVendor) {
      await this.updateOpportunityCustomField(
        opportunityId,
        'current_vendor',
        competitiveData.currentVendor,
      );
    }
    if (competitiveData.competitorReasons) {
      await this.updateOpportunityCustomField(
        opportunityId,
        'competitor_reasons',
        competitiveData.competitorReasons.join(', '),
      );
    }
    if (competitiveData.switchingReasons) {
      await this.updateOpportunityCustomField(
        opportunityId,
        'switching_reasons',
        competitiveData.switchingReasons.join(', '),
      );
    }
  }

  async updateObjections(
    opportunityId: string,
    objections: {
      objections: string[];
      categories: string[];
      responses: string[];
    },
  ): Promise {
    await this.updateOpportunityCustomField(
      opportunityId,
      'objections',
      objections.objections.join(', '),
    );
    await this.updateOpportunityCustomField(
      opportunityId,
      'objection_categories',
      objections.categories.join(', '),
    );
    await this.updateOpportunityCustomField(
      opportunityId,
      'objection_responses',
      objections.responses.join(', '),
    );
  }

  async addCallSummary(opportunityId: string, summary: string): Promise {
    await this.addOpportunityNote(opportunityId, summary, 'call');
  }
}

// ===== GHL CRM MANAGER =====

export class GHLCRMManager {
  private static instance: GHLCRMManager;
  private client: GHLCRMClient;
  private pipelines: GHLPipeline[] = [];
  private initialized: boolean = false;

  private constructor(apiKey: string) {
    this.client = new GHLCRMClient(apiKey);
  }

  static getInstance(apiKey?: string): GHLCRMManager {
    if (!GHLCRMManager.instance) {
      if (!apiKey) {
        throw new Error('GHL API key is required for first initialization');
      }
      GHLCRMManager.instance = new GHLCRMManager(apiKey);
    }
    return GHLCRMManager.instance;
  }

  async initialize(): Promise {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🔧 Initializing GHL CRM connection...');

      // Test connection
      const isConnected = await this.client.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to GHL CRM');
      }

      // Load pipelines
      this.pipelines = await this.client.getPipelines();
      console.log(`✅ GHL CRM initialized successfully. Found ${this.pipelines.length} pipelines.`);

      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize GHL CRM:', error);
      throw error;
    }
  }

  getClient(): GHLCRMClient {
    if (!this.initialized) {
      throw new Error('GHL CRM Manager not initialized. Call initialize() first.');
    }
    return this.client;
  }

  getPipelines(): GHLPipeline[] {
    return this.pipelines;
  }

  getDefaultPipeline(): GHLPipeline | null {
    return this.pipelines.length > 0 ? this.pipelines[0] : null;
  }

  getDefaultPipelineStage(pipelineId: string): GHLPipelineStage | null {
    const pipeline = this.pipelines.find((p) => p.id === pipelineId);
    if (!pipeline || pipeline.stages.length === 0) {
      return null;
    }
    // Return the first stage (usually "New Lead" or similar)
    return pipeline.stages[0];
  }
}

// ===== EXPORT =====
// Classes are already exported above
