import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testGHLCalendarWithBooking() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const calendarId = 'eSQxdGmxInjrZa38Ui6l'; // From the booking URL

  console.log('🔍 Testing GHL Calendar functionality with booking URL...');
  console.log('API Key:', apiKey ? 'SET' : 'NOT SET');
  console.log('Location ID:', locationId ? 'SET' : 'NOT SET');
  console.log('Calendar ID from booking URL:', calendarId);
  console.log('Booking URL: https://api.leadconnectorhq.com/widget/booking/' + calendarId);

  if (!apiKey || !locationId) {
    console.error('❌ Missing required environment variables');
    return;
  }

  try {
    // Test 1: Try to access the booking widget directly
    console.log('\n📅 Test 1: Accessing booking widget directly...');

    const bookingResponse = await fetch(
      `https://api.leadconnectorhq.com/widget/booking/${calendarId}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'GHL-MCP-Test/1.0',
        },
      },
    );

    console.log('📡 Booking Widget Response Status:', bookingResponse.status);
    console.log(
      '📡 Booking Widget Response Headers:',
      Object.fromEntries(bookingResponse.headers.entries()),
    );

    const bookingText = await bookingResponse.text();
    console.log('📡 Booking Widget Response (first 500 chars):', bookingText.substring(0, 500));

    // Test 2: Try to get calendar events using the MCP API with the correct calendar ID
    console.log('\n📅 Test 2: Getting calendar events via MCP API...');

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
          name: 'opportunities_search-opportunity',
          arguments: {
            query_getCalendarEvents: true,
            query_location_id: locationId,
            query_calendar_id: calendarId,
            query_limit: 10,
          },
        },
        id: Date.now(),
      }),
    });

    console.log('📡 Calendar MCP Response Status:', calendarResponse.status);

    const calendarText = await calendarResponse.text();
    console.log('📡 Calendar MCP Response (first 500 chars):', calendarText.substring(0, 500));

    // Test 3: Try to get conversations related to this calendar
    console.log('\n📅 Test 3: Getting calendar-related conversations...');

    const conversationsResponse = await fetch('https://services.leadconnectorhq.com/mcp/', {
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
          name: 'conversations_search-conversation',
          arguments: {
            query_locationId: locationId,
            query_query: `calendar ${calendarId} appointment booking`,
            query_limit: 10,
          },
        },
        id: Date.now(),
      }),
    });

    console.log('📡 Conversations Response Status:', conversationsResponse.status);

    const conversationsText = await conversationsResponse.text();
    console.log(
      '📡 Conversations Response (first 500 chars):',
      conversationsText.substring(0, 500),
    );

    // Parse responses
    console.log('\n📊 Parsing responses...');

    // Parse calendar response
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
          if (data.result && data.result.content) {
            console.log('📅 Found calendar events data');
          }
        } catch (parseError) {
          console.log('❌ Failed to parse calendar response:', parseError.message);
        }
      }
    }

    // Parse conversations response
    if (conversationsText.includes('data:')) {
      const lines = conversationsText.split('\n');
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
          console.log('✅ Conversations data parsed successfully');
          if (data.result && data.result.content) {
            console.log('📅 Found calendar-related conversations');
          }
        } catch (parseError) {
          console.log('❌ Failed to parse conversations response:', parseError.message);
        }
      }
    }

    console.log('\n✅ Calendar functionality test completed!');
    console.log('📝 Summary:');
    console.log(
      '   - Booking Widget URL: https://api.leadconnectorhq.com/widget/booking/' + calendarId,
    );
    console.log('   - Calendar ID: ' + calendarId);
    console.log('   - Location ID: ' + locationId);
    console.log('   - API Key: ' + (apiKey ? 'Valid JWT token' : 'Not set'));
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testGHLCalendarWithBooking();

