import axios from 'axios';
import { IExchangeRate } from '../types';

class ExchangeRateService {
  private apiKey: string;
  private baseUrl: string;
  private cache: Map<string, { rate: number; timestamp: number }>;
  private cacheExpiry: number = 3600000; // 1 hour in milliseconds

  constructor() {
    this.apiKey = process.env.EXCHANGE_RATE_API_KEY || '';
    this.baseUrl = process.env.EXCHANGE_RATE_BASE_URL || 'https://api.exchangerate-api.com/v4';
    this.cache = new Map();
  }

  /**
   * Get USD to NGN exchange rate
   */
  async getUSDToNGNRate(): Promise<number> {
    const cacheKey = 'USD_NGN';
    const cached = this.cache.get(cacheKey);
    
    // Return cached rate if still valid
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.rate;
    }

    try {
      // Try to get real-time rate from API
      if (this.apiKey) {
        const response = await axios.get(`${this.baseUrl}/latest/USD`);
        const rate = response.data.rates.NGN;
        
        // Cache the rate
        this.cache.set(cacheKey, { rate, timestamp: Date.now() });
        
        return rate;
      }
    } catch (error) {
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
  async getNGNToUSDRate(): Promise<number> {
    const usdToNgnRate = await this.getUSDToNGNRate();
    return 1 / usdToNgnRate;
  }

  /**
   * Convert USD amount to NGN
   */
  async convertUSDToNGN(usdAmount: number): Promise<number> {
    const rate = await this.getUSDToNGNRate();
    return Math.round(usdAmount * rate);
  }

  /**
   * Convert NGN amount to USD
   */
  async convertNGNToUSD(ngnAmount: number): Promise<number> {
    const rate = await this.getNGNToUSDRate();
    return Math.round((ngnAmount * rate) * 100) / 100;
  }

  /**
   * Get exchange rate info
   */
  async getExchangeRateInfo(): Promise<IExchangeRate> {
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
  updateExchangeRate(rate: number): void {
    const cacheKey = 'USD_NGN';
    this.cache.set(cacheKey, { rate, timestamp: Date.now() });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache status
   */
  getCacheStatus(): { size: number; entries: Array<{ key: string; rate: number; age: number }> } {
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

export const exchangeRateService = new ExchangeRateService();
export default exchangeRateService;
