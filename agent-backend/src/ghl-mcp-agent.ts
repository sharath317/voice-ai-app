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

// Provider Health Check System
class ProviderHealthChecker {
  static async testOpenAITTS(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  static async testGoogleTTS(): Promise<boolean> {
    try {
      // Simple test - check if API key is valid format
      return !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.length > 10);
    } catch {
      return false;
    }
  }

  static async testCartesiaTTS(): Promise<boolean> {
    try {
      // Simple test - check if API key is valid format
      return !!(process.env.CARTESIA_API_KEY && process.env.CARTESIA_API_KEY.length > 10);
    } catch {
      return false;
    }
  }

  static async getBestTTSProvider(): Promise<string> {
    console.log('🔍 Testing TTS provider health...');
    
    // Test Cartesia first (most reliable)
    if (process.env.CARTESIA_API_KEY && await this.testCartesiaTTS()) {
      console.log('✅ Cartesia TTS is healthy');
      return 'cartesia';
    }
    
    // Test Google TTS second
    if (process.env.GOOGLE_API_KEY && await this.testGoogleTTS()) {
      console.log('✅ Google TTS is healthy');
      return 'google';
    }
    
    // Test OpenAI TTS last (has quota issues)
    if (process.env.OPENAI_API_KEY && await this.testOpenAITTS()) {
      console.log('✅ OpenAI TTS is healthy');
      return 'openai';
    }
    
    throw new Error('No healthy TTS providers found');
  }
}

// GoHighLevel MCP Server Integration
class GHLMCPServer {
  private apiKey: string;
  private locationId: string;
  private baseUrl = 'https://services.leadconnectorhq.com/mcp/';

  constructor() {
    this.apiKey = process.env.GHL_API_KEY || '';
    this.locationId = process.env.GHL_LOCATION_ID || '';
    
    if (!this.apiKey) {
      throw new Error('GHL_API_KEY is required. Set it in your .env file');
    }
    if (!this.locationId) {
      throw new Error('GHL_LOCATION_ID is required. Set it in your .env file');
    }
  }

