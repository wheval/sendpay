#!/usr/bin/env node

/**
 * Check Stuck Withdrawals Script
 * 
 * This script shows you what withdrawals are stuck and need to be completed
 */

const mongoose = require('mongoose');

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

async function main() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all withdrawal transactions
    const withdrawals = await Transaction.find({
      flow: 'offramp'
    }).sort({ createdAt: -1 });

    console.log(`\n📋 Total Withdrawals: ${withdrawals.length}`);

    if (withdrawals.length === 0) {
      console.log('✅ No withdrawals found!');
      return;
    }

    // Group by status
    const statusGroups = {};
    withdrawals.forEach(tx => {
      if (!statusGroups[tx.status]) {
        statusGroups[tx.status] = [];
      }
      statusGroups[tx.status].push(tx);
    });

    console.log('\n📊 Withdrawal Status Breakdown:');
    Object.keys(statusGroups).forEach(status => {
      console.log(`   ${status}: ${statusGroups[status].length} withdrawals`);
    });

    // Show stuck withdrawals
    const stuckStatuses = ['submitted_onchain', 'payout_pending', 'payout_failed'];
    const stuckWithdrawals = withdrawals.filter(tx => stuckStatuses.includes(tx.status));

    console.log(`\n🚨 Stuck Withdrawals (${stuckWithdrawals.length}):`);

    if (stuckWithdrawals.length === 0) {
      console.log('✅ No stuck withdrawals! All withdrawals are completed or in progress.');
    } else {
      stuckWithdrawals.forEach((tx, index) => {
        console.log(`\n${index + 1}. Withdrawal ID: ${tx.metadata?.withdrawalId || 'N/A'}`);
        console.log(`   Status: ${tx.status}`);
        console.log(`   Amount: $${tx.amountUSD} (₦${tx.amountNGN})`);
        console.log(`   Reference: ${tx.reference}`);
        console.log(`   Created: ${tx.createdAt?.toISOString()}`);
        console.log(`   Updated: ${tx.updatedAt?.toISOString()}`);
        console.log(`   Bank Account ID: ${tx.metadata?.bankAccountId || 'N/A'}`);
        console.log(`   Flutterwave Ref: ${tx.metadata?.flutterwave_reference || 'N/A'}`);
        console.log(`   Flutterwave ID: ${tx.metadata?.flutterwave_transfer_id || 'N/A'}`);
        
        if (tx.metadata?.error) {
          console.log(`   ❌ Error: ${tx.metadata.error}`);
        }
        if (tx.metadata?.flutterwaveError) {
          console.log(`   ❌ Flutterwave Error: ${JSON.stringify(tx.metadata.flutterwaveError)}`);
        }
        if (tx.metadata?.retryAttempt) {
          console.log(`   🔄 Retry Attempts: ${tx.metadata.retryAttempt}`);
        }
      });

      console.log('\n🔧 Next Steps:');
      console.log('1. Whitelist your IP in Flutterwave dashboard');
      console.log('2. Run: node scripts/complete-stuck-withdrawals.js');
      console.log('3. Check logs for any remaining issues');
    }

    // Show recent completed withdrawals
    const completedWithdrawals = withdrawals.filter(tx => 
      ['payout_completed', 'onchain_completed'].includes(tx.status)
    );

    console.log(`\n✅ Recent Completed Withdrawals (${completedWithdrawals.length}):`);
    completedWithdrawals.slice(0, 5).forEach((tx, index) => {
      console.log(`   ${index + 1}. ${tx.metadata?.withdrawalId} - $${tx.amountUSD} - ${tx.status} - ${tx.createdAt?.toISOString()}`);
    });

    if (completedWithdrawals.length > 5) {
      console.log(`   ... and ${completedWithdrawals.length - 5} more`);
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
