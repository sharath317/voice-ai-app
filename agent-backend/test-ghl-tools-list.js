import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testGHLToolsList() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  console.log('🔍 Testing GHL MCP API - List available tools...');

  try {
    // First, let's try to list available tools
    console.log('\n📡 Requesting available tools...');

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
    console.log('📡 Raw Response:', responseText);

    // Parse SSE response
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
          console.log('📡 Available Tools:', JSON.stringify(data, null, 2));
        } catch (parseError) {
          console.log('📡 Failed to parse tools list');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Now let's try a different calendar tool
  console.log('\n🧪 Testing different calendar tool...');

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
        method: 'tools/call',
        params: {
          name: 'calendars_get-calendars',
          arguments: {},
        },
        id: Date.now(),
      }),
    });

    console.log('📡 Response Status:', response.status);

    const responseText = await response.text();
    console.log('📡 Raw Response:', responseText);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testGHLToolsList();

