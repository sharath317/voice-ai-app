# 🏢 GoHighLevel MCP Integration Setup Guide

This guide will help you set up and use the GoHighLevel MCP (Model Context Protocol) server integration with your LiveKit voice AI agent.

## 🎯 What is GoHighLevel MCP?

The [GoHighLevel MCP server](https://help.gohighlevel.com/support/solutions/articles/155000005741-how-to-use-the-highlevel-mcp-server) is a standardized, secure protocol that allows AI agents to read and write data in GoHighLevel without needing SDKs or deep custom integrations. Your voice agent can now access critical business tools like Calendar, Contacts, Conversations, Opportunities, and Payments through a single, unified interface.

## 🔧 Prerequisites

Before you begin, ensure you have:

- **GoHighLevel Account**: Active GoHighLevel subscription
- **Private Integration Token (PIT)**: Generated from your GoHighLevel location
- **Location ID**: Your GoHighLevel sub-account ID
- **LiveKit Server**: Running LiveKit server instance
- **API Keys**: Deepgram, Cartesia, and OpenRouter/OpenAI keys

## 📋 Environment Variables Setup

Add these variables to your `.env` file:

```env
# GoHighLevel MCP Configuration
GHL_API_KEY=your-private-integration-token
GHL_LOCATION_ID=your-location-id

# LiveKit Configuration
LIVEKIT_URL=wss://your-livekit-server-url
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# LLM Provider (choose one)
OPENROUTER_API_KEY=your-openrouter-api-key
# OR
OPENAI_API_KEY=your-openai-api-key

# STT Provider
DEEPGRAM_API_KEY=your-deepgram-api-key

# TTS Provider
CARTESIA_API_KEY=your-cartesia-api-key
```

## 🔑 Getting Your GoHighLevel Credentials

### Step 1: Get Your Private Integration Token (PIT)

1. **Login to GoHighLevel**: Go to your GoHighLevel dashboard
2. **Navigate to Settings**: Go to Settings → Private Integrations
3. **Create New Integration**: Click "Create New Integration"
4. **Select Required Scopes**:
   - ✅ View/Edit Contacts
   - ✅ View/Edit Conversations
   - ✅ View/Edit Conversation Messages
   - ✅ View/Edit Opportunities
   - ✅ View Calendars & Calendar Events
   - ✅ View Locations
   - ✅ View Payment Orders & Transactions
   - ✅ View Custom Fields
   - ✅ View Forms
5. **Copy Token**: Securely store your PIT token

### Step 2: Get Your Location ID

1. **Go to Settings**: In your GoHighLevel dashboard
2. **Find Location ID**: Look for your sub-account ID (usually in URL or settings)
3. **Copy Location ID**: This is your `GHL_LOCATION_ID`

## 🚀 Running the GHL MCP Agent

### Start the Agent

```bash
cd /Users/sharathchandra/Projects/voice-ai-app/agent-backend
pnpm run dev:ghl-mcp
```

### Expected Output

```bash
🚀 GoHighLevel MCP Agent entry started
✅ GoHighLevel MCP Assistant created
✅ Using OpenRouter LLM provider
✅ Using Cartesia TTS provider
✅ AgentSession created with GHL MCP integration
🔧 Starting GHL MCP voice session...
✅ GHL MCP voice session started successfully
🔧 Connecting to room...
✅ Connected to room successfully
```

## 🛠️ Available Tools

Your voice agent now has access to **21 powerful GoHighLevel tools**:

### 📅 Calendar Management

- **`get_calendar_events`**: View calendar events and appointments
- **`get_appointment_notes`**: Retrieve notes for specific appointments

### 👥 Contact Management

- **`get_contact`**: Fetch contact details by ID
- **`get_contacts`**: List all contacts
- **`create_contact`**: Create new customer contacts
- **`update_contact`**: Update existing contact information
- **`add_contact_tags`**: Add tags to contacts for organization

### 💰 Opportunity Management

- **`get_opportunities`**: View sales opportunities
- **`get_opportunity`**: Get specific opportunity details
- **`get_pipelines`**: View sales pipelines

### 💬 Conversation Management

- **`search_conversations`**: Find customer conversations
- **`get_messages`**: Retrieve conversation messages
- **`send_message`**: Send messages to customers

### 🏢 Location & Payment Tools

- **`get_location`**: Access business location information
- **`get_transactions`**: List payment transactions

## 🧪 Testing the Integration

### Test 1: Calendar Events

**Say to the agent:**

```
"Show me my calendar events for today"
```

**Expected behavior:**

- Agent calls `get_calendar_events` tool
- Retrieves your calendar data from GoHighLevel
- Displays events in a readable format

### Test 2: Contact Management

**Say to the agent:**

```
"Show me all my contacts"
```

**Expected behavior:**

- Agent calls `get_contacts` tool
- Retrieves contact list from GoHighLevel
- Displays contact information

### Test 3: Create New Contact

**Say to the agent:**

```
"Create a new contact named John Smith with email john@example.com"
```

**Expected behavior:**

- Agent calls `create_contact` tool
- Creates new contact in GoHighLevel
- Confirms successful creation

### Test 4: Sales Opportunities

**Say to the agent:**

```
"Show me my sales opportunities"
```

**Expected behavior:**

- Agent calls `get_opportunities` tool
- Retrieves opportunity data from GoHighLevel
- Displays sales pipeline information

## 📊 Monitoring Tool Execution

### Real-time Logs

Watch the terminal for these log messages:

```bash
📅 Getting calendar events: { userId: "123", calendarId: "eSQxdGmxInjrZa38Ui6l" }
✅ Calendar events retrieved: { events: [...] }
👥 Getting all contacts
✅ Contacts retrieved: { contacts: [...] }
➕ Creating contact: { firstName: "John", lastName: "Smith", email: "john@example.com" }
✅ Contact created: { contactId: "abc123", ... }
```

### Error Handling

```bash
❌ GHL MCP Tool calendars_get-calendar-events failed: 401 Unauthorized
❌ Failed to get calendar events: Invalid API key
```

## 🔍 Your Calendar Integration

Based on your sample calendar data:

- **Calendar ID**: `eSQxdGmxInjrZa38Ui6l`
- **Booking URL**: `https://api.leadconnectorhq.com/widget/booking/eSQxdGmxInjrZa38Ui6l`

### Test Your Calendar

**Say to the agent:**

```
"Show me calendar events for calendar ID eSQxdGmxInjrZa38Ui6l"
```

This should retrieve your specific calendar events and display them in the conversation.

## 🎯 Voice Commands Examples

### Calendar Management

```
"Show me my appointments for today"
"What's on my calendar this week?"
"Get appointment notes for appointment ID 123"
"Show me all calendar events"
```

### Contact Management

```
"Show me all my contacts"
"Create a new contact named Sarah Johnson"
"Update contact John Smith's email to john.new@example.com"
"Add tags 'VIP' and 'Premium' to contact ID 456"
"Get contact details for contact ID 789"
```

### Sales Management

```
"Show me my sales opportunities"
"What's in my sales pipeline?"
"Get details for opportunity ID 101"
"Show me all my pipelines"
```

### Communication

```
"Search for conversations with John Smith"
"Send a message to conversation ID 202"
"Show me messages from conversation ID 303"
```

## 🚨 Troubleshooting

### Common Issues

#### 1. API Key Issues

```bash
❌ Missing GoHighLevel API key
```

**Solution**: Add `GHL_API_KEY` to `.env` file with your PIT token

#### 2. Location ID Issues

```bash
❌ Missing GoHighLevel Location ID
```

**Solution**: Add `GHL_LOCATION_ID` to `.env` file with your sub-account ID

#### 3. Permission Issues

```bash
❌ GHL MCP Tool failed: 403 Forbidden
```

**Solution**: Check that your PIT has all required scopes

#### 4. Calendar Not Found

```bash
❌ Failed to get calendar events: 404 Not Found
```

**Solution**: Verify your calendar ID is correct

### Debug Mode

Enable detailed logging by checking the console output for:

- ✅ Successful tool executions
- ❌ Failed API calls
- 📊 Usage metrics
- 🔧 Connection status

## 📈 Benefits of GHL MCP Integration

### 1. Unified Business Management

- **Single Interface**: Access all GoHighLevel features through voice
- **Real-time Data**: Get live business information instantly
- **Seamless Integration**: No need for multiple apps or dashboards

### 2. Enhanced Productivity

- **Voice Commands**: Manage business tasks hands-free
- **Quick Access**: Get information without navigating interfaces
- **Automated Workflows**: Streamline repetitive business tasks

### 3. Customer Experience

- **Instant Information**: Access customer data during calls
- **Real-time Updates**: Update records while speaking with customers
- **Comprehensive View**: See complete customer journey

## 🎯 Next Steps

1. **Test All Tools**: Try each available tool through voice commands
2. **Customize Workflows**: Create specific voice commands for your business
3. **Monitor Performance**: Watch logs for successful integrations
4. **Expand Usage**: Use the agent for daily business management
5. **Provide Feedback**: Report any issues or suggest improvements

## 📚 Additional Resources

- [GoHighLevel MCP Documentation](https://help.gohighlevel.com/support/solutions/articles/155000005741-how-to-use-the-highlevel-mcp-server)
- [GoHighLevel API Documentation](https://highlevel.stoplight.io/)
- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)

---

## 🎉 Summary

Your voice AI agent now has full access to GoHighLevel's business management tools through the MCP server! You can:

✅ **Manage Calendar Events** - View and manage appointments
✅ **Handle Contacts** - Create, update, and organize customers
✅ **Track Opportunities** - Monitor sales pipelines
✅ **Manage Conversations** - Handle customer communications
✅ **Access Business Data** - Get real-time business insights

**Ready to test?** Start the agent and try the voice commands above! 🚀

```bash
pnpm run dev:ghl-mcp
```

Your GoHighLevel MCP integration is now ready for voice-powered business management! 🎉

