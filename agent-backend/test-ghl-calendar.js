#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config();

async function testGHLCalendar() {
  console.log('🧪 Testing GHL Calendar Integration');
  console.log('=====================================\n');

  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    console.error('❌ Missing GHL_API_KEY or GHL_LOCATION_ID in .env file');
    process.exit(1);
  }

  console.log('✅ Environment variables loaded');
  console.log(`   GHL_API_KEY: ${apiKey.substring(0, 20)}...`);
  console.log(`   GHL_LOCATION_ID: ${locationId}\n`);

  try {
    console.log('📅 Testing calendar events with calendar ID: eSQxdGmxInjrZa38Ui6l');
    
    const response = await fetch('https://services.leadconnectorhq.com/mcp/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'locationId': locationId,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "calendars_get-calendar-events",
          arguments: {
            calendarId: "eSQxdGmxInjrZa38Ui6l"
          }
        },
        id: Date.now(),
      }),
    });

    console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log('📄 Raw Response (first 500 chars):');
    console.log(responseText.substring(0, 500) + '...\n');

    if (response.ok) {
      console.log('✅ GHL MCP API call successful!');
      
      // Try to parse SSE format
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
            console.log('📊 Parsed Data:');
            console.log(JSON.stringify(data, null, 2));
          } catch (parseError) {
            console.error('❌ Failed to parse data line:', parseError);
            console.log('Raw data line:', dataLine);
          }
        }
      }
    } else {
      console.error('❌ GHL MCP API call failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testGHLCalendar();
