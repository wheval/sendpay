const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sendpay');

// Define schemas
const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  flow: { type: String, enum: ['onramp', 'offramp'] },
  status: { type: String },
  amountUSD: { type: Number },
  amountNGN: { type: Number },
  description: { type: String },
  reference: { type: String },
  starknetTxHash: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const bankAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bankCode: { type: String },
  accountNumber: { type: String },
  accountName: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);
const BankAccount = mongoose.model('BankAccount', bankAccountSchema);

// Mock Flutterwave service for testing
const mockFlutterwaveService = {
  createDirectTransfer: async (params) => {
    console.log('🔄 Mock Flutterwave transfer:', params);
    return {
      data: {
        id: 'mock_transfer_' + Date.now(),
        reference: params.reference,
        status: 'PENDING'
      }
    };
  }
};

async function fixStuckTransaction() {
  try {
    console.log('🔧 Fixing stuck withdrawal transaction...\n');
    
    // Find the latest stuck transaction
    const stuckTx = await Transaction.findOne({ 
      flow: 'offramp',
      status: 'submitted_onchain',
      'metadata.txRef': { $exists: true }
    }).sort({ createdAt: -1 });
    
    if (!stuckTx) {
      console.log('❌ No stuck transactions found');
      return;
    }
    
    console.log('📋 Found stuck transaction:');
    console.log(`ID: ${stuckTx._id}`);
    console.log(`Status: ${stuckTx.status}`);
    console.log(`Amount USD: $${stuckTx.amountUSD}`);
    console.log(`txRef: ${stuckTx.metadata?.txRef}`);
    console.log(`Bank Account ID: ${stuckTx.metadata?.bankAccountId}`);
    
    // Get bank account details
    const bankAccountId = stuckTx.metadata?.bankAccountId;
    if (!bankAccountId) {
      console.log('❌ No bank account ID found in metadata');
      return;
    }
    
    const bank = await BankAccount.findById(bankAccountId);
    if (!bank) {
      console.log('❌ Bank account not found');
      return;
    }
    
    console.log('🏦 Bank account details:');
    console.log(`Bank Code: ${bank.bankCode}`);
    console.log(`Account Number: ${bank.accountNumber}`);
    console.log(`Account Name: ${bank.accountName}`);
    
    // Calculate NGN amount using locked rate
    const usdAmount = stuckTx.amountUSD;
    const lockedRate = stuckTx.metadata?.lockedExchangeRate;
    const ngnAmount = typeof lockedRate === 'number' && lockedRate > 0
      ? Math.round(usdAmount * lockedRate)
      : Math.round(usdAmount * 1500); // fallback rate
    
    console.log(`💰 Amount calculation:`);
    console.log(`USD: $${usdAmount}`);
    console.log(`Locked Rate: ${lockedRate || 'Not set'}`);
    console.log(`NGN: ₦${ngnAmount}`);
    
    // Check minimum amount
    if (ngnAmount < 100) {
      console.log('❌ Amount below Flutterwave minimum (₦100)');
      await Transaction.findByIdAndUpdate(stuckTx._id, {
        $set: {
          status: "payout_failed",
          metadata: {
            ...stuckTx.metadata,
            error: "Amount below Flutterwave minimum (₦100)",
            ngnAmount,
            usdAmount,
          },
        },
      });
      return;
    }
    
    // Generate withdrawal ID (simulate what the contract would have done)
    const withdrawalId = Math.floor(Math.random() * 1000000);
    const reference = `sendpay_${withdrawalId}`;
    
    console.log(`🆔 Generated withdrawal ID: ${withdrawalId}`);
    console.log(`📝 Reference: ${reference}`);
    
    // Create Flutterwave transfer
    console.log('\n🚀 Initiating Flutterwave transfer...');
    const transfer = await mockFlutterwaveService.createDirectTransfer({
      bankCode: bank.bankCode,
      accountNumber: bank.accountNumber,
      amountNGN: ngnAmount,
      reference,
      narration: `SendPay withdrawal ${reference}`,
      callback_url: process.env.FLUTTERWAVE_CALLBACK_URL || undefined,
      idempotencyKey: reference,
    });
    
    // Update transaction with payout details
    await Transaction.findByIdAndUpdate(stuckTx._id, {
      $set: {
        status: "payout_pending",
        metadata: {
          ...stuckTx.metadata,
          withdrawalId: withdrawalId,
          flutterwave_reference: transfer?.data?.reference || reference,
          flutterwave_transfer_id: transfer?.data?.id || null,
          ngnAmount,
          usdAmount,
          payoutInitiatedAt: new Date(),
        },
      },
    });
    
    console.log('✅ Transaction updated successfully!');
    console.log(`Status changed to: payout_pending`);
    console.log(`Flutterwave Transfer ID: ${transfer?.data?.id}`);
    console.log(`Reference: ${reference}`);
    
  } catch (error) {
    console.error('❌ Error fixing transaction:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixStuckTransaction();
