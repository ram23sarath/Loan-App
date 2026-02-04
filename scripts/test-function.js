#!/usr/bin/env node

/**
 * Test the update-user-from-customer function endpoint
 */

const NETLIFY_SITE_URL = process.env.NETLIFY_SITE_URL;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

if (!NETLIFY_SITE_URL || !ADMIN_API_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const functionUrl = `${NETLIFY_SITE_URL}/.netlify/functions/update-user-from-customer`;

async function test() {
  console.log(`Testing: ${functionUrl}\n`);

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-api-key': ADMIN_API_KEY,
      },
      body: JSON.stringify({
        customer_id: 'test-id',
        phone: '1234567890',
      }),
    });

    console.log(`Status: ${response.status}`);
    console.log(`Headers: ${JSON.stringify([...response.headers])}`);
    
    const text = await response.text();
    console.log(`Response: ${text}`);
    
    try {
      const json = JSON.parse(text);
      console.log(`Parsed: ${JSON.stringify(json, null, 2)}`);
    } catch (e) {
      console.log('(Not JSON)');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
