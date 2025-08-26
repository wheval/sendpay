/**
 * Generate a unique reference number for transactions
 */
export declare const generateReference: () => string;
/**
 * Generate a unique transaction hash
 */
export declare const generateTransactionHash: () => string;
/**
 * Format currency amounts
 */
export declare const formatCurrency: (amount: number, currency: string) => string;
/**
 * Convert USD to NGN using exchange rate
 */
export declare const convertUSDToNGN: (usdAmount: number, exchangeRate: number) => number;
/**
 * Convert NGN to USD using exchange rate
 */
export declare const convertNGNToUSD: (ngnAmount: number, exchangeRate: number) => number;
/**
 * Validate Nigerian bank account number
 */
export declare const validateNigerianAccountNumber: (accountNumber: string) => boolean;
/**
 * Validate email format
 */
export declare const validateEmail: (email: string) => boolean;
/**
 * Mask sensitive information
 */
export declare const maskSensitiveData: (data: string, type: "account" | "email" | "phone") => string;
/**
 * Calculate processing fee
 */
export declare const calculateProcessingFee: (amount: number, currency: string) => number;
/**
 * Generate random string
 */
export declare const generateRandomString: (length: number) => string;
/**
 * Sleep utility for async operations
 */
export declare const sleep: (ms: number) => Promise<void>;
//# sourceMappingURL=helpers.d.ts.map