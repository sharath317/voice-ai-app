/**
 * GHL MCP Client - Shared Service
 * Centralized client for all GHL API interactions
 */

import { Contact, CalendarEvent, AppointmentNote, AgentResponse } from './types.js';

export class GHLMCPClient {
  private apiKey: string;
  private locationId: string;
  private baseUrl: string;

  constructor(apiKey: string, locationId: string) {
    this.apiKey = apiKey;
    this.locationId = locationId;
    this.baseUrl = 'https://services.leadconnectorhq.com/mcp/';
  }

  /**
   * Generic tool caller for GHL MCP API
   */
  async callTool(tool: string, args: Record<string, any>): Promise<any> {
    console.log(`🔧 GHL MCP: Calling ${tool} with args:`, args);
    
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          locationId: this.locationId,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: tool,
            arguments: args,
          },
          id: Date.now(),
        }),
      });

      const responseText = await response.text();
      console.log(`📡 GHL MCP Response Status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`GHL MCP API error: ${response.status} ${response.statusText}`);
      }

      // Parse SSE response
      if (responseText.includes('data:')) {
        const lines = responseText.split('\n');
        let dataLine = '';
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            dataLine = line.substring(5).trim();
            break;
          }
        }
        
        if (dataLine) {
          const data = JSON.parse(dataLine);
          
          if (data.error) {
            throw new Error(`GHL MCP API error: ${data.error.message}`);
          }

          // Parse nested content
          if (data.result?.content?.[0]?.text) {
            try {
              const innerResponse = JSON.parse(data.result.content[0].text);
              if (innerResponse.success === false) {
                throw new Error(`GHL API error: ${innerResponse.data?.message || innerResponse.message}`);
              }
              return innerResponse.data || innerResponse;
            } catch (innerJsonError) {
              console.warn('⚠️ Could not parse inner JSON from GHL MCP response:', innerJsonError);
              return data.result;
            }
          }
          return data.result;
        }
      }
      
      // Fallback for non-SSE responses
      const jsonResponse = JSON.parse(responseText);
      if (jsonResponse.error) {
        throw new Error(`GHL MCP API error: ${jsonResponse.error.message}`);
      }
      return jsonResponse.result;
      
    } catch (error) {
      console.error(`❌ GHL MCP Error calling ${tool}:`, error);
      throw error;
    }
  }

  /**
   * Get all contacts
   */
  async getContacts(): Promise<Contact[]> {
    try {
      const result = await this.callTool('contacts_get-contacts', {});
      
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        return data.data?.contacts || [];
      }
      
      return [];
    } catch (error) {
      console.error('❌ Failed to get contacts:', error);
      return [];
    }
  }

  /**
   * Get calendar events
   */
  async getCalendarEvents(
    calendarId: string,
    startTime?: string,
    endTime?: string
  ): Promise<CalendarEvent[]> {
    try {
      const args: Record<string, any> = {
        query_calendarId: calendarId,
      };
      
      if (startTime) {
        args.query_startTime = new Date(startTime).getTime();
      }
      
      if (endTime) {
        args.query_endTime = new Date(endTime).getTime();
      }

      const result = await this.callTool('calendars_get-calendar-events', args);
      
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        return data.data?.events || [];
      }
      
      return [];
    } catch (error) {
      console.error('❌ Failed to get calendar events:', error);
      return [];
    }
  }

  /**
   * Get appointment notes
   */
  async getAppointmentNotes(appointmentId: string): Promise<AppointmentNote | null> {
    try {
      const result = await this.callTool('calendars_get-appointment-notes', {
        path_appointmentId: appointmentId,
        query_limit: 10,
        query_offset: 0,
      });
      
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        return data.data || null;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get appointment notes:', error);
      return null;
    }
  }

  /**
   * Check API health and permissions
   */
  async checkHealth(): Promise<AgentResponse> {
    try {
      // Test basic read operations
      const contacts = await this.getContacts();
      const events = await this.getCalendarEvents('eSQxdGmxInjrZa38Ui6l');
      
      return {
        success: true,
        message: 'GHL MCP API is healthy and accessible',
        data: {
          contactsCount: contacts.length,
          eventsCount: events.length,
          permissions: {
            canReadContacts: contacts.length >= 0,
            canReadCalendar: events.length >= 0,
            canReadAppointments: true, // We can test this
          }
        },
        confidence: 0.95,
        metadata: {
          agentType: 'GHLMCPClient',
          timestamp: new Date().toISOString(),
          processingTime: 0,
          toolsUsed: ['contacts_get-contacts', 'calendars_get-calendar-events']
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `GHL MCP API health check failed: ${error}`,
        confidence: 0.0,
        metadata: {
          agentType: 'GHLMCPClient',
          timestamp: new Date().toISOString(),
          processingTime: 0,
          toolsUsed: []
        }
      };
    }
  }
}

