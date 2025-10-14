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

async function retryPayoutWithCorrectCredentials() {
  try {
    console.log('🔄 Retrying payout with correct Flutterwave credentials...\n');
    
    // Find the failed transaction
    const tx = await Transaction.findOne({ 
      flow: 'offramp',
      status: 'payout_failed',
      'metadata.withdrawalId': 854073
    });
    
    if (!tx) {
      console.log('❌ No failed transaction found');
      return;
    }
    
    console.log('📋 Failed transaction found:');
    console.log(`ID: ${tx._id}`);
    console.log(`Amount: $${tx.amountUSD} / ₦${tx.metadata?.ngnAmount}`);
    console.log(`Error: ${tx.metadata?.error}`);
    
    // Get bank account details
    const bank = await BankAccount.findById(tx.metadata?.bankAccountId);
    if (!bank) {
      console.log('❌ Bank account not found');
      return;
    }
    
    console.log('🏦 Bank account details:');
    console.log(`Bank Code: ${bank.bankCode}`);
    console.log(`Account Number: ${bank.accountNumber}`);
    console.log(`Account Name: ${bank.accountName}`);
    
    // Check Flutterwave credentials
    console.log('\n🔑 Checking Flutterwave credentials...');
    console.log(`Client ID: ${process.env.FLUTTERWAVE_CLIENT_ID ? 'Set' : 'Not set'}`);
    console.log(`Client Secret: ${process.env.FLUTTERWAVE_CLIENT_SECRET ? 'Set' : 'Not set'}`);
    
    if (!process.env.FLUTTERWAVE_CLIENT_ID || !process.env.FLUTTERWAVE_CLIENT_SECRET) {
      console.log('❌ Flutterwave credentials not configured');
      console.log('Please set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET in your .env file');
      return;
    }
    
    // Reset transaction status to retry
    await Transaction.findByIdAndUpdate(tx._id, {
      $set: {
        status: 'payout_pending',
        $unset: {
          'metadata.error': 1,
          'metadata.errorDetails': 1,
          'metadata.payoutFailedAt': 1
        }
      }
    });
    
    console.log('✅ Transaction status reset to payout_pending');
    console.log('\n🚀 Now you can run the payout script again with correct credentials');
    console.log('Or manually initiate the transfer through your backend API');
    
  } catch (error) {
    console.error('❌ Error retrying payout:', error);
  } finally {
    mongoose.connection.close();
  }
}

retryPayoutWithCorrectCredentials();
