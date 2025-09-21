import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testGHLCalendarFixed() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const calendarId = 'eSQxdGmxInjrZa38Ui6l';

  console.log('🔍 Testing GHL Calendar with correct parameters...');
  console.log('API Key:', apiKey ? 'SET' : 'NOT SET');
  console.log('Location ID:', locationId ? 'SET' : 'NOT SET');
  console.log('Calendar ID:', calendarId);

  if (!apiKey || !locationId) {
    console.error('❌ Missing required environment variables');
    return;
  }

  // Convert dates to milliseconds
  const startTime = new Date('2024-01-01T00:00:00Z').getTime();
  const endTime = new Date('2024-12-31T23:59:59Z').getTime();

  console.log('📅 Date range:');
  console.log('  Start Time (ms):', startTime);
  console.log('  End Time (ms):', endTime);
  console.log('  Start Date:', new Date(startTime).toISOString());
  console.log('  End Date:', new Date(endTime).toISOString());

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
    console.log('📡 Response (first 1000 chars):', responseText.substring(0, 1000));

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
                if (innerResponse.data?.message) {
                  console.log('📋 Error details:', innerResponse.data.message);
                }
              } else {
                console.log('✅ Calendar API Success!');
                console.log('📅 Calendar Events:', JSON.stringify(innerResponse.data, null, 2));
              }
            } catch (parseError) {
              console.log('📄 Raw content:', data.result.content[0].text);
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

testGHLCalendarFixed();
