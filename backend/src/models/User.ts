import mongoose, { Schema } from 'mongoose';
import { IUser, IUserDocument } from '../types';


const UserSchema = new Schema<IUserDocument>({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: false,
    trim: true
  },
  chipiWalletAddress: {
    type: String,
    required: false,
    sparse: true,
    unique: true,
    trim: true
  },
  chipiPublicKey: {
    type: String,
    required: false,
    trim: true
  },
  chipiEncryptedPrivateKey: {
    type: String,
    required: false,
    trim: true
  },
  starknetNetwork: {
    type: String,
    enum: ['sepolia', 'mainnet'],
    default: 'sepolia',
    required: false
  },
  bankDetails: {
    bankName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    accountName: {
      type: String,
      required: true
    }
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceUSD: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceNGN: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ chipiWalletAddress: 1 }, { unique: true, sparse: true });
UserSchema.index({ 'bankDetails.accountNumber': 1 });

// Virtual for formatted balance
UserSchema.virtual('formattedBalanceUSD').get(function() {
  return this.balanceUSD.toFixed(2);
});

UserSchema.virtual('formattedBalanceNGN').get(function() {
  return this.balanceNGN.toLocaleString();
});

// Ensure virtual fields are serialized
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

export const User = mongoose.model<IUserDocument>('User', UserSchema);
