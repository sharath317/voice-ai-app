import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testGHLAPIVariations() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  console.log('🔍 Testing GHL MCP API with different parameter variations...');

  const testCases = [
    {
      name: 'Test 1: With empty strings',
      arguments: {
        userId: '',
        groupId: '',
        calendarId: 'eSQxdGmxInjrZa38Ui6l',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-31T23:59:59Z',
      },
    },
    {
      name: 'Test 2: Without userId and groupId',
      arguments: {
        calendarId: 'eSQxdGmxInjrZa38Ui6l',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-31T23:59:59Z',
      },
    },
    {
      name: 'Test 3: With null values',
      arguments: {
        userId: null,
        groupId: null,
        calendarId: 'eSQxdGmxInjrZa38Ui6l',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-31T23:59:59Z',
      },
    },
    {
      name: 'Test 4: With undefined values',
      arguments: {
        userId: undefined,
        groupId: undefined,
        calendarId: 'eSQxdGmxInjrZa38Ui6l',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-31T23:59:59Z',
      },
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 ${testCase.name}`);
    console.log('Arguments:', JSON.stringify(testCase.arguments, null, 2));

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
            arguments: testCase.arguments,
          },
          id: Date.now(),
        }),
      });

      console.log('📡 Response Status:', response.status);

      const responseText = await response.text();

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
            console.log('📡 Parsed Response:', JSON.stringify(data, null, 2));

            // Check if there's an error in the nested response
            if (
              data.result &&
              data.result.content &&
              data.result.content[0] &&
              data.result.content[0].text
            ) {
              try {
                const innerResponse = JSON.parse(data.result.content[0].text);
                if (innerResponse.success === false) {
                  console.log('❌ Error Details:', innerResponse.data);
                } else {
                  console.log('✅ Success!');
                }
              } catch (innerParseError) {
                console.log('📡 Inner response not JSON');
              }
            }
          } catch (parseError) {
            console.log('📡 Failed to parse SSE data');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
}

testGHLAPIVariations();

