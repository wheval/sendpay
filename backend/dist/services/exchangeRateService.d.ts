import { IExchangeRate } from '../types';
declare class ExchangeRateService {
    private apiKey;
    private baseUrl;
    private cache;
    private cacheExpiry;
    constructor();
    /**
     * Get USD to NGN exchange rate
     */
    getUSDToNGNRate(): Promise<number>;
    /**
     * Get NGN to USD exchange rate
     */
    getNGNToUSDRate(): Promise<number>;
    /**
     * Convert USD amount to NGN
     */
    convertUSDToNGN(usdAmount: number): Promise<number>;
    /**
     * Convert NGN amount to USD
     */
    convertNGNToUSD(ngnAmount: number): Promise<number>;
    /**
     * Get exchange rate info
     */
    getExchangeRateInfo(): Promise<IExchangeRate>;
    /**
     * Update exchange rate manually (for admin use)
     */
    updateExchangeRate(rate: number): void;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Get cache status
     */
    getCacheStatus(): {
        size: number;
        entries: Array<{
            key: string;
            rate: number;
            age: number;
        }>;
    };
}
export declare const exchangeRateService: ExchangeRateService;
export default exchangeRateService;
//# sourceMappingURL=exchangeRateService.d.ts.map