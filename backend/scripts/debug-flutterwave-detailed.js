#!/usr/bin/env node

/**
 * Debug Flutterwave API Issues
 * This script provides detailed debugging information for Flutterwave API calls
 */

const axios = require('axios');

// Environment setup
require('dotenv').config({ path: '.env' });

// Flutterwave service configuration
const FLUTTERWAVE_CONFIG = {
  clientId: process.env.FLUTTERWAVE_CLIENT_ID,
  clientSecret: process.env.FLUTTERWAVE_CLIENT_SECRET,
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://f4bexperience.flutterwave.com' 
    : 'https://developersandbox-api.flutterwave.com'
};

async function getFlutterwaveAccessToken() {
  try {
    console.log('🔑 Getting Flutterwave access token...');
    console.log('   Client ID:', FLUTTERWAVE_CONFIG.clientId ? 'Set' : 'NOT SET');
    console.log('   Client Secret:', FLUTTERWAVE_CONFIG.clientSecret ? 'Set' : 'NOT SET');
    console.log('   Base URL:', FLUTTERWAVE_CONFIG.baseUrl);
    
    const response = await axios.post(
      'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: FLUTTERWAVE_CONFIG.clientId,
        client_secret: FLUTTERWAVE_CONFIG.clientSecret,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    console.log('✅ Access token received successfully');
    console.log('   Token type:', response.data.token_type);
    console.log('   Expires in:', response.data.expires_in, 'seconds');
    
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Failed to get Flutterwave access token:');
    console.error('   Status:', error.response?.status);
    console.error('   Status Text:', error.response?.statusText);
    console.error('   Response Data:', JSON.stringify(error.response?.data, null, 2));
    throw error;
  }
}

async function testFlutterwaveTransfer() {
  try {
    const accessToken = await getFlutterwaveAccessToken();
    
    const payload = {
      action: 'instant',
      type: 'bank',
      callback_url: process.env.FLUTTERWAVE_CALLBACK_URL,
      narration: 'SendPay test withdrawal',
      reference: `test${Date.now()}`,
      payment_instruction: {
        amount: {
          value: 100, // ₦100 (minimum amount)
          applies_to: 'destination_currency',
        },
        source_currency: 'NGN',
        destination_currency: 'NGN',
        recipient: {
          bank: {
            code: '044', // Access Bank (test bank)
            account_number: '0690000031', // Test account number
          },
        },
      },
    };

    console.log('\n📤 Testing Flutterwave transfer...');
    console.log('   Payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${FLUTTERWAVE_CONFIG.baseUrl}/direct-transfers`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': `sendpay-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
          'X-Idempotency-Key': `sendpay-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        },
      }
    );
    
    console.log('✅ Transfer test successful!');
    console.log('   Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Transfer test failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Status Text:', error.response?.statusText);
    console.error('   Response Data:', JSON.stringify(error.response?.data, null, 2));
    
    if (error.response?.data?.message) {
      console.error('\n🔍 Error Analysis:');
      const message = error.response.data.message.toLowerCase();
      
      if (message.includes('ip') || message.includes('whitelist')) {
        console.error('   → This looks like an IP whitelisting issue');
        console.error('   → Make sure you added all Render IPs to Flutterwave dashboard');
      } else if (message.includes('credential') || message.includes('auth')) {
        console.error('   → This looks like an authentication issue');
        console.error('   → Check your FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET');
      } else if (message.includes('amount') || message.includes('minimum')) {
        console.error('   → This looks like an amount validation issue');
      } else if (message.includes('bank') || message.includes('account')) {
        console.error('   → This looks like a bank account validation issue');
      }
    }
  }
}

async function testBankList() {
  try {
    const accessToken = await getFlutterwaveAccessToken();
    
    console.log('\n🏦 Testing bank list retrieval...');
    
    const response = await axios.get(
      `${FLUTTERWAVE_CONFIG.baseUrl}/banks/NG`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('✅ Bank list retrieved successfully');
    console.log('   Banks found:', response.data.data?.length || 0);
    
    // Show first few banks
    if (response.data.data && response.data.data.length > 0) {
      console.log('   Sample banks:');
      response.data.data.slice(0, 3).forEach(bank => {
        console.log(`     ${bank.name} (${bank.code})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Bank list test failed:');
    console.error('   Status:', error.response?.status);
    console.error('   Response Data:', JSON.stringify(error.response?.data, null, 2));
  }
}

async function main() {
  console.log('🔍 Flutterwave API Debug Script');
  console.log('================================\n');
  
  // Check environment variables
  console.log('📋 Environment Check:');
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('   FLUTTERWAVE_CLIENT_ID:', FLUTTERWAVE_CONFIG.clientId ? 'Set' : 'NOT SET');
  console.log('   FLUTTERWAVE_CLIENT_SECRET:', FLUTTERWAVE_CONFIG.clientSecret ? 'Set' : 'NOT SET');
  console.log('   FLUTTERWAVE_CALLBACK_URL:', process.env.FLUTTERWAVE_CALLBACK_URL || 'NOT SET');
  console.log('   Base URL:', FLUTTERWAVE_CONFIG.baseUrl);
  
  if (!FLUTTERWAVE_CONFIG.clientId || !FLUTTERWAVE_CONFIG.clientSecret) {
    console.error('\n❌ Missing required environment variables!');
    console.error('   Please set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET');
    return;
  }
  
  try {
    // Test access token
    await getFlutterwaveAccessToken();
    
    // Test bank list
    await testBankList();
    
    // Test transfer
    await testFlutterwaveTransfer();
    
  } catch (error) {
    console.error('\n❌ Debug script failed:', error.message);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
