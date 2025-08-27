import axios from 'axios'

class CoingeckoService {
	private cache = new Map<string, { price: number; ts: number }>()
	private ttlMs = Number(process.env.COINGECKO_CACHE_TTL_MS || 60_000)
	private baseUrl = process.env.COINGECKO_BASE_URL || 'https://api.coingecko.com/api/v3'

	private cacheKey(id: string, vs: string) { return `${id}_${vs}` }

	async getSimplePrice(id: string, vs: string = 'usd'): Promise<number> {
		const key = this.cacheKey(id, vs)
		const cached = this.cache.get(key)
		if (cached && Date.now() - cached.ts < this.ttlMs) return cached.price

		const url = `${this.baseUrl}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=${encodeURIComponent(vs)}`
		const res = await axios.get(url, { timeout: 8000 })
		const price = Number(res.data?.[id]?.[vs])
		if (!isNaN(price) && price > 0) {
			this.cache.set(key, { price, ts: Date.now() })
			return price
		}
		throw new Error(`Coingecko returned invalid price for ${id}/${vs}`)
	}
}

export const coingeckoService = new CoingeckoService()
export default coingeckoService


