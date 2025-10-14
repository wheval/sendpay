const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sendpay');

// Define Transaction schema (simplified)
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

const Transaction = mongoose.model('Transaction', transactionSchema);

async function debugLatestTransaction() {
  try {
    console.log('🔍 Debugging latest withdrawal transaction...\n');
    
    // Find the latest withdrawal transaction
    const latestTx = await Transaction.findOne({ flow: 'offramp' })
      .sort({ createdAt: -1 });
    
    if (!latestTx) {
      console.log('❌ No withdrawal transactions found');
      return;
    }
    
    console.log('📋 Latest Withdrawal Transaction:');
    console.log('=====================================');
    console.log(`ID: ${latestTx._id}`);
    console.log(`User ID: ${latestTx.userId}`);
    console.log(`Status: ${latestTx.status}`);
    console.log(`Amount USD: $${latestTx.amountUSD}`);
    console.log(`Amount NGN: ₦${latestTx.amountNGN}`);
    console.log(`Reference: ${latestTx.reference}`);
    console.log(`Starknet TX: ${latestTx.starknetTxHash || 'Not set'}`);
    console.log(`Created: ${latestTx.createdAt}`);
    console.log(`Updated: ${latestTx.updatedAt}`);
    console.log('\n📊 Metadata:');
    console.log(JSON.stringify(latestTx.metadata, null, 2));
    
    // Check if there are any other recent transactions
    const recentTxs = await Transaction.find({ flow: 'offramp' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id status amountUSD amountNGN reference createdAt metadata.txRef metadata.withdrawalId');
    
    console.log('\n📈 Recent Withdrawal Transactions:');
    console.log('=====================================');
    recentTxs.forEach((tx, index) => {
      console.log(`${index + 1}. ${tx._id}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Amount: $${tx.amountUSD} / ₦${tx.amountNGN}`);
      console.log(`   Reference: ${tx.reference}`);
      console.log(`   txRef: ${tx.metadata?.txRef || 'Not set'}`);
      console.log(`   withdrawalId: ${tx.metadata?.withdrawalId || 'Not set'}`);
      console.log(`   Created: ${tx.createdAt}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error debugging transaction:', error);
  } finally {
    mongoose.connection.close();
  }
}

debugLatestTransaction();
