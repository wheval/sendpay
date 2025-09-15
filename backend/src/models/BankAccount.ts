import mongoose, { Schema, Document } from 'mongoose';

export interface IBankAccount extends Document {
  userId: mongoose.Types.ObjectId;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  bankName: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BankAccountSchema = new Schema<IBankAccount>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  accountNumber: { type: String, required: true },
  bankCode: { type: String, required: true },
  accountName: { type: String, required: true },
  bankName: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for quick lookups
BankAccountSchema.index({ userId: 1, accountNumber: 1 });
BankAccountSchema.index({ accountNumber: 1 });

export const BankAccount = mongoose.model<IBankAccount>('BankAccount', BankAccountSchema);
