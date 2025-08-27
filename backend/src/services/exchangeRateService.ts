import axios from 'axios';
import { IExchangeRate } from '../types';
import { DEFAULT_USD_NGN_FALLBACK } from '../lib/constants';

class ExchangeRateService {
  private flutterwaveKey: string;
  private flutterwaveBaseUrl: string;
  private flutterwaveSandboxBaseUrl: string;
  private cache: Map<string, { rate: number; timestamp: number }>;
  private cacheExpiry: number = 3600000; // 1 hour in milliseconds

  constructor() {
    this.flutterwaveKey = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || '';
    this.flutterwaveBaseUrl = process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.com';
    this.flutterwaveSandboxBaseUrl = process.env.FLUTTERWAVE_SANDBOX_BASE_URL || 'https://api.flutterwave.cloud/developersandbox';
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
      // Read key at call-time to avoid early import order issues
      const runtimeKey = this.flutterwaveKey || process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || ''
      // Flutterwave FX quote (supports live and sandbox)
      if (!runtimeKey) {
        console.warn('[fx] Flutterwave key missing; cannot fetch USD->NGN')
      } else {
        // Prefer sandbox endpoint if FLW_ENV=sandbox
        const env = (process.env.FLW_ENV || process.env.FLUTTERWAVE_ENV || '').toLowerCase()
        const isSandbox = env === 'sandbox' || /sandbox/i.test(runtimeKey)

        let fwRate = 0
        if (isSandbox) {
          const url = `${this.flutterwaveSandboxBaseUrl.replace(/\/$/, '')}/transfers/rates`
          const body = { source: { currency: 'USD' }, destination: { currency: 'NGN', amount: 1 } }
          const fwRes = await axios.post(url, body, {
            headers: { Authorization: `Bearer ${runtimeKey}`, 'content-type': 'application/json', accept: 'application/json' },
            timeout: 8000,
          })
          const status = fwRes.status
          const data = fwRes.data
          fwRate = Number(data?.data?.rate ?? data?.rate)
          if (isNaN(fwRate) || fwRate <= 0) {
            console.warn('[fx] Flutterwave sandbox returned no rate. status:', status, 'body:', JSON.stringify(data))
          }
        } else {
          const url = `${this.flutterwaveBaseUrl.replace(/\/$/, '')}/v3/rates`
          const fwRes = await axios.get(url, {
            params: { from: 'USD', to: 'NGN', amount: 1 },
            headers: { Authorization: `Bearer ${runtimeKey}` },
            timeout: 8000,
          })
          const status = fwRes.status
          const data = fwRes.data
          fwRate = Number(data?.data?.rate ?? data?.rate)
          if (isNaN(fwRate) || fwRate <= 0) {
            console.warn('[fx] Flutterwave live returned no rate. status:', status, 'body:', JSON.stringify(data))
          }
        }
        if (!isNaN(fwRate) && fwRate > 0) {
          console.log('[fx] Flutterwave rate used USD->NGN:', fwRate)
          this.cache.set(cacheKey, { rate: fwRate, timestamp: Date.now() })
          return fwRate
        }
      }
    } catch (fwErr: any) {
      console.warn('[fx] Flutterwave request failed', fwErr?.response?.status || '', fwErr?.message || fwErr)
    }

    // Fallback: return cached rate if present; otherwise configured default
    if (cached) {
      console.warn('[fx] Using cached USD->NGN rate:', cached.rate)
      return cached.rate
    }
    const fallback = DEFAULT_USD_NGN_FALLBACK
    console.warn('[fx] Using configured fallback USD->NGN rate:', fallback)
    this.cache.set(cacheKey, { rate: fallback, timestamp: Date.now() })
    return fallback
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
