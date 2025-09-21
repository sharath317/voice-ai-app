import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testGHLCalendarDebug() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const calendarId = 'eSQxdGmxInjrZa38Ui6l';

  console.log('🔍 Debugging GHL Calendar endpoint...');
  console.log('API Key:', apiKey ? 'SET' : 'NOT SET');
  console.log('Location ID:', locationId ? 'SET' : 'NOT SET');
  console.log('Calendar ID:', calendarId);

  if (!apiKey || !locationId) {
    console.error('❌ Missing required environment variables');
    return;
  }

  // Test different parameter combinations
  const testCases = [
    {
      name: 'Test 1: Only calendarId',
      params: {
        calendarId: calendarId,
      },
    },
    {
      name: 'Test 2: calendarId with startTime/endTime',
      params: {
        calendarId: calendarId,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-12-31T23:59:59Z',
      },
    },
    {
      name: 'Test 3: calendarId with different date format',
      params: {
        calendarId: calendarId,
        startTime: '2024-01-01',
        endTime: '2024-12-31',
      },
    },
    {
      name: 'Test 4: calendarId with timestamp',
      params: {
        calendarId: calendarId,
        startTime: '1704067200', // Unix timestamp
        endTime: '1735689599',
      },
    },
    {
      name: 'Test 5: Empty parameters',
      params: {},
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 ${testCase.name}`);
    console.log('Parameters:', JSON.stringify(testCase.params, null, 2));

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
            arguments: testCase.params,
          },
          id: Date.now(),
        }),
      });

      console.log('📡 Response Status:', response.status);

      const responseText = await response.text();
      console.log('📡 Response (first 800 chars):', responseText.substring(0, 800));

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
            console.log('✅ Data parsed successfully');

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
                    '❌ API Error:',
                    innerResponse.data?.message || innerResponse.message,
                  );
                  if (innerResponse.data?.message) {
                    console.log('📋 Error details:', innerResponse.data.message);
                  }
                } else {
                  console.log('✅ API Success!');
                  console.log('📅 Calendar Events:', JSON.stringify(innerResponse.data, null, 2));
                }
              } catch (parseError) {
                console.log('📄 Raw content:', data.result.content[0].text);
              }
            }
          } catch (parseError) {
            console.log('❌ Failed to parse data:', parseError.message);
          }
        }
      }
    } catch (error) {
      console.error('❌ Request failed:', error.message);
    }
  }
}

testGHLCalendarDebug();

