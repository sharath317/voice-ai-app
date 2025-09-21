# 🛠️ Mastra Tools Setup & Testing Guide

This guide will help you test and use the Mastra tools integrated with your LiveKit voice agent.

## 🎯 Available Tools

Your Mastra + LiveKit agent now has **4 powerful tools** that work through natural voice conversation:

### 1. 📝 **User Information Capture**

- **What it does**: Automatically captures and stores user details
- **Triggers**: When users share personal information
- **Stores**: Name, email, phone, company, role, interests

### 2. 🎯 **Sentiment Analysis**

- **What it does**: Analyzes conversation mood and engagement
- **Triggers**: During conversations to track user satisfaction
- **Tracks**: Sentiment (positive/neutral/negative), engagement level, confidence

### 3. 📅 **Follow-up Scheduling**

- **What it does**: Schedules future interactions
- **Triggers**: When users want to continue the conversation later
- **Manages**: Call/meeting/email scheduling with dates, times, duration

### 4. 🧠 **Memory Context Retrieval**

- **What it does**: Accesses stored conversation history
- **Triggers**: When agent needs to reference previous interactions
- **Provides**: Complete memory context or filtered information

## 🧪 Testing the Tools

### **Test 1: User Information Capture**

**Say to the agent:**

```
"Hi, my name is John Smith, I work at Acme Corp as a Product Manager,
and my email is john@acme.com. I'm interested in AI automation tools."
```

**Expected behavior:**

- Agent should acknowledge the information
- Check logs for: `📝 Capturing user info via voice:`
- Memory should store: `{ name: "John Smith", company: "Acme Corp", role: "Product Manager", email: "john@acme.com", interests: ["AI automation tools"] }`

### **Test 2: Sentiment Analysis**

**Say to the agent:**

```
"I'm really excited about this technology! This is exactly what I've been looking for.
I can see how this would help our team be more productive."
```

**Expected behavior:**

- Agent should recognize positive sentiment
- Check logs for: `🎯 Analyzing sentiment via voice:`
- Memory should store: `{ sentiment: "positive", engagement: "high", confidence: 0.9 }`

### **Test 3: Follow-up Scheduling**

**Say to the agent:**

```
"I'd like to schedule a follow-up call next week to discuss this further.
How about Tuesday at 2 PM for 30 minutes?"
```

**Expected behavior:**

- Agent should acknowledge the scheduling request
- Check logs for: `📅 Scheduling follow-up via voice:`
- Memory should store: `{ type: "call", preferredDate: "2024-01-XX", preferredTime: "2 PM", duration: 30 }`

### **Test 4: Memory Context Retrieval**

**Say to the agent:**

```
"What do you remember about me from our conversation?"
```

**Expected behavior:**

- Agent should reference stored information
- Check logs for: `🧠 Retrieving memory context via voice:`
- Should mention: Name, company, role, interests, sentiment, follow-up

## 🔍 Monitoring Tool Execution

### **Real-time Logs**

Watch the terminal for these log messages:

```bash
📝 Capturing user info via voice: { name: "John", company: "Acme" }
🎯 Analyzing sentiment via voice: { sentiment: "positive", engagement: "high" }
📅 Scheduling follow-up via voice: { type: "call", date: "2024-01-15" }
🧠 Retrieving memory context via voice: { type: "all" }
```

### **Memory Context Logs**

Every 30 seconds, you'll see:

```bash
🧠 Mastra Memory Context:
  User Info: { name: "John Smith", company: "Acme Corp" }
  Sentiment: { sentiment: "positive", engagement: "high" }
  Follow-up: { type: "call", date: "2024-01-15" }
```

## 🎮 Interactive Testing Scenarios

### **Scenario 1: New User Onboarding**

1. **Start**: "Hi, I'm new here and want to learn about your services"
2. **Share info**: "I'm Sarah from TechCorp, I'm a CTO looking for AI solutions"
3. **Express interest**: "This sounds amazing! I'm very interested in learning more"
4. **Schedule follow-up**: "Can we schedule a demo call for next week?"

### **Scenario 2: Returning User**

1. **Start**: "Hi, we spoke last week about AI automation"
2. **Agent should**: Remember previous conversation details
3. **Continue**: "I'd like to move forward with the implementation"
4. **Agent should**: Reference stored information and sentiment

### **Scenario 3: Sentiment Tracking**

1. **Start positive**: "This is exactly what I needed!"
2. **Change to neutral**: "I need to think about it more"
3. **End negative**: "Actually, this might not be the right fit"
4. **Agent should**: Track sentiment changes and adjust approach

## 🚀 Advanced Testing

### **Test Memory Persistence**

1. Have a conversation and share information
2. Disconnect and reconnect
3. Ask: "What do you remember about me?"
4. **Note**: Current implementation uses in-memory storage, so memory resets on restart

### **Test Multiple Tools in One Conversation**

```
"Hi, I'm Mike from StartupXYZ. I'm really excited about this!
Can we schedule a call for tomorrow at 3 PM? I'd love to learn more
about how this could help our team."
```

This should trigger:

- ✅ User info capture (name, company)
- ✅ Sentiment analysis (excited = positive)
- ✅ Follow-up scheduling (call, tomorrow, 3 PM)

## 🔧 Troubleshooting

### **Tools Not Working?**

1. **Check logs**: Look for tool execution messages
2. **Verify instructions**: Agent should mention tools in responses
3. **Test simple cases**: Start with basic information sharing
4. **Check memory**: Verify data is being stored

### **Memory Not Persisting?**

- Current implementation uses in-memory storage
- Memory resets when agent restarts
- For persistence, configure database storage

### **Agent Not Responding to Tools?**

- Ensure agent instructions mention tool usage
- Try more explicit requests: "Please remember my name is John"
- Check that the agent is using the updated instructions

## 📊 Success Metrics

### **Tool Execution Success**

- ✅ User info captured automatically
- ✅ Sentiment analyzed during conversations
- ✅ Follow-ups scheduled when requested
- ✅ Memory context retrieved accurately

### **Conversation Quality**

- ✅ Agent references stored information
- ✅ Responses are personalized based on memory
- ✅ Follow-up suggestions are relevant
- ✅ Sentiment-appropriate responses

## 🎯 Next Steps

1. **Test all tools** using the scenarios above
2. **Monitor logs** for tool execution
3. **Verify memory storage** in the 30-second logs
4. **Customize tools** for your specific use case
5. **Add persistent storage** for production use

---

**Ready to test?** Start the agent and try the scenarios above! 🚀

```bash
pnpm run dev:mastra-livekit
```

The tools are now fully integrated and ready for voice interaction testing! 🎉

