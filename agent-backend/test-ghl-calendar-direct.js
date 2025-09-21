import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testGHLCalendarDirect() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const calendarId = 'eSQxdGmxInjrZa38Ui6l';

  console.log('🔍 Testing GHL Calendar endpoint directly...');
  console.log('API Key:', apiKey ? 'SET' : 'NOT SET');
  console.log('Location ID:', locationId ? 'SET' : 'NOT SET');
  console.log('Calendar ID:', calendarId);

  if (!apiKey || !locationId) {
    console.error('❌ Missing required environment variables');
    return;
  }

  try {
    // Test the actual calendar endpoint that was found in the tools list
    console.log('\n📅 Testing: calendars_get-calendar-events');

    const calendarResponse = await fetch('https://services.leadconnectorhq.com/mcp/', {
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
            calendarId: calendarId,
            startTime: '2024-01-01T00:00:00Z',
            endTime: '2024-12-31T23:59:59Z',
          },
        },
        id: Date.now(),
      }),
    });

    console.log('📡 Calendar Response Status:', calendarResponse.status);

    const calendarText = await calendarResponse.text();
    console.log('📡 Calendar Response (first 500 chars):', calendarText.substring(0, 500));

    // Parse the response
    if (calendarText.includes('data:')) {
      const lines = calendarText.split('\n');
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
          console.log('✅ Calendar data parsed successfully');

          if (
            data.result &&
            data.result.content &&
            data.result.content[0] &&
            data.result.content[0].text
          ) {
            try {
              const innerResponse = JSON.parse(data.result.content[0].text);
              if (innerResponse.success === false) {
                console.log(
                  '❌ Calendar API Error:',
                  innerResponse.data?.message || innerResponse.message,
                );
              } else {
                console.log('✅ Calendar API Success!');
                console.log('📅 Calendar Events:', JSON.stringify(innerResponse.data, null, 2));
              }
            } catch (parseError) {
              console.log('📄 Raw calendar content:', data.result.content[0].text);
            }
          }
        } catch (parseError) {
          console.log('❌ Failed to parse calendar data:', parseError.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Calendar test failed:', error.message);
  }
}

testGHLCalendarDirect();

