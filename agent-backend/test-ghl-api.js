import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testGHLAPI() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  console.log('🔍 Testing GHL MCP API directly...');
  console.log('API Key:', apiKey ? 'SET' : 'NOT SET');
  console.log('Location ID:', locationId ? 'SET' : 'NOT SET');

  if (!apiKey || !locationId) {
    console.error('❌ Missing required environment variables');
    return;
  }

  try {
    console.log('\n📡 Making request to GHL MCP API...');

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
          name: 'calendars_get-calendar-events',
          arguments: {
            userId: '',
            groupId: '',
            calendarId: 'eSQxdGmxInjrZa38Ui6l',
            startTime: '2024-01-01T00:00:00Z',
            endTime: '2024-01-31T23:59:59Z',
          },
        },
        id: Date.now(),
      }),
    });

    console.log('📡 Response Status:', response.status);
    console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('📡 Raw Response:', responseText);

    // Try to parse as JSON
    try {
      const jsonResponse = JSON.parse(responseText);
      console.log('📡 Parsed JSON:', JSON.stringify(jsonResponse, null, 2));
    } catch (parseError) {
      console.log('📡 Not valid JSON, treating as text/SSE');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testGHLAPI();

