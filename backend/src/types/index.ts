import { Document, Types } from 'mongoose';

// User Types
export interface IUser {
  _id?: string;
  email: string;
  name: string;
  phone?: string;
  cavosWalletAddress?: string;
  starknetNetwork?: 'sepolia' | 'mainnet';
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  balance: number;
  balanceUSD: number;
  balanceNGN: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Transaction Types
export interface ITransaction {
  _id?: string;
  userId: string | IUser;
  type: 'received' | 'withdrawn';
  amountUSD: number;
  amountNGN: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  reference: string;
  starknetTxHash?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
  };
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

// Payment Types
export interface IPaymentRequest {
  amount: number;
  currency: 'USD' | 'NGN';
  description?: string;
}

export interface IPaymentResponse {
  success: boolean;
  message: string;
  transactionId?: string;
  starknetTxHash?: string;
}

// Withdrawal Types
export interface IWithdrawalRequest {
  amount: number;
  bankAccountId: string;
}

export interface IWithdrawalResponse {
  success: boolean;
  message: string;
  withdrawalId?: string;
  estimatedArrival?: string;
}

// Starknet Types
export interface IStarknetConfig {
  rpcUrl: string;
  chainId: string;
  contractAddress: string;
  usdcTokenAddress: string;
}

export interface IStarknetTransaction {
  hash: string;
  status: 'pending' | 'accepted' | 'rejected';
  blockNumber?: number;
  timestamp?: number;
}

// API Response Types
export interface IApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// Authentication Types
export interface IAuthRequest {
  email: string;
  password?: string;
  provider?: 'google' | 'apple';
  token?: string;
}

export interface IAuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: Partial<IUser>;
}

// Exchange Rate Types
export interface IExchangeRate {
  base: string;
  target: string;
  rate: number;
  timestamp: number;
}

// Bank Account Types
export interface IBankAccount {
  _id?: string;
  userId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  recipientCode?: string;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Extended interfaces for Mongoose documents
export interface IUserDocument extends Document {
  email: string;
  name: string;
  phone?: string;
  cavosWalletAddress: string;
  starknetNetwork?: 'sepolia' | 'mainnet';
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  balance: number;
  balanceUSD: number;
  balanceNGN: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITransactionDocument extends Document {
  userId: Types.ObjectId;
  type: 'received' | 'withdrawn';
  amountUSD: number;
  amountNGN: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  reference: string;
  starknetTxHash?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
  };
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IBankAccountDocument extends Document {
  userId: Types.ObjectId;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  recipientCode?: string;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
