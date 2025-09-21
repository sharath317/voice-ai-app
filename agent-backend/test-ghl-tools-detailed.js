import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testGHLToolsDetailed() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  console.log('🔍 Getting detailed GHL tools list...');
  console.log('API Key:', apiKey ? 'SET' : 'NOT SET');
  console.log('Location ID:', locationId ? 'SET' : 'NOT SET');

  if (!apiKey || !locationId) {
    console.error('❌ Missing required environment variables');
    return;
  }

  try {
    const response = await fetch('https://services.leadconnectorhq.com/mcp/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        locationId: locationId,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: Date.now(),
      }),
    });

    console.log('📡 Response Status:', response.status);

    const responseText = await response.text();
    console.log('📡 Raw Response (first 1000 chars):', responseText.substring(0, 1000));

    // Parse the response
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
        try {
          const data = JSON.parse(dataLine);
          console.log('✅ Tools list parsed successfully');

          if (data.result && data.result.tools) {
            console.log(`\n📋 Found ${data.result.tools.length} available tools:`);

            // Find calendar-related tools
            const calendarTools = data.result.tools.filter(
              (tool) =>
                tool.name.toLowerCase().includes('calendar') ||
                tool.name.toLowerCase().includes('event') ||
                tool.name.toLowerCase().includes('appointment'),
            );

            console.log(`\n📅 Calendar-related tools (${calendarTools.length}):`);
            calendarTools.forEach((tool) => {
              console.log(`\n🔧 Tool: ${tool.name}`);
              console.log(`📝 Description: ${tool.description}`);
              console.log(`📋 Input Schema:`, JSON.stringify(tool.inputSchema, null, 2));
            });

            // Also show all tools for reference
            console.log(`\n📋 All available tools:`);
            data.result.tools.forEach((tool, index) => {
              console.log(`${index + 1}. ${tool.name}`);
            });
          }
        } catch (parseError) {
          console.log('❌ Failed to parse tools list:', parseError.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testGHLToolsDetailed();

