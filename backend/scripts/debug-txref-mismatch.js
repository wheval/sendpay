#!/usr/bin/env node

/**
 * Debug TxRef Mismatch
 * This script helps identify why the indexer can't find transactions
 */

const mongoose = require('mongoose');

// Environment setup
require('dotenv').config({ path: '.env' });

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sendpay';

// Transaction schema
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

async function debugTxRefMismatch() {
  try {
    console.log('🔍 Debugging TxRef Mismatch');
    console.log('============================\n');

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // The problematic txRef from the logs
    const onchainTxRef = '0x06ef5d0e6f0e25a4d96dcca70ec4cc0e4652febd009b29bac3dabdbeadef51af';
    const onchainTxRefNoPrefix = onchainTxRef.substring(2); // Remove 0x prefix

    console.log('📋 On-chain TxRef from logs:');
    console.log('   Full:', onchainTxRef);
    console.log('   No prefix:', onchainTxRefNoPrefix);

    // Find recent transactions
    const recentTransactions = await Transaction.find({
      flow: 'offramp',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).sort({ createdAt: -1 });

    console.log(`\n📊 Recent Offramp Transactions (${recentTransactions.length}):`);

    if (recentTransactions.length === 0) {
      console.log('❌ No recent offramp transactions found');
      return;
    }

    recentTransactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${tx._id}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Reference: ${tx.reference}`);
      console.log(`   Created: ${tx.createdAt}`);
      console.log(`   Metadata txRef: ${tx.metadata?.txRef || 'N/A'}`);
      console.log(`   Metadata withdrawalId: ${tx.metadata?.withdrawalId || 'N/A'}`);
      
      // Check for matches
      const metadataTxRef = tx.metadata?.txRef;
      if (metadataTxRef) {
        if (metadataTxRef === onchainTxRef) {
          console.log('   ✅ EXACT MATCH with on-chain txRef');
        } else if (metadataTxRef === onchainTxRefNoPrefix) {
          console.log('   ✅ MATCH with on-chain txRef (no prefix)');
        } else if (metadataTxRef.toLowerCase() === onchainTxRef.toLowerCase()) {
          console.log('   ✅ MATCH with on-chain txRef (case insensitive)');
        } else {
          console.log('   ❌ No match');
        }
      }
    });

    // Try to find the transaction with different search patterns
    console.log('\n🔍 Searching for transaction with different patterns:');

    // Search 1: Exact match
    const exactMatch = await Transaction.findOne({
      'metadata.txRef': onchainTxRef
    });
    console.log('   Exact match:', exactMatch ? 'FOUND' : 'NOT FOUND');

    // Search 2: Without prefix
    const noPrefixMatch = await Transaction.findOne({
      'metadata.txRef': onchainTxRefNoPrefix
    });
    console.log('   No prefix match:', noPrefixMatch ? 'FOUND' : 'NOT FOUND');

    // Search 3: Case insensitive
    const caseInsensitiveMatch = await Transaction.findOne({
      'metadata.txRef': { $regex: new RegExp(onchainTxRef.substring(2), 'i') }
    });
    console.log('   Case insensitive match:', caseInsensitiveMatch ? 'FOUND' : 'NOT FOUND');

    // Search 4: Partial match
    const partialMatch = await Transaction.findOne({
      'metadata.txRef': { $regex: onchainTxRefNoPrefix.substring(0, 16) }
    });
    console.log('   Partial match:', partialMatch ? 'FOUND' : 'NOT FOUND');

    // Search 5: By withdrawal ID
    const withdrawalIdMatch = await Transaction.findOne({
      'metadata.withdrawalId': '3'
    });
    console.log('   Withdrawal ID match:', withdrawalIdMatch ? 'FOUND' : 'NOT FOUND');

    if (withdrawalIdMatch) {
      console.log('\n✅ Found transaction by withdrawal ID:');
      console.log('   Transaction ID:', withdrawalIdMatch._id);
      console.log('   Status:', withdrawalIdMatch.status);
      console.log('   Metadata txRef:', withdrawalIdMatch.metadata?.txRef);
      console.log('   Expected txRef:', onchainTxRef);
    }

    console.log('\n💡 Recommendations:');
    if (!exactMatch && !noPrefixMatch && !caseInsensitiveMatch && !withdrawalIdMatch) {
      console.log('❌ Transaction not found in database');
      console.log('   → The transaction might not have been created by the backend');
      console.log('   → Check if the frontend withdrawal request reached the backend');
      console.log('   → Verify the signature generation process');
    } else {
      console.log('✅ Transaction found with alternative search');
      console.log('   → Update the indexer to handle the txRef format difference');
    }

  } catch (error) {
    console.error('❌ Debug script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
debugTxRefMismatch().catch(console.error);
