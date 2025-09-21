import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testGHLAPIScope() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  const calendarId = 'eSQxdGmxInjrZa38Ui6l';

  console.log('🔍 Testing GHL API endpoints with your credentials...');
  console.log('API Key:', apiKey ? 'SET' : 'NOT SET');
  console.log('Location ID:', locationId ? 'SET' : 'NOT SET');
  console.log('Calendar ID:', calendarId);

  if (!apiKey || !locationId) {
    console.error('❌ Missing required environment variables');
    return;
  }

  // Test different GHL API endpoints to see what your token has access to
  const endpoints = [
    {
      name: 'List Available Tools',
      url: 'https://services.leadconnectorhq.com/mcp/',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: Date.now(),
      },
    },
    {
      name: 'Get Location Info',
      url: 'https://services.leadconnectorhq.com/mcp/',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'locations_get-location',
          arguments: {
            locationId: locationId,
          },
        },
        id: Date.now(),
      },
    },
    {
      name: 'Get Contacts',
      url: 'https://services.leadconnectorhq.com/mcp/',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'contacts_get-contacts',
          arguments: {
            query_locationId: locationId,
            query_limit: 5,
          },
        },
        id: Date.now(),
      },
    },
    {
      name: 'Get Opportunities',
      url: 'https://services.leadconnectorhq.com/mcp/',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'opportunities_get-opportunities',
          arguments: {
            query_locationId: locationId,
            query_limit: 5,
          },
        },
        id: Date.now(),
      },
    },
    {
      name: 'Search Opportunities',
      url: 'https://services.leadconnectorhq.com/mcp/',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'opportunities_search-opportunity',
          arguments: {
            query_location_id: locationId,
            query_limit: 5,
          },
        },
        id: Date.now(),
      },
    },
    {
      name: 'Get Conversations',
      url: 'https://services.leadconnectorhq.com/mcp/',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'conversations_get-conversations',
          arguments: {
            query_locationId: locationId,
            query_limit: 5,
          },
        },
        id: Date.now(),
      },
    },
    {
      name: 'Search Conversations',
      url: 'https://services.leadconnectorhq.com/mcp/',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'conversations_search-conversation',
          arguments: {
            query_locationId: locationId,
            query_query: 'test',
            query_limit: 5,
          },
        },
        id: Date.now(),
      },
    },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n🧪 Testing: ${endpoint.name}`);
    console.log('URL:', endpoint.url);

    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          locationId: locationId,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(endpoint.body),
      });

      console.log('📡 Response Status:', response.status);

      const responseText = await response.text();
      console.log('📡 Response (first 300 chars):', responseText.substring(0, 300));

      // Parse SSE response if it's in that format
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
            console.log('✅ Parsed data successfully');

            // Check if there's an error
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
                } else {
                  console.log('✅ API Success:', innerResponse);
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

  console.log('\n📊 Summary:');
  console.log('This test shows which GHL API endpoints your token has access to.');
  console.log('If you see 401 errors, those endpoints require additional permissions.');
  console.log('If you see 200 responses with data, those endpoints are working.');
}

testGHLAPIScope();

