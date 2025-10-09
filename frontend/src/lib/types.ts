// Bank Types
export interface Bank {
  id: number;
  code: string;
  name: string;
  country: string;
  currency: string;
  type: string;
  active: boolean;
}

// User Types
export interface IUser {
  _id?: string;
  email: string;
  name: string;
  phone?: string;
  chipiWalletAddress?: string;
  starknetNetwork?: 'sepolia' | 'mainnet';
  bankDetails: {
    bankCode: string;
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
