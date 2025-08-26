import { Document, Types } from 'mongoose';
export interface IUser {
    _id?: string;
    email: string;
    name: string;
    cavosWalletAddress: string;
    bankDetails: {
        bankName: string;
        accountNumber: string;
        accountName: string;
    };
    balanceUSD: number;
    balanceNGN: number;
    createdAt?: Date;
    updatedAt?: Date;
}
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
    createdAt?: Date;
    updatedAt?: Date;
}
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
export interface IApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
}
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
export interface IExchangeRate {
    base: string;
    target: string;
    rate: number;
    timestamp: number;
}
export interface IBankAccount {
    _id?: string;
    userId: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    isDefault: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface IUserDocument extends Document {
    email: string;
    name: string;
    cavosWalletAddress: string;
    bankDetails: {
        bankName: string;
        accountNumber: string;
        accountName: string;
    };
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
    createdAt?: Date;
    updatedAt?: Date;
}
export interface IBankAccountDocument extends Document {
    userId: Types.ObjectId;
    bankName: string;
    accountNumber: string;
    accountName: string;
    isDefault: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
//# sourceMappingURL=index.d.ts.map