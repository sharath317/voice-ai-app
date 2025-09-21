/**
 * Enterprise Agent Shared Types
 * Common types and interfaces used across all enterprise agents
 */

export interface Contact {
  id: string;
  contactName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName?: string;
  type: 'lead' | 'customer' | 'prospect';
  source: string;
  tags: string[];
  customFields: CustomField[];
  dateAdded: string;
  dateUpdated: string;
  locationId: string;
}

export interface CustomField {
  key: string;
  value: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  location?: string;
  attendees: string[];
  calendarId: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

export interface AppointmentNote {
  appointmentId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessMetrics {
  totalContacts: number;
  activeLeads: number;
  scheduledAppointments: number;
  conversionRate: number;
  averageResponseTime: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  action: string;
  parameters: Record;
  nextSteps: string[];
  conditions?: Record;
}

export interface AgentCapabilities {
  canReadContacts: boolean;
  canReadCalendar: boolean;
  canReadAppointments: boolean;
  canCreateEvents: boolean;
  canUpdateContacts: boolean;
  canSendMessages: boolean;
  canManageOpportunities: boolean;
}

export interface AgentConfig {
  name: string;
  description: string;
  capabilities: AgentCapabilities;
  workflows: WorkflowStep[];
  fallbackActions: string[];
  businessRules: Record;
}

export interface SessionContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  startTime: string;
  lastActivity: string;
  context: Record;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  data?: unknown;
  nextActions?: string[];
  requiresHuman?: boolean;
  confidence: number;
  metadata: {
    agentType: string;
    timestamp: string;
    processingTime: number;
    toolsUsed: string[];
  };
}
