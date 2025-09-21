import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testGHLAgentCurrent() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const calendarId = 'eSQxdGmxInjrZa38Ui6l';

  console.log('🔍 Testing current GHL Agent calendar functionality...');
  console.log('API Key:', apiKey ? 'SET' : 'NOT SET');
  console.log('Location ID:', locationId ? 'SET' : 'NOT SET');
  console.log('Calendar ID:', calendarId);

  if (!apiKey || !locationId) {
    console.error('❌ Missing required environment variables');
    return;
  }

  // Test with the exact same parameters the agent should be using
  console.log('\n📅 Testing with agent parameters...');
  try {
    const startTime = new Date('2024-01-01T00:00:00Z').getTime();
    const endTime = new Date('2024-01-31T23:59:59Z').getTime(); // Using January 2024 like in the logs

    console.log('📅 Parameters being sent:');
    console.log('  query_locationId:', locationId);
    console.log('  query_calendarId:', calendarId);
    console.log('  query_startTime:', startTime.toString());
    console.log('  query_endTime:', endTime.toString());

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
            query_locationId: locationId,
            query_calendarId: calendarId,
            query_startTime: startTime.toString(),
            query_endTime: endTime.toString(),
          },
        },
        id: Date.now(),
      }),
    });

    console.log('📡 Response Status:', response.status);

    const responseText = await response.text();
    console.log('📡 Full Response:');
    console.log(responseText);

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
          console.log('\n📊 Parsed Response:');
          console.log(JSON.stringify(data, null, 2));

          if (
            data.result &&
            data.result.content &&
            data.result.content[0] &&
            data.result.content[0].text
          ) {
            try {
              const innerResponse = JSON.parse(data.result.content[0].text);
              console.log('\n📅 Inner Response:');
              console.log(JSON.stringify(innerResponse, null, 2));

              if (innerResponse.success === true) {
                console.log('✅ SUCCESS! Calendar API is working');
                console.log('📅 Events found:', innerResponse.data.events.length);
                if (innerResponse.data.events.length > 0) {
                  console.log(
                    '📅 Calendar Events:',
                    JSON.stringify(innerResponse.data.events, null, 2),
                  );
                } else {
                  console.log('📅 No events found (this is normal for the date range)');
                }
              } else {
                console.log('❌ API Error:', innerResponse.data?.message || innerResponse.message);
                if (innerResponse.data?.message) {
                  console.log('📋 Error details:', innerResponse.data.message);
                }
              }
            } catch (parseError) {
              console.log('❌ Failed to parse inner response:', parseError.message);
              console.log('📄 Raw inner content:', data.result.content[0].text);
            }
          }
        } catch (parseError) {
          console.log('❌ Failed to parse response:', parseError.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n✅ Test completed!');
}

testGHLAgentCurrent();

