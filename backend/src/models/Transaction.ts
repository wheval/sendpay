import mongoose, { Schema } from 'mongoose';
import { ITransaction, ITransactionDocument } from '../types';

const TransactionSchema = new Schema<ITransactionDocument>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['received', 'withdrawn'],
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
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  reference: {
    type: String,
    required: true,
    unique: true,
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
  }
}, {
  timestamps: true
});

// Indexes for better query performance
TransactionSchema.index({ userId: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ reference: 1 });
TransactionSchema.index({ starknetTxHash: 1 });

// Virtual for formatted amounts
TransactionSchema.virtual('formattedAmountUSD').get(function() {
  return this.amountUSD.toFixed(2);
});

TransactionSchema.virtual('formattedAmountNGN').get(function() {
  return this.amountNGN.toLocaleString();
});

// Virtual for transaction age
TransactionSchema.virtual('age').get(function() {
  const now = new Date();
  const created = this.createdAt;
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
