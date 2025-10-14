#!/usr/bin/env node

/**
 * Get IP Addresses for Flutterwave Whitelisting
 */

const axios = require('axios');

async function getIPAddresses() {
  try {
    console.log('🌐 Getting IP addresses for Flutterwave whitelisting...\n');

    // Get current IP
    const ipResponse = await axios.get('https://api.ipify.org');
    const currentIP = ipResponse.data;
    
    console.log('📍 Current IP Address:');
    console.log(`   ${currentIP}`);
    console.log('\n🔧 Flutterwave Dashboard Steps:');
    console.log('1. Go to: https://dashboard.flutterwave.com');
    console.log('2. Navigate to: Settings → API Keys');
    console.log('3. Find: "IP Whitelisting" section');
    console.log('4. Add IP: ' + currentIP);
    console.log('5. Save changes');
    
    // Try to get more IP info
    try {
      const ipInfoResponse = await axios.get(`http://ip-api.com/json/${currentIP}`);
      const ipInfo = ipInfoResponse.data;
      
      console.log('\n📍 IP Information:');
      console.log(`   Country: ${ipInfo.country}`);
      console.log(`   Region: ${ipInfo.regionName}`);
      console.log(`   City: ${ipInfo.city}`);
      console.log(`   ISP: ${ipInfo.isp}`);
      console.log(`   Organization: ${ipInfo.org}`);
    } catch (ipInfoError) {
      console.log('\n⚠️ Could not get detailed IP information');
    }

    console.log('\n🚀 Production Server (Render):');
    console.log('   Check your Render dashboard for the server IP');
    console.log('   Or add this IP after deploying to production');
    
    console.log('\n✅ After whitelisting, you can run:');
    console.log('   node scripts/complete-stuck-withdrawals.js');

  } catch (error) {
    console.error('❌ Failed to get IP address:', error.message);
  }
}

getIPAddresses();
