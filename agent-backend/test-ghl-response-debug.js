import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testGHLResponseDebug() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const calendarId = 'eSQxdGmxInjrZa38Ui6l';

  console.log('🔍 Debugging GHL API responses...');

  // Test calendar events
  console.log('\n📅 Testing Calendar Events...');
  try {
    const startTime = new Date('2024-01-01T00:00:00Z').getTime();
    const endTime = new Date('2024-12-31T23:59:59Z').getTime();

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

    const responseText = await response.text();
    console.log('📡 Full Calendar Response:');
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
          console.log('\n📊 Parsed Calendar Data:');
          console.log(JSON.stringify(data, null, 2));

          if (
            data.result &&
            data.result.content &&
            data.result.content[0] &&
            data.result.content[0].text
          ) {
            try {
              const innerResponse = JSON.parse(data.result.content[0].text);
              console.log('\n📅 Inner Calendar Response:');
              console.log(JSON.stringify(innerResponse, null, 2));
            } catch (parseError) {
              console.log('\n📄 Raw Calendar Content:');
              console.log(data.result.content[0].text);
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

  // Test appointment notes
  console.log('\n📝 Testing Appointment Notes...');
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
          name: 'calendars_get-appointment-notes',
          arguments: {
            path_appointmentId: 'test-appointment-id',
            query_limit: 10,
            query_offset: 0,
          },
        },
        id: Date.now(),
      }),
    });

    const responseText = await response.text();
    console.log('📡 Full Appointment Notes Response:');
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
          console.log('\n📊 Parsed Appointment Notes Data:');
          console.log(JSON.stringify(data, null, 2));

          if (
            data.result &&
            data.result.content &&
            data.result.content[0] &&
            data.result.content[0].text
          ) {
            try {
              const innerResponse = JSON.parse(data.result.content[0].text);
              console.log('\n📝 Inner Appointment Notes Response:');
              console.log(JSON.stringify(innerResponse, null, 2));
            } catch (parseError) {
              console.log('\n📄 Raw Appointment Notes Content:');
              console.log(data.result.content[0].text);
            }
          }
        } catch (parseError) {
          console.log('❌ Failed to parse appointment notes data:', parseError.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Appointment notes test failed:', error.message);
  }
}

testGHLResponseDebug();

