#!/usr/bin/env node

/**
 * Test Flutterwave Credentials
 * This script tests if your Flutterwave credentials are working correctly
 */

const axios = require('axios');

// Environment setup
require('dotenv').config({ path: '.env' });

async function testCredentials() {
  console.log('🔍 Testing Flutterwave Credentials');
  console.log('==================================\n');

  const clientId = process.env.FLUTTERWAVE_CLIENT_ID;
  const clientSecret = process.env.FLUTTERWAVE_CLIENT_SECRET;

  console.log('📋 Environment Variables:');
  console.log('   FLUTTERWAVE_CLIENT_ID:', clientId ? `${clientId.substring(0, 8)}...` : 'NOT SET');
  console.log('   FLUTTERWAVE_CLIENT_SECRET:', clientSecret ? `${clientSecret.substring(0, 8)}...` : 'NOT SET');

  if (!clientId || !clientSecret) {
    console.error('\n❌ Missing required environment variables!');
    console.error('   Please set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET');
    return;
  }

  try {
    console.log('\n🔑 Testing OAuth Token Generation...');
    
    const response = await axios.post(
      'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000
      }
    );

    console.log('✅ OAuth Token Generated Successfully!');
    console.log('   Token Type:', response.data.token_type);
    console.log('   Expires In:', response.data.expires_in, 'seconds');
    console.log('   Access Token:', response.data.access_token ? 'Present' : 'Missing');

    // Test with sandbox first
    console.log('\n🧪 Testing Sandbox API Access...');
    const sandboxResponse = await axios.get(
      'https://developersandbox-api.flutterwave.com/v3/transactions',
      {
        headers: {
          'Authorization': `Bearer ${response.data.access_token}`,
          'Content-Type': 'application/json',
        },
        params: {
          page: 1,
          per_page: 1
        },
        timeout: 10000
      }
    );

    console.log('✅ Sandbox API Access Successful!');
    console.log('   Status:', sandboxResponse.status);

    // Test with production
    console.log('\n🏭 Testing Production API Access...');
    const productionResponse = await axios.get(
      'https://f4bexperience.flutterwave.com/v3/transactions',
      {
        headers: {
          'Authorization': `Bearer ${response.data.access_token}`,
          'Content-Type': 'application/json',
        },
        params: {
          page: 1,
          per_page: 1
        },
        timeout: 10000
      }
    );

    console.log('✅ Production API Access Successful!');
    console.log('   Status:', productionResponse.status);

    console.log('\n🎉 SUCCESS! Your Flutterwave credentials are working correctly.');
    console.log('   Both sandbox and production APIs are accessible.');

  } catch (error) {
    console.error('\n❌ Credential Test Failed:');
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Status Text:', error.response.statusText);
      console.error('   Response Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.error('\n🔍 Analysis: Invalid credentials');
        console.error('   → Check your FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET');
        console.error('   → Make sure they are from the correct Flutterwave account');
      } else if (error.response.status === 403) {
        console.error('\n🔍 Analysis: Access forbidden');
        console.error('   → Your credentials might be for a different environment');
        console.error('   → Check if you need to enable API access in your dashboard');
      } else if (error.response.status === 404) {
        console.error('\n🔍 Analysis: Endpoint not found');
        console.error('   → This might be a temporary API issue');
      }
    } else {
      console.error('   Network Error:', error.message);
      console.error('\n🔍 Analysis: Network connectivity issue');
      console.error('   → Check your internet connection');
      console.error('   → Try again in a few minutes');
    }
  }
}

// Run the test
testCredentials().catch(console.error);
