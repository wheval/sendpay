import mongoose, { Schema } from 'mongoose';
import { ITransaction, ITransactionDocument } from '../types';

const TransactionSchema = new Schema<ITransactionDocument>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  flow: {
    type: String,
    enum: ['onramp', 'offramp'],
    required: true
  },
  status: {
    type: String,
    enum: [
      // offramp lifecycle
      'created', 'signed', 'submitted_onchain', 'event_emitted', 'payout_pending', 'payout_completed', 'onchain_completed', 'payout_failed',
      // onramp lifecycle
      'credit_pending', 'credited', 'credit_failed'
    ],
    required: true
  },
  amountUSD: {
    type: Number,
    required: true,
    min: 0
  },
  amountNGN: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  reference: {
    type: String,
    required: true,
    trim: true
  },
  starknetTxHash: {
    type: String,
    trim: true
  },
  bankDetails: {
    bankName: {
      type: String,
      trim: true
    },
    accountNumber: {
      type: String,
      trim: true
    }
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for better query performance
TransactionSchema.index({ userId: 1 });
TransactionSchema.index({ flow: 1 });
TransactionSchema.index({ status: 1, flow: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ reference: 1 }, { unique: true });
TransactionSchema.index({ starknetTxHash: 1 });

// Virtual for formatted amounts
TransactionSchema.virtual('formattedAmountUSD').get(function(this: any) {
  return Number(this.amountUSD || 0).toFixed(2);
});

TransactionSchema.virtual('formattedAmountNGN').get(function(this: any) {
  return Number(this.amountNGN || 0).toLocaleString();
});

// Virtual for transaction age
TransactionSchema.virtual('age').get(function(this: any) {
  const now = new Date();
  const created: Date | undefined = this.createdAt || this.get?.('createdAt');
  if (!created) return 'Unknown';
  
  const diffInHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
});

// Ensure virtual fields are serialized
TransactionSchema.set('toJSON', { virtuals: true });
TransactionSchema.set('toObject', { virtuals: true });

export const Transaction = mongoose.model<ITransactionDocument>('Transaction', TransactionSchema);
