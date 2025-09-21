# 🚀 **GHL (GoHighLevel) CRM Integration Setup Guide**

## 📋 **Overview**

This guide will help you set up the GHL CRM integration with your enhanced sales agent. The integration provides automatic contact creation, opportunity management, lead scoring, sentiment analysis, competitive intelligence tracking, and calendar scheduling.

## 🔑 **GHL API Key Setup**

### **1. Your GHL API Key**

Your GHL API key has been provided:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2NhdGlvbl9pZCI6IlROQ0NXOTZsbWdxUXdLWjRrY0RrIiwidmVyc2lvbiI6MSwiaWF0IjoxNzU4MDg4MjA2NTUwLCJzdWIiOiJUSU5ud01WTHlFekE4YnZTZUtKcSJ9.vHeMrTbqNF9zaLf9n1AJgrF0RMnRJJGnPruEnhgSVyU
```

### **2. Environment Variables**

Add this to your `.env` file in the `agent-backend` directory:

```bash
# GHL (GoHighLevel) CRM Integration
GHL_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2NhdGlvbl9pZCI6IlROQ0NXOTZsbWdxUXdLWjRrY0RrIiwidmVyc2lvbiI6MSwiaWF0IjoxNzU4MDg4MjA2NTUwLCJzdWIiOiJUSU5ud01WTHlFekE4YnZTZUtKcSJ9.vHeMrTbqNF9zaLf9n1AJgrF0RMnRJJGnPruEnhgSVyU
```

## 🏗️ **Integration Features**

### **1. 📝 Contact Management**

- **Automatic Contact Creation**: Creates contacts in GHL when basic info is captured
- **Contact Tagging**: Adds tags like `ai-sales-agent`, `inbound-lead`, `priority-hot/warm/cold`
- **Custom Fields**: Stores additional contact information

### **2. 💼 Opportunity Management**

- **Automatic Opportunity Creation**: Creates opportunities linked to contacts
- **Pipeline Integration**: Uses your default GHL pipeline and stages
- **Stage Progression**: Updates opportunity stages based on call progress

### **3. 🎯 Lead Scoring**

- **BANT Scoring**: Budget, Authority, Need, Timeline scoring
- **Priority Classification**: Hot, Warm, Cold lead classification
- **Custom Fields**: Stores detailed scoring breakdown and reasoning

### **4. 😊 Sentiment Analysis**

- **Real-time Sentiment**: Tracks prospect sentiment during calls
- **Engagement Level**: Monitors engagement (high, medium, low)
- **Interest Level**: Tracks interest level (very_high to very_low)
- **Notes**: Stores detailed sentiment observations

### **5. 🏢 Competitive Intelligence**

- **Competitor Tracking**: Captures competitor mentions
- **Current Vendor**: Records current solution provider
- **Switching Reasons**: Documents reasons for wanting to switch
- **Competitive Analysis**: Stores competitive landscape data

### **6. ⚠️ Objection Handling**

- **Objection Capture**: Records all objections and concerns
- **Categorization**: Categorizes objections (price, timeline, features, etc.)
- **Response Tracking**: Documents how objections were addressed

### **7. 📅 Calendar Integration**

- **Follow-up Scheduling**: Schedules follow-up calls in GHL Calendar
- **Availability Checking**: Checks available time slots
- **Event Creation**: Creates calendar events with contact and opportunity links

### **8. 📊 Call Summaries**

- **Comprehensive Summaries**: Generates detailed call summaries
- **CRM Notes**: Adds summaries as notes to opportunities
- **Activity Tracking**: Records all call activities

## 🚀 **How to Run with GHL Integration**

### **1. Set Environment Variables**

```bash
cd agent-backend
echo "GHL_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2NhdGlvbl9pZCI6IlROQ0NXOTZsbWdxUXdLWjRrY0RrIiwidmVyc2lvbiI6MSwiaWF0IjoxNzU4MDg4MjA2NTUwLCJzdWIiOiJUSU5ud01WTHlFekE4YnZTZUtKcSJ9.vHeMrTbqNF9zaLf9n1AJgrF0RMnRJJGnPruEnhgSVyU" >> .env
```

### **2. Run the Enhanced Agent**

```bash
pnpm run dev:enhanced
```

### **3. Monitor GHL Integration**

Watch the console logs for GHL integration status:

```
✅ GHL CRM initialized successfully
✅ GHL Contact created: contact_123
✅ GHL Opportunity created: opportunity_456
✅ Lead score synced to GHL CRM
✅ Sentiment analysis synced to GHL CRM
✅ Follow-up call scheduled in GHL Calendar: event_789
```

## 📊 **GHL CRM Data Structure**

### **Contact Fields**

- `firstName`, `lastName`, `name`
- `email`, `phone`
- `companyName`
- `source` (set to "AI Sales Agent")
- `type` (set to "lead")
- `tags` (ai-sales-agent, inbound-lead, priority-\*)

### **Opportunity Fields**

- `contactId` (linked to contact)
- `name` (company - contact opportunity)
- `pipelineId` (your default pipeline)
- `pipelineStageId` (first stage)
- `source` (set to "AI Sales Agent")
- `status` (set to "open")
- `tags` (ai-sales-agent, inbound-opportunity)

### **Custom Fields (Opportunity)**

- `lead_score_overall` (0-10)
- `lead_score_fit` (0-10)
- `lead_score_urgency` (0-10)
- `lead_score_budget` (0-10)
- `lead_score_authority` (0-10)
- `lead_score_need` (0-10)
- `lead_priority` (hot/warm/cold)
- `lead_reasoning` (text)
- `sentiment` (positive/neutral/negative)
- `engagement` (high/medium/low)
- `interest_level` (very_high/high/medium/low/very_low)
- `sentiment_notes` (text)
- `competitors` (comma-separated list)
- `current_vendor` (text)
- `competitor_reasons` (comma-separated list)
- `switching_reasons` (comma-separated list)
- `objections` (comma-separated list)
- `objection_categories` (comma-separated list)
- `objection_responses` (comma-separated list)

### **Calendar Events**

- `title` (Follow-up Call - Contact Name)
- `description` (detailed call information)
- `startTime`, `endTime` (ISO timestamps)
- `contactId` (linked to contact)
- `opportunityId` (linked to opportunity)
- `type` (set to "call")
- `status` (set to "scheduled")

## 🔧 **Troubleshooting**

### **Common Issues**

#### **1. GHL API Connection Failed**

```
❌ Failed to connect to GHL CRM
```

**Solution**: Check your GHL API key and ensure it's valid.

#### **2. Pipeline Not Found**

```
❌ No default pipeline found
```

**Solution**: Ensure you have at least one pipeline set up in your GHL account.

#### **3. Contact Creation Failed**

```
❌ Failed to create GHL contact/opportunity
```

**Solution**: Check GHL API permissions and ensure the location ID is correct.

### **Debug Mode**

Enable debug logging to see detailed GHL API calls:

```bash
DEBUG=ghl* pnpm run dev:enhanced
```

### **Test GHL Connection**

You can test the GHL connection by running:

```bash
node -e "
const { GHLCRMManager } = require('./src/ghl-crm-integration.ts');
const manager = GHLCRMManager.getInstance(process.env.GHL_API_KEY);
manager.initialize().then(() => console.log('✅ GHL connection successful')).catch(console.error);
"
```

## 📈 **Benefits of GHL Integration**

### **For Sales Teams**

- ✅ **Automatic Lead Capture**: No manual data entry
- ✅ **Real-time CRM Updates**: Live sync during calls
- ✅ **Comprehensive Lead Scoring**: BANT-based scoring system
- ✅ **Sentiment Tracking**: Monitor prospect engagement
- ✅ **Competitive Intelligence**: Track competitor mentions
- ✅ **Objection Management**: Systematic objection handling
- ✅ **Calendar Integration**: Automatic follow-up scheduling

### **For Management**

- ✅ **Complete Visibility**: Full call data in GHL
- ✅ **Lead Quality Insights**: Detailed scoring and sentiment
- ✅ **Performance Tracking**: Monitor agent effectiveness
- ✅ **Pipeline Management**: Automatic opportunity creation
- ✅ **Follow-up Automation**: Scheduled call reminders

### **For Prospects**

- ✅ **Seamless Experience**: No manual data entry required
- ✅ **Accurate Information**: AI captures details precisely
- ✅ **Professional Follow-up**: Scheduled calls and reminders
- ✅ **Personalized Approach**: Sentiment-based interactions

## 🎯 **Next Steps**

1. **Test the Integration**: Run a test call to verify GHL sync
2. **Customize Pipelines**: Set up your preferred GHL pipelines
3. **Configure Custom Fields**: Add any additional custom fields needed
4. **Set Up Webhooks**: Configure GHL webhooks for real-time updates
5. **Train Your Team**: Educate your team on the new GHL integration features

## 🆘 **Support**

If you encounter any issues with the GHL integration:

1. Check the console logs for error messages
2. Verify your GHL API key is correct
3. Ensure your GHL account has the necessary permissions
4. Test the GHL API connection independently
5. Contact support with specific error messages

---

## 🎉 **Congratulations!**

Your enhanced sales agent is now fully integrated with GHL CRM! Every call will automatically:

- ✅ Create contacts and opportunities
- ✅ Score leads and track sentiment
- ✅ Capture competitive intelligence
- ✅ Handle objections systematically
- ✅ Schedule follow-up calls
- ✅ Generate comprehensive summaries

Your sales process is now fully automated and integrated! 🚀

