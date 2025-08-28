import mongoose, { Schema, Document } from 'mongoose';

export interface IWithdrawal {
  userId: string;
  amount: number;
  token: 'USDC' | 'STRK';
  amountNGN: number;
  bankAccount: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  description?: string;
  status: 'pending' | 'swapping' | 'processing' | 'completed' | 'failed';
  swapTxHash?: string;
  contractTxHash?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWithdrawalDocument extends IWithdrawal, Document {}

const WithdrawalSchema = new Schema<IWithdrawalDocument>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  token: {
    type: String,
    required: true,
    enum: ['USDC', 'STRK']
  },
  amountNGN: {
    type: Number,
    required: true,
    min: 1000
  },
  bankAccount: {
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
  description: {
    type: String,
    required: false
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'swapping', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  swapTxHash: {
    type: String,
    required: false
  },
  contractTxHash: {
    type: String,
    required: false
  },
  error: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
WithdrawalSchema.index({ userId: 1 });
WithdrawalSchema.index({ status: 1 });
WithdrawalSchema.index({ createdAt: 1 });
WithdrawalSchema.index({ swapTxHash: 1 });
WithdrawalSchema.index({ contractTxHash: 1 });

export const Withdrawal = mongoose.model<IWithdrawalDocument>('Withdrawal', WithdrawalSchema);
