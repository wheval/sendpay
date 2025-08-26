"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.generateRandomString = exports.calculateProcessingFee = exports.maskSensitiveData = exports.validateEmail = exports.validateNigerianAccountNumber = exports.convertNGNToUSD = exports.convertUSDToNGN = exports.formatCurrency = exports.generateTransactionHash = exports.generateReference = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generate a unique reference number for transactions
 */
const generateReference = () => {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `REF${timestamp}${random}`.toUpperCase();
};
exports.generateReference = generateReference;
/**
 * Generate a unique transaction hash
 */
const generateTransactionHash = () => {
    return crypto_1.default.randomBytes(32).toString('hex');
};
exports.generateTransactionHash = generateTransactionHash;
/**
 * Format currency amounts
 */
const formatCurrency = (amount, currency) => {
    if (currency === 'NGN') {
        return `₦${amount.toLocaleString()}`;
    }
    if (currency === 'USD') {
        return `$${amount.toFixed(2)}`;
    }
    return amount.toString();
};
exports.formatCurrency = formatCurrency;
/**
 * Convert USD to NGN using exchange rate
 */
const convertUSDToNGN = (usdAmount, exchangeRate) => {
    return Math.round(usdAmount * exchangeRate);
};
exports.convertUSDToNGN = convertUSDToNGN;
/**
 * Convert NGN to USD using exchange rate
 */
const convertNGNToUSD = (ngnAmount, exchangeRate) => {
    return Math.round((ngnAmount / exchangeRate) * 100) / 100;
};
exports.convertNGNToUSD = convertNGNToUSD;
/**
 * Validate Nigerian bank account number
 */
const validateNigerianAccountNumber = (accountNumber) => {
    // Nigerian account numbers are typically 10 digits
    const accountRegex = /^\d{10}$/;
    return accountRegex.test(accountNumber);
};
exports.validateNigerianAccountNumber = validateNigerianAccountNumber;
/**
 * Validate email format
 */
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.validateEmail = validateEmail;
/**
 * Mask sensitive information
 */
const maskSensitiveData = (data, type) => {
    switch (type) {
        case 'account':
            if (data.length <= 4)
                return data;
            return `${data.slice(0, 4)}****${data.slice(-4)}`;
        case 'email':
            const [username, domain] = data.split('@');
            if (username.length <= 2)
                return data;
            return `${username.slice(0, 2)}***@${domain}`;
        case 'phone':
            if (data.length <= 4)
                return data;
            return `${data.slice(0, 4)}****${data.slice(-4)}`;
        default:
            return data;
    }
};
exports.maskSensitiveData = maskSensitiveData;
/**
 * Calculate processing fee
 */
const calculateProcessingFee = (amount, currency) => {
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
exports.calculateProcessingFee = calculateProcessingFee;
/**
 * Generate random string
 */
const generateRandomString = (length) => {
    return crypto_1.default.randomBytes(length).toString('hex');
};
exports.generateRandomString = generateRandomString;
/**
 * Sleep utility for async operations
 */
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.sleep = sleep;
//# sourceMappingURL=helpers.js.map