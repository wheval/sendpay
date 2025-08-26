import crypto from 'crypto';

/**
 * Generate a unique reference number for transactions
 */
export const generateReference = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8);
  return `REF${timestamp}${random}`.toUpperCase();
};

/**
 * Generate a unique transaction hash
 */
export const generateTransactionHash = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Format currency amounts
 */
export const formatCurrency = (amount: number, currency: string): string => {
  if (currency === 'NGN') {
    return `₦${amount.toLocaleString()}`;
  }
  if (currency === 'USD') {
    return `$${amount.toFixed(2)}`;
  }
  return amount.toString();
};

/**
 * Convert USD to NGN using exchange rate
 */
export const convertUSDToNGN = (usdAmount: number, exchangeRate: number): number => {
  return Math.round(usdAmount * exchangeRate);
};

/**
 * Convert NGN to USD using exchange rate
 */
export const convertNGNToUSD = (ngnAmount: number, exchangeRate: number): number => {
  return Math.round((ngnAmount / exchangeRate) * 100) / 100;
};

/**
 * Validate Nigerian bank account number
 */
export const validateNigerianAccountNumber = (accountNumber: string): boolean => {
  // Nigerian account numbers are typically 10 digits
  const accountRegex = /^\d{10}$/;
  return accountRegex.test(accountNumber);
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Mask sensitive information
 */
export const maskSensitiveData = (data: string, type: 'account' | 'email' | 'phone'): string => {
  switch (type) {
    case 'account':
      if (data.length <= 4) return data;
      return `${data.slice(0, 4)}****${data.slice(-4)}`;
    
    case 'email':
      const [username, domain] = data.split('@');
      if (username.length <= 2) return data;
      return `${username.slice(0, 2)}***@${domain}`;
    
    case 'phone':
      if (data.length <= 4) return data;
      return `${data.slice(0, 4)}****${data.slice(-4)}`;
    
    default:
      return data;
  }
};

/**
 * Calculate processing fee
 */
export const calculateProcessingFee = (amount: number, currency: string): number => {
  if (currency === 'NGN') {
    // 100 NGN flat fee for NGN transactions
    return 100;
  }
  if (currency === 'USD') {
    // 0.1 USD flat fee for USD transactions
    return 0.1;
  }
  return 0;
};

/**
 * Generate random string
 */
export const generateRandomString = (length: number): string => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Sleep utility for async operations
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
