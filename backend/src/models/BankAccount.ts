import mongoose, { Schema } from 'mongoose';
import { IBankAccount, IBankAccountDocument } from '../types';

const BankAccountSchema = new Schema<IBankAccountDocument>({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bankName: {
    type: String,
    required: true,
    trim: true
  },
  accountNumber: {
    type: String,
    required: true,
    trim: true
  },
  accountName: {
    type: String,
    required: true,
    trim: true
  },
  bankCode: {
    type: String,
    required: true,
    trim: true
  },
  recipientCode: {
    type: String,
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
BankAccountSchema.index({ userId: 1 });
BankAccountSchema.index({ accountNumber: 1 });
BankAccountSchema.index({ isDefault: 1 });

// Ensure only one default account per user
BankAccountSchema.pre('save', async function(next) {
  const doc = this as IBankAccountDocument;
  if (doc.isDefault) {
    // Remove default flag from other accounts
    await mongoose.model('BankAccount').updateMany(
      { userId: doc.userId, _id: { $ne: doc._id } },
      { isDefault: false }
    );
  }
  next();
});

// Virtual for masked account number
BankAccountSchema.virtual('maskedAccountNumber').get(function() {
  const doc = this as IBankAccountDocument;
  const accountNumber = doc.accountNumber;
  if (accountNumber.length <= 4) return accountNumber;
  return `${accountNumber.slice(0, 4)}****${accountNumber.slice(-4)}`;
});

// Ensure virtual fields are serialized
BankAccountSchema.set('toJSON', { virtuals: true });
BankAccountSchema.set('toObject', { virtuals: true });

export const BankAccount = mongoose.model<IBankAccountDocument>('BankAccount', BankAccountSchema);
