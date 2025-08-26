"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeRateService = void 0;
const axios_1 = __importDefault(require("axios"));
class ExchangeRateService {
    constructor() {
        this.cacheExpiry = 3600000; // 1 hour in milliseconds
        this.apiKey = process.env.EXCHANGE_RATE_API_KEY || '';
        this.baseUrl = process.env.EXCHANGE_RATE_BASE_URL || 'https://api.exchangerate-api.com/v4';
        this.cache = new Map();
    }
    /**
     * Get USD to NGN exchange rate
     */
    async getUSDToNGNRate() {
        const cacheKey = 'USD_NGN';
        const cached = this.cache.get(cacheKey);
        // Return cached rate if still valid
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.rate;
        }
        try {
            // Try to get real-time rate from API
            if (this.apiKey) {
                const response = await axios_1.default.get(`${this.baseUrl}/latest/USD`);
                const rate = response.data.rates.NGN;
                // Cache the rate
                this.cache.set(cacheKey, { rate, timestamp: Date.now() });
                return rate;
            }
        }
        catch (error) {
            console.warn('Failed to fetch real-time exchange rate:', error);
        }
        // Fallback to cached rate or default rate
        if (cached) {
            return cached.rate;
        }
        // Default rate (1 USD = 1000 NGN) - should be updated regularly
        const defaultRate = 1000;
        this.cache.set(cacheKey, { rate: defaultRate, timestamp: Date.now() });
        return defaultRate;
    }
    /**
     * Get NGN to USD exchange rate
     */
    async getNGNToUSDRate() {
        const usdToNgnRate = await this.getUSDToNGNRate();
        return 1 / usdToNgnRate;
    }
    /**
     * Convert USD amount to NGN
     */
    async convertUSDToNGN(usdAmount) {
        const rate = await this.getUSDToNGNRate();
        return Math.round(usdAmount * rate);
    }
    /**
     * Convert NGN amount to USD
     */
    async convertNGNToUSD(ngnAmount) {
        const rate = await this.getNGNToUSDRate();
        return Math.round((ngnAmount * rate) * 100) / 100;
    }
    /**
     * Get exchange rate info
     */
    async getExchangeRateInfo() {
        const rate = await this.getUSDToNGNRate();
        return {
            base: 'USD',
            target: 'NGN',
            rate,
            timestamp: Date.now()
        };
    }
    /**
     * Update exchange rate manually (for admin use)
     */
    updateExchangeRate(rate) {
        const cacheKey = 'USD_NGN';
        this.cache.set(cacheKey, { rate, timestamp: Date.now() });
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get cache status
     */
    getCacheStatus() {
        const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
            key,
            rate: value.rate,
            age: Date.now() - value.timestamp
        }));
        return {
            size: this.cache.size,
            entries
        };
    }
}
exports.exchangeRateService = new ExchangeRateService();
exports.default = exports.exchangeRateService;
//# sourceMappingURL=exchangeRateService.js.map