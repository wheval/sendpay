#!/usr/bin/env node

/**
 * Complete Stuck Withdrawals Script
 * 
 * This script helps complete withdrawals that were stuck due to:
 * - IP whitelisting issues
 * - Flutterwave API errors
 * - Indexer processing failures
 */

const mongoose = require('mongoose');
const axios = require('axios');

// Environment setup
require('dotenv').config({ path: '.env' });

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sendpay';

// Transaction schema (simplified for script)
const transactionSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId,
  flow: String,
  status: String,
  amountUSD: Number,
  amountNGN: Number,
  description: String,
  reference: String,
  starknetTxHash: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: Date,
  updatedAt: Date
}, { collection: 'transactions' });

const Transaction = mongoose.model('Transaction', transactionSchema);

// Flutterwave service configuration
const FLUTTERWAVE_CONFIG = {
  clientId: process.env.FLUTTERWAVE_CLIENT_ID,
  clientSecret: process.env.FLUTTERWAVE_CLIENT_SECRET,
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://f4bexperience.flutterwave.com' 
    : 'https://developersandbox-api.flutterwave.com'
};

// Bank account schema
const bankAccountSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  userId: mongoose.Schema.Types.ObjectId,
  bankName: String,
  bankCode: String,
  accountNumber: String,
  accountName: String,
  isDefault: Boolean
}, { collection: 'bankaccounts' });

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);

async function getFlutterwaveAccessToken() {
  try {
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
    
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Failed to get Flutterwave access token:', error.response?.data || error.message);
    throw error;
  }
}

async function createFlutterwaveTransfer(params) {
  const accessToken = await getFlutterwaveAccessToken();
  
  const payload = {
    action: 'instant',
    type: 'bank',
    callback_url: process.env.FLUTTERWAVE_CALLBACK_URL,
    narration: params.narration,
    reference: params.reference,
    payment_instruction: {
      amount: {
        value: params.amountNGN,
        applies_to: 'destination_currency',
      },
      source_currency: 'NGN',
      destination_currency: 'NGN',
      recipient: {
        bank: {
          code: params.bankCode,
          account_number: params.accountNumber,
        },
      },
    },
  };

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
  
  return response.data;
}

async function main() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find stuck withdrawals
    const stuckWithdrawals = await Transaction.find({
      flow: 'offramp',
      status: { $in: ['submitted_onchain', 'payout_pending', 'payout_failed'] },
      'metadata.withdrawalId': { $exists: true }
    }).sort({ createdAt: -1 });

    console.log(`\n📋 Found ${stuckWithdrawals.length} stuck withdrawals:`);

    if (stuckWithdrawals.length === 0) {
      console.log('✅ No stuck withdrawals found!');
      return;
    }

    // Display stuck withdrawals
    stuckWithdrawals.forEach((tx, index) => {
      console.log(`\n${index + 1}. Withdrawal ID: ${tx.metadata?.withdrawalId}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Amount: $${tx.amountUSD} (₦${tx.amountNGN})`);
      console.log(`   Reference: ${tx.reference}`);
      console.log(`   Created: ${tx.createdAt}`);
      console.log(`   Bank Account ID: ${tx.metadata?.bankAccountId}`);
    });

    console.log('\n🔧 Options:');
    console.log('1. Retry failed payouts (payout_failed)');
    console.log('2. Complete pending payouts (payout_pending)');
    console.log('3. Show detailed info for specific withdrawal');
    console.log('4. Exit');

    // For now, let's retry failed payouts
    const failedPayouts = stuckWithdrawals.filter(tx => tx.status === 'payout_failed');
    
    if (failedPayouts.length > 0) {
      console.log(`\n🔄 Retrying ${failedPayouts.length} failed payouts...`);
      
      for (const tx of failedPayouts) {
        try {
          console.log(`\n📤 Processing withdrawal ${tx.metadata?.withdrawalId}...`);
          
          // Get bank account details
          const bankAccount = await BankAccount.findById(tx.metadata?.bankAccountId);
          if (!bankAccount) {
            console.log(`❌ Bank account not found for withdrawal ${tx.metadata?.withdrawalId}`);
            continue;
          }

          // Calculate NGN amount
          const usdAmount = tx.amountUSD;
          const lockedRate = tx.metadata?.lockedExchangeRate;
          const ngnAmount = lockedRate ? Math.round(usdAmount * lockedRate) : Math.round(usdAmount * 1500); // fallback rate

          // Generate new reference
          const newRef = `sendpay${tx.metadata?.withdrawalId}${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '');

          console.log(`   Bank: ${bankAccount.bankName} (${bankAccount.bankCode})`);
          console.log(`   Account: ${bankAccount.accountNumber}`);
          console.log(`   Amount: ₦${ngnAmount}`);
          console.log(`   Reference: ${newRef}`);

          // Create Flutterwave transfer
          const transfer = await createFlutterwaveTransfer({
            bankCode: bankAccount.bankCode,
            accountNumber: bankAccount.accountNumber,
            amountNGN: ngnAmount,
            reference: newRef,
            narration: `SendPay withdrawal ${tx.metadata?.withdrawalId}`
          });

          // Update transaction
          await Transaction.findByIdAndUpdate(tx._id, {
            $set: {
              status: 'payout_pending',
              'metadata.flutterwave_reference': transfer?.data?.reference || newRef,
              'metadata.flutterwave_transfer_id': transfer?.data?.id || null,
              'metadata.ngnAmount': ngnAmount,
              'metadata.usdAmount': usdAmount,
              'metadata.payoutInitiatedAt': new Date(),
              'metadata.retryAttempt': (tx.metadata?.retryAttempt || 0) + 1
            }
          });

          console.log(`✅ Transfer initiated: ${transfer?.data?.id}`);
          console.log(`   Status: ${transfer?.data?.status}`);
          
        } catch (error) {
          console.log(`❌ Failed to process withdrawal ${tx.metadata?.withdrawalId}:`);
          console.log(`   Error: ${error.response?.data?.message || error.message}`);
          
          // Update transaction with error
          await Transaction.findByIdAndUpdate(tx._id, {
            $set: {
              'metadata.lastError': error.response?.data?.message || error.message,
              'metadata.lastErrorAt': new Date(),
              'metadata.retryAttempt': (tx.metadata?.retryAttempt || 0) + 1
            }
          });
        }
      }
    }

    console.log('\n✅ Script completed!');

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