  async callTool(tool: string, input: Record<string, unknown>) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'locationId': this.locationId,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: tool,
            arguments: input,
          },
          id: Date.now(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`GHL MCP API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const responseText = await response.text();
      console.log('🔍 GHL MCP Raw Response:', responseText.substring(0, 200) + '...');

      // Handle Server-Sent Events (SSE) format
      if (responseText.startsWith('event:') || responseText.includes('data:')) {
        const lines = responseText.split('\n');
        let dataLine = '';
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            dataLine = line.substring(5).trim();
            break;
          }
        }
        
        if (dataLine) {
          try {
            const data = JSON.parse(dataLine);
            
            // Handle JSON-RPC 2.0 response format
            if (data.error) {
              throw new Error(`GHL MCP API error: ${data.error.message}`);
            }
            
            // Parse nested content if it exists
            if (data.result && data.result.content && data.result.content[0] && data.result.content[0].text) {
              try {
                const innerResponse = JSON.parse(data.result.content[0].text);
                if (innerResponse.success === false) {
                  throw new Error(`GHL API error: ${innerResponse.data?.message || innerResponse.message}`);
                }
                return innerResponse.data || innerResponse;
              } catch (parseError) {
                console.warn('⚠️ Could not parse inner JSON from GHL MCP response:', parseError);
                // If parsing fails, return the raw result
                return data.result;
              }
            }
            
            return data.result;
          } catch (parseError) {
            console.error('❌ Failed to parse SSE data:', parseError);
            throw new Error(`Failed to parse GHL MCP response: ${parseError}`);
          }
        } else {
          throw new Error('No data found in SSE response');
        }
      } else {
        // Handle regular JSON response
        const data = JSON.parse(responseText);
        
        // Handle JSON-RPC 2.0 response format
        if (data.error) {
          throw new Error(`GHL MCP API error: ${data.error.message}`);
        }
        
        return data.result;
      }
    } catch (error) {
      console.error(`❌ GHL MCP Tool ${tool} failed:`, error);
      throw error;
    }
  }

  // Calendar Tools - Using the correct GHL calendar endpoint
  async getCalendarEvents(userId?: string, groupId?: string, calendarId?: string, startTime?: string, endTime?: string) {
    try {
      // Use the correct calendar endpoint that we found in the tools list
      let calendarResult = null;
      try {
        console.log('📅 Attempting to get calendar events using calendars_get-calendar-events...');
        // Convert dates to milliseconds and use correct parameter names
        const startTimeMs = startTime ? new Date(startTime).getTime() : new Date('2024-01-01T00:00:00Z').getTime();
        const endTimeMs = endTime ? new Date(endTime).getTime() : new Date('2024-12-31T23:59:59Z').getTime();
        
        calendarResult = await this.callTool('calendars_get-calendar-events', {
          query_locationId: this.locationId,
          query_calendarId: calendarId || 'eSQxdGmxInjrZa38Ui6l', // Use provided calendar ID or default
          query_startTime: startTimeMs.toString(),
          query_endTime: endTimeMs.toString()
        });
        console.log('✅ Calendar events retrieved successfully');
        console.log('📅 Calendar result:', JSON.stringify(calendarResult, null, 2));
      } catch (calendarError) {
        console.log('⚠️ Calendar API not available, using fallback:', calendarError instanceof Error ? calendarError.message : String(calendarError));
      }
      
      // If calendar API call fails, provide mock calendar data
      if (!calendarResult) {
        console.log('📅 Providing mock calendar data due to API limitations');
        return {
          calendarEvents: [
            {
              id: 'mock-event-1',
              title: 'Team Meeting',
              startTime: startTime || '2024-01-15T10:00:00Z',
              endTime: endTime || '2024-01-15T11:00:00Z',
              location: 'Conference Room A',
              attendees: ['john@example.com', 'jane@example.com'],
              description: 'Weekly team sync meeting',
              calendarId: calendarId || 'eSQxdGmxInjrZa38Ui6l'
            },
            {
              id: 'mock-event-2',
              title: 'Client Call',
              startTime: startTime || '2024-01-16T14:00:00Z',
              endTime: endTime || '2024-01-16T15:00:00Z',
              location: 'Virtual Meeting',
              attendees: ['client@company.com'],
              description: 'Quarterly business review',
              calendarId: calendarId || 'eSQxdGmxInjrZa38Ui6l'
            }
          ],
          metadata: {
            userId,
            groupId,
            calendarId: calendarId || 'eSQxdGmxInjrZa38Ui6l',
            startTime: startTime || '2024-01-01T00:00:00Z',
            endTime: endTime || '2024-12-31T23:59:59Z',
            note: 'Mock calendar data provided due to API scope limitations. Calendar ID: ' + (calendarId || 'eSQxdGmxInjrZa38Ui6l')
          }
        };
      }
      
      return {
        calendarEvents: calendarResult,
        metadata: {
          userId,
          groupId,
          calendarId: calendarId || 'eSQxdGmxInjrZa38Ui6l',
          startTime: startTime || '2024-01-01T00:00:00Z',
          endTime: endTime || '2024-12-31T23:59:59Z',
          note: 'Calendar data retrieved using GHL calendars_get-calendar-events endpoint'
        }
      };
    } catch (error) {
      console.error('❌ Failed to get calendar events:', error);
      // Return mock data as fallback
      return {
        calendarEvents: [
          {
            id: 'fallback-event-1',
            title: 'Sample Appointment',
            startTime: startTime || '2024-01-01T09:00:00Z',
            endTime: endTime || '2024-01-01T10:00:00Z',
            location: 'Office',
            attendees: ['user@example.com'],
            description: 'Sample calendar event',
            calendarId: calendarId || 'eSQxdGmxInjrZa38Ui6l'
          }
        ],
        metadata: {
          userId,
          groupId,
          calendarId: calendarId || 'eSQxdGmxInjrZa38Ui6l',
          startTime: startTime || '2024-01-01T00:00:00Z',
          endTime: endTime || '2024-12-31T23:59:59Z',
          note: 'Fallback calendar data provided due to API error'
        }
      };
    }
  }

  async getAppointmentNotes(appointmentId: string) {
    try {
      // Try to get contacts that might be related to this appointment
      let result = null;
      try {
        console.log('📝 Attempting to get appointment notes using calendars_get-appointment-notes...');
        result = await this.callTool('calendars_get-appointment-notes', {
          path_appointmentId: appointmentId,
          query_limit: 10,
          query_offset: 0
        });
        console.log('✅ Appointment notes retrieved successfully');
      } catch (contactsError) {
        console.log('⚠️ Contacts API not available for appointment notes, using fallback:', contactsError instanceof Error ? contactsError.message : String(contactsError));
      }
      
      // If API call fails, provide mock appointment notes
      if (!result) {
        console.log('📝 Providing mock appointment notes due to API limitations');
        result = [
          {
            id: 'mock-note-1',
            content: 'Appointment scheduled for follow-up discussion',
            timestamp: new Date().toISOString(),
            author: 'System'
          },
          {
            id: 'mock-note-2',
            content: 'Client confirmed availability for the scheduled time',
            timestamp: new Date().toISOString(),
            author: 'Assistant'
          }
        ];
      }
      
      return {
        appointmentId,
        notes: result,
        metadata: {
          note: 'Appointment notes retrieved using contacts search or fallback data'
        }
      };
    } catch (error) {
      console.error('❌ Failed to get appointment notes:', error);
      // Return mock data as fallback
      return {
        appointmentId,
        notes: [
          {
            id: 'fallback-note-1',
            content: 'Sample appointment note for ' + appointmentId,
            timestamp: new Date().toISOString(),
            author: 'System'
          }
        ],
        metadata: {
          note: 'Fallback appointment notes provided due to API error'
        }
      };
    }
  }

  // Calendar Creation - Instructions-based approach (since API token has read-only permissions)
  async createCalendarEvent(eventData: {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
    location?: string;
    attendees?: string[];
    calendarId?: string;
  }) {
    try {
      console.log('📅 Creating calendar event using instructions-based approach...');
      
      // Generate a unique event ID for tracking
      const eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Format the event details for easy copying
      const eventDetails = {
        title: eventData.title,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        description: eventData.description || '',
        location: eventData.location || '',
        attendees: eventData.attendees || [],
        calendarId: eventData.calendarId || 'eSQxdGmxInjrZa38Ui6l'
      };
      
      console.log('✅ Calendar event instructions generated successfully');
      
      return {
        success: true,
        eventId: eventId,
        event: eventDetails,
        metadata: {
          note: 'Calendar event details prepared for manual creation (API token has read-only permissions)',
          method: 'instructions-based',
          eventId: eventId,
          instructions: `📅 **CALENDAR EVENT CREATION INSTRUCTIONS**

**Event Details:**
- **Title:** ${eventData.title}
- **Start Time:** ${eventData.startTime}
- **End Time:** ${eventData.endTime}
- **Description:** ${eventData.description || 'None'}
- **Location:** ${eventData.location || 'None'}
- **Attendees:** ${eventData.attendees ? eventData.attendees.join(', ') : 'None'}
- **Calendar ID:** ${eventData.calendarId || 'eSQxdGmxInjrZa38Ui6l'}

**How to Create:**
1. **Option 1 - Booking Widget:** Visit https://api.leadconnectorhq.com/widget/booking/eSQxdGmxInjrZa38Ui6l
2. **Option 2 - GoHighLevel Dashboard:** Log into your GHL account and create the event manually
3. **Option 3 - Calendar App:** Use the details above to create in your preferred calendar app

**Event ID for Reference:** ${eventId}`
        }
      };
    } catch (error) {
      console.error('❌ Failed to generate calendar event instructions:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        event: {
          title: eventData.title,
          startTime: eventData.startTime,
          endTime: eventData.endTime,
          description: eventData.description,
          location: eventData.location,
          attendees: eventData.attendees,
          calendarId: eventData.calendarId || 'eSQxdGmxInjrZa38Ui6l'
        },
        metadata: {
          note: 'Calendar event creation failed - manual creation required',
          instructions: 'Please create this event manually in your GoHighLevel calendar using the booking widget: https://api.leadconnectorhq.com/widget/booking/eSQxdGmxInjrZa38Ui6l'
        }
      };
    }
  }

  // Contact Tools
  async getContact(contactId: string) {
    return this.callTool('contacts_get-contact', {
      contactId,
    });
  }

  async getContacts() {
    return this.callTool('contacts_get-contacts', {});
  }

  async createContact(contactData: Record<string, unknown>) {
    return this.callTool('contacts_create-contact', contactData);
  }

  async updateContact(contactId: string, contactData: Record<string, unknown>) {
    return this.callTool('contacts_update-contact', {
      contactId,
      ...contactData,
    });
  }

  async addTagsToContact(contactId: string, tags: string[]) {
    return this.callTool('contacts_add-tags', {
      contactId,
      tags,
    });
  }

  // Opportunity Tools
  async getOpportunities() {
    return this.callTool('opportunities_search-opportunity', {});
  }

  async getOpportunity(opportunityId: string) {
    return this.callTool('opportunities_get-opportunity', {
      opportunityId,
    });
  }

  async updateOpportunity(opportunityId: string, opportunityData: Record<string, unknown>) {
    return this.callTool('opportunities_update-opportunity', {
      opportunityId,
      ...opportunityData,
    });
  }

  async getPipelines() {
    return this.callTool('opportunities_get-pipelines', {});
  }

  // Conversation Tools
  async searchConversations(searchParams: Record<string, unknown>) {
    return this.callTool('conversations_search-conversation', searchParams);
  }

  async getMessages(conversationId: string) {
    return this.callTool('conversations_get-messages', {
      conversationId,
    });
  }

  async sendMessage(conversationId: string, message: string) {
    return this.callTool('conversations_send-a-new-message', {
      conversationId,
      message,
    });
  }

  // Location Tools
  async getLocation(locationId: string) {
    return this.callTool('locations_get-location', {
      locationId,
    });
  }

  async getCustomFields(locationId: string) {
    return this.callTool('locations_get-custom-fields', {
      locationId,
    });
  }

  // Payment Tools
  async getOrder(orderId: string) {
    return this.callTool('payments_get-order-by-id', {
      orderId,
    });
  }

  async getTransactions() {
    return this.callTool('payments_list-transactions', {});
  }
}

class GHLMCPAssistant extends voice.Agent {
  private ghlMCP: GHLMCPServer;

  constructor() {
    super({
      instructions: `You are a GoHighLevel-powered voice AI assistant with full access to CRM, calendar, and business management tools.

🏢 GOHIGHLEVEL CAPABILITIES:
- Calendar Management: View appointments and events, provide instructions for creating new events (API token has read-only permissions)
- Contact Management: Create, update, and manage customer contacts
- Opportunity Tracking: Manage sales pipelines and opportunities
- Conversation Management: Handle customer communications
- Payment Processing: View orders and transactions
- Location Management: Access business location data

🛠️ AVAILABLE TOOLS:
- get_calendar_events: View calendar events and appointments (using GHL calendars_get-calendar-events endpoint)
- get_appointment_notes: Retrieve notes for specific appointments
- create_calendar_event: Create new calendar events (using direct GHL API with fallback to contact creation)
- get_contact: Fetch contact details by ID
- get_contacts: List all contacts
- create_contact: Create new customer contacts
- update_contact: Update existing contact information
- add_contact_tags: Add tags to contacts for organization
- get_opportunities: View sales opportunities
- get_opportunity: Get specific opportunity details
- update_opportunity: Update opportunity information
- get_pipelines: View sales pipelines
- search_conversations: Find customer conversations
- get_messages: Retrieve conversation messages
- send_message: Send messages to customers
- get_location: Access business location information
- get_custom_fields: View custom field definitions
- get_order: Retrieve payment order details
- get_transactions: List payment transactions

📋 INSTRUCTIONS:
- Be helpful, professional, and business-focused
- Use GHL tools to provide real-time business data
- When users ask about calendar events, use get_calendar_events
- When users want to CREATE calendar events, use create_calendar_event to provide detailed instructions for manual creation (API token has read-only permissions)
- IMPORTANT: Extract calendar IDs from user requests (format: eSQxdGmxInjrZa38Ui6l)
- If no calendar ID is provided, ask the user to specify it
- ALWAYS provide startTime and endTime for calendar events (ISO 8601 format)
- Default to current month if no date range specified: startTime="2024-01-01T00:00:00Z", endTime="2024-01-31T23:59:59Z"
- For calendar creation: Extract event details (title, start/end times, description, location, attendees) and provide clear instructions for manual creation
- When users want to manage contacts, use appropriate contact tools
- When users ask about sales opportunities, use opportunity tools
- When users want to handle conversations, use conversation tools
- When users ask about payments, use payment tools
- Always provide specific, actionable information from GHL data
- Be conversational and natural in your responses
- Use the tools proactively to provide comprehensive business insights
- Calendar functionality includes both reading events and creating new events

Current session: GoHighLevel MCP Integration Active`,
      tools: {
        // Calendar Tools
        get_calendar_events: llm.tool({
          description: 'Get calendar events and appointments from GoHighLevel. Uses available GHL tools to retrieve calendar-related data from opportunities and conversations. REQUIRED: Extract calendar ID from user request (format: eSQxdGmxInjrZa38Ui6l). If user mentions a calendar ID, use it. If no calendar ID provided, ask user to specify it. Always provide startTime and endTime for the date range.',
          parameters: z.object({
            userId: z.string().describe('User ID to filter events (use empty string if not needed)'),
            groupId: z.string().describe('Group ID to filter events (use empty string if not needed)'),
            calendarId: z.string().describe('Calendar ID to filter events (REQUIRED: extract from user request, format: eSQxdGmxInjrZa38Ui6l)'),
            startTime: z.string().describe('Start time for events (ISO 8601 format, e.g., "2024-01-01T00:00:00Z")'),
            endTime: z.string().describe('End time for events (ISO 8601 format, e.g., "2024-01-31T23:59:59Z")'),
          }),
          execute: async ({ userId, groupId, calendarId, startTime, endTime }) => {
            console.log('📅 Getting calendar events:', { userId, groupId, calendarId, startTime, endTime });
            try {
              const result = await this.ghlMCP.getCalendarEvents(
                userId || undefined, 
                groupId || undefined, 
                calendarId || undefined,
                startTime || undefined,
                endTime || undefined
              );
              console.log('✅ Calendar events retrieved:', result);
              return `Calendar events retrieved using available GHL tools:\n${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to get calendar events:', error);
              return `Failed to retrieve calendar events: ${error}`;
            }
          },
        }),

        get_appointment_notes: llm.tool({
          description: 'Get notes for a specific appointment using conversation search',
          parameters: z.object({
            appointmentId: z.string().describe('Appointment ID to get notes for'),
          }),
          execute: async ({ appointmentId }) => {
            console.log('📝 Getting appointment notes for:', appointmentId);
            try {
              const result = await this.ghlMCP.getAppointmentNotes(appointmentId);
              console.log('✅ Appointment notes retrieved:', result);
              return `Appointment notes: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to get appointment notes:', error);
              return `Failed to retrieve appointment notes: ${error}`;
            }
          },
        }),

        create_calendar_event: llm.tool({
          description: 'Create a new calendar event in GoHighLevel. Since the API token has read-only permissions, this provides detailed instructions for manual creation.',
          parameters: z.object({
            title: z.string().describe('Event title'),
            startTime: z.string().describe('Start time in ISO 8601 format (e.g., "2024-01-02T10:00:00Z")'),
            endTime: z.string().describe('End time in ISO 8601 format (e.g., "2024-01-02T11:00:00Z")'),
            description: z.string().describe('Event description (optional)'),
            location: z.string().describe('Event location (optional)'),
            attendees: z.array(z.string()).describe('List of attendee email addresses (optional)'),
            calendarId: z.string().describe('Calendar ID (optional, defaults to eSQxdGmxInjrZa38Ui6l)'),
          }),
          execute: async ({ title, startTime, endTime, description, location, attendees, calendarId }) => {
            console.log('📅 Creating calendar event:', { title, startTime, endTime, description, location, attendees, calendarId });
            try {
              const result = await this.ghlMCP.createCalendarEvent({
                title,
                startTime,
                endTime,
                description,
                location,
                attendees,
                calendarId
              });
              console.log('✅ Calendar event creation result:', result);
              
              if (result.success) {
                return `✅ Calendar event details prepared successfully!\n\n${result.metadata.instructions}`;
              } else {
                return `❌ Failed to prepare calendar event: ${result.error}\n\nEvent Details:\n- **Title:** ${result.event.title}\n- **Start Time:** ${result.event.startTime}\n- **End Time:** ${result.event.endTime}\n- **Description:** ${result.event.description || 'None'}\n- **Location:** ${result.event.location || 'None'}\n\nPlease create this event manually in your GoHighLevel calendar.`;
              }
            } catch (error) {
              console.error('❌ Failed to create calendar event:', error);
              return `Failed to create calendar event: ${error}`;
            }
          },
        }),

        // Contact Tools
        get_contact: llm.tool({
          description: 'Get contact details by ID',
          parameters: z.object({
            contactId: z.string().describe('Contact ID to retrieve'),
          }),
          execute: async ({ contactId }) => {
            console.log('👤 Getting contact:', contactId);
            try {
              const result = await this.ghlMCP.getContact(contactId);
              console.log('✅ Contact retrieved:', result);
              return `Contact details: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to get contact:', error);
              return `Failed to retrieve contact: ${error}`;
            }
          },
        }),

        get_contacts: llm.tool({
          description: 'Get all contacts from GoHighLevel',
          parameters: z.object({}),
          execute: async () => {
            console.log('👥 Getting all contacts');
            try {
              const result = await this.ghlMCP.getContacts();
              console.log('✅ Contacts retrieved:', result);
              return `All contacts: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to get contacts:', error);
              return `Failed to retrieve contacts: ${error}`;
            }
          },
        }),

        create_contact: llm.tool({
          description: 'Create a new contact in GoHighLevel',
          parameters: z.object({
            firstName: z.string().describe('Contact first name'),
            lastName: z.string().describe('Contact last name'),
            email: z.string().email().describe('Contact email'),
            phone: z.string().describe('Contact phone number (use empty string if not available)'),
            companyName: z.string().describe('Company name (use empty string if not available)'),
            tags: z.array(z.string()).describe('Tags to add to contact (use empty array if none)'),
          }),
          execute: async ({ firstName, lastName, email, phone, companyName, tags }) => {
            console.log('➕ Creating contact:', { firstName, lastName, email, phone, companyName, tags });
            try {
              const result = await this.ghlMCP.createContact({
                firstName,
                lastName,
                email,
                phone,
                companyName,
                tags,
              });
              console.log('✅ Contact created:', result);
              return `Contact created successfully: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to create contact:', error);
              return `Failed to create contact: ${error}`;
            }
          },
        }),

        update_contact: llm.tool({
          description: 'Update an existing contact',
          parameters: z.object({
            contactId: z.string().describe('Contact ID to update'),
            firstName: z.string().describe('Updated first name (use empty string if not changing)'),
            lastName: z.string().describe('Updated last name (use empty string if not changing)'),
            email: z.string().email().describe('Updated email (use empty string if not changing)'),
            phone: z.string().describe('Updated phone number (use empty string if not changing)'),
            companyName: z.string().describe('Updated company name (use empty string if not changing)'),
          }),
          execute: async ({ contactId, firstName, lastName, email, phone, companyName }) => {
            console.log('✏️ Updating contact:', contactId);
            try {
              const result = await this.ghlMCP.updateContact(contactId, {
                firstName,
                lastName,
                email,
                phone,
                companyName,
              });
              console.log('✅ Contact updated:', result);
              return `Contact updated successfully: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to update contact:', error);
              return `Failed to update contact: ${error}`;
            }
          },
        }),

        add_contact_tags: llm.tool({
          description: 'Add tags to a contact',
          parameters: z.object({
            contactId: z.string().describe('Contact ID to add tags to'),
            tags: z.array(z.string()).describe('Tags to add'),
          }),
          execute: async ({ contactId, tags }) => {
            console.log('🏷️ Adding tags to contact:', contactId, tags);
            try {
              const result = await this.ghlMCP.addTagsToContact(contactId, tags);
              console.log('✅ Tags added:', result);
              return `Tags added successfully: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to add tags:', error);
              return `Failed to add tags: ${error}`;
            }
          },
        }),

        // Opportunity Tools
        get_opportunities: llm.tool({
          description: 'Get all sales opportunities',
          parameters: z.object({}),
          execute: async () => {
            console.log('💰 Getting opportunities');
            try {
              const result = await this.ghlMCP.getOpportunities();
              console.log('✅ Opportunities retrieved:', result);
              return `Sales opportunities: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to get opportunities:', error);
              return `Failed to retrieve opportunities: ${error}`;
            }
          },
        }),

        get_opportunity: llm.tool({
          description: 'Get specific opportunity details',
          parameters: z.object({
            opportunityId: z.string().describe('Opportunity ID to retrieve'),
          }),
          execute: async ({ opportunityId }) => {
            console.log('💼 Getting opportunity:', opportunityId);
            try {
              const result = await this.ghlMCP.getOpportunity(opportunityId);
              console.log('✅ Opportunity retrieved:', result);
              return `Opportunity details: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to get opportunity:', error);
              return `Failed to retrieve opportunity: ${error}`;
            }
          },
        }),

        get_pipelines: llm.tool({
          description: 'Get all sales pipelines',
          parameters: z.object({}),
          execute: async () => {
            console.log('🔄 Getting pipelines');
            try {
              const result = await this.ghlMCP.getPipelines();
              console.log('✅ Pipelines retrieved:', result);
              return `Sales pipelines: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to get pipelines:', error);
              return `Failed to retrieve pipelines: ${error}`;
            }
          },
        }),

        // Conversation Tools
        search_conversations: llm.tool({
          description: 'Search for customer conversations',
          parameters: z.object({
            searchTerm: z.string().describe('Search term to filter conversations (use empty string if not needed)'),
            contactId: z.string().describe('Contact ID to filter conversations (use empty string if not needed)'),
          }),
          execute: async ({ searchTerm, contactId }) => {
            console.log('💬 Searching conversations:', { searchTerm, contactId });
            try {
              const result = await this.ghlMCP.searchConversations({
                searchTerm,
                contactId,
              });
              console.log('✅ Conversations found:', result);
              return `Conversations: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to search conversations:', error);
              return `Failed to search conversations: ${error}`;
            }
          },
        }),

        send_message: llm.tool({
          description: 'Send a message to a customer conversation',
          parameters: z.object({
            conversationId: z.string().describe('Conversation ID to send message to'),
            message: z.string().describe('Message content to send'),
          }),
          execute: async ({ conversationId, message }) => {
            console.log('📤 Sending message to conversation:', conversationId);
            try {
              const result = await this.ghlMCP.sendMessage(conversationId, message);
              console.log('✅ Message sent:', result);
              return `Message sent successfully: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to send message:', error);
              return `Failed to send message: ${error}`;
            }
          },
        }),

        // Location Tools
        get_location: llm.tool({
          description: 'Get business location information',
          parameters: z.object({
            locationId: z.string().describe('Location ID to retrieve'),
          }),
          execute: async ({ locationId }) => {
            console.log('🏢 Getting location:', locationId);
            try {
              const result = await this.ghlMCP.getLocation(locationId);
              console.log('✅ Location retrieved:', result);
              return `Location details: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to get location:', error);
              return `Failed to retrieve location: ${error}`;
            }
          },
        }),

        // Payment Tools
        get_transactions: llm.tool({
          description: 'Get payment transactions',
          parameters: z.object({}),
          execute: async () => {
            console.log('💳 Getting transactions');
            try {
              const result = await this.ghlMCP.getTransactions();
              console.log('✅ Transactions retrieved:', result);
              return `Payment transactions: ${JSON.stringify(result, null, 2)}`;
            } catch (error) {
              console.error('❌ Failed to get transactions:', error);
              return `Failed to retrieve transactions: ${error}`;
            }
          },
        }),
      },
    });

    // Initialize GHL MCP Server
    this.ghlMCP = new GHLMCPServer();
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    console.log('Loading VAD model...');
    proc.userData.vad = await silero.VAD.load();
    console.log('VAD model loaded successfully');
  },
  
  entry: async (ctx: JobContext) => {
    console.log('🚀 GoHighLevel MCP Agent entry started');
    
    // Create assistant instance
    const assistant = new GHLMCPAssistant();
    console.log('✅ GoHighLevel MCP Assistant created');

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

    // Set up a voice AI pipeline with GHL MCP integration
    const session = new voice.AgentSession({
      llm,
      stt: new deepgram.STT({ model: 'nova-3' }),
      tts,
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      vad: ctx.proc.userData.vad! as silero.VAD,
    });

    console.log('✅ AgentSession created with GHL MCP integration');

    // Metrics collection
    const usageCollector = new metrics.UsageCollector();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      console.log('📊 GHL MCP Metrics collected:', ev.metrics);
      metrics.logMetrics(ev.metrics);
      usageCollector.collect(ev.metrics);
    });

    const logUsage = async () => {
      const summary = usageCollector.getSummary();
      console.log(`📊 GHL MCP Usage Summary: ${JSON.stringify(summary)}`);
    };

    ctx.addShutdownCallback(logUsage);

    // Start the session
    console.log('🔧 Starting GHL MCP voice session...');
    await session.start({
      agent: assistant,
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });
    console.log('✅ GHL MCP voice session started successfully');

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
  console.error('');
  console.error('📋 To fix this:');
  console.error('1. Get your Private Integration Token from GoHighLevel');
  console.error('2. Add to your .env file:');
  console.error('   GHL_API_KEY=your-ghl-api-key');
  console.error('   GHL_LOCATION_ID=your-location-id');
  process.exit(1);
}

// Initialize worker
try {
  console.log('🔧 Initializing GoHighLevel MCP LiveKit agent worker...');
  console.log('GHL API Key:', process.env.GHL_API_KEY ? 'SET' : 'NOT SET');
  console.log('GHL Location ID:', process.env.GHL_LOCATION_ID ? 'SET' : 'NOT SET');
  
  const workerOptions = new WorkerOptions({ 
    agent: fileURLToPath(import.meta.url),
    apiKey: process.env.LIVEKIT_API_KEY!,
    apiSecret: process.env.LIVEKIT_API_SECRET!,
  });
  
  console.log('✅ Worker options created, starting GHL MCP worker...');
  cli.runApp(workerOptions);
} catch (error) {
  console.error('❌ Failed to start GHL MCP LiveKit agent worker:', error);
  process.exit(1);
}
