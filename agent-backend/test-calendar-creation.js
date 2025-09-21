import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testCalendarCreation() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const calendarId = 'eSQxdGmxInjrZa38Ui6l';

  console.log('🔍 Testing Calendar Creation with Direct GHL API...');
  console.log('API Key:', apiKey ? 'SET' : 'NOT SET');
  console.log('Location ID:', locationId ? 'SET' : 'NOT SET');
  console.log('Calendar ID:', calendarId);

  if (!apiKey || !locationId) {
    console.error('❌ Missing required environment variables');
    return;
  }

  // Test calendar event creation
  console.log('\n📅 Testing Calendar Event Creation...');
  try {
    const eventData = {
      calendarId: calendarId,
      title: 'Test Sales Call',
      startTime: new Date('2024-01-02T10:00:00Z').getTime(),
      endTime: new Date('2024-01-02T11:00:00Z').getTime(),
      description: 'Test calendar event created by AI agent',
      location: 'Virtual Meeting',
      attendees: ['test@example.com'],
      allDay: false,
      timezone: 'UTC',
    };

    console.log('📅 Event Data:', JSON.stringify(eventData, null, 2));

    const response = await fetch('https://services.leadconnectorhq.com/calendars/calendar-events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        locationId: locationId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    console.log('📡 Response Status:', response.status);

    const responseText = await response.text();
    console.log('📡 Response:', responseText);

    if (response.ok) {
      try {
        const result = JSON.parse(responseText);
        console.log('✅ Calendar event created successfully!');
        console.log('📅 Event ID:', result.id || result.eventId);
        console.log('📅 Event Details:', JSON.stringify(result, null, 2));
      } catch (parseError) {
        console.log('📄 Raw response (not JSON):', responseText);
      }
    } else {
      console.log('❌ Calendar creation failed');
      console.log('📄 Error response:', responseText);
    }
  } catch (error) {
    console.error('❌ Calendar creation test failed:', error.message);
  }

  console.log('\n✅ Calendar creation test completed!');
}

testCalendarCreation();
