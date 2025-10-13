export type StarknetNetwork = 'sepolia' | 'mainnet'
export const STARKNET_NETWORK: StarknetNetwork = ((process.env.STARKNET_NETWORK || process.env.NEXT_PUBLIC_STARKNET_NETWORK) as StarknetNetwork) || 'sepolia'

type TokenConfig = { address: string; decimals: number }

const STRK: Record<StarknetNetwork, TokenConfig> = {
	sepolia: { address: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', decimals: 18 },
	mainnet: { address: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', decimals: 18 }
}

const USDC: Record<StarknetNetwork, TokenConfig> = {
	sepolia: { address: '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080', decimals: 6 },
	mainnet: { address: '0x053C91253BC9682c04929cA02ED00b3E423f6710D2ee7e0D5EBB06F3eCF368A8', decimals: 6 }
}

const USDT: Record<StarknetNetwork, TokenConfig> = {
	sepolia: { address: '0x03b7e72bf60e6b69a70529cb527d1ef5b48ae62736a7e3bf314e6e0c8ae6e1f2', decimals: 6 },
	mainnet: { address: '0x03801ddabb5f866e0632bfe800f4ef4b450c866f9ee7b8a28d0b9230e6505bdf', decimals: 6 }
}

const ETH: Record<StarknetNetwork, TokenConfig> = {
	sepolia: { address: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', decimals: 18 },
	mainnet: { address: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', decimals: 18 }
}

export const TOKENS = { STRK, USDC, USDT, ETH, NETWORK: STARKNET_NETWORK }

export function getTokenConfig(symbol: 'STRK'|'USDC'|'USDT'|'ETH'): TokenConfig {
	return TOKENS[symbol][TOKENS.NETWORK]
}

export const DEFAULT_USD_NGN_FALLBACK: number = Number(process.env.USD_NGN_FALLBACK || 1500)

// Contract addresses
export const SENDPAY_CONTRACT_ADDRESS = process.env.SENDPAY_CONTRACT_ADDRESS || '0x0444d5c9b2a6375bdce805338cdf6340439be92aec2e854704e77bedcdfd929a'

// Flutterwave configuration
export const FLUTTERWAVE_CLIENT_ID = process.env.FLUTTERWAVE_CLIENT_ID || ''
export const FLUTTERWAVE_CLIENT_SECRET = process.env.FLUTTERWAVE_CLIENT_SECRET || ''
export const FLUTTERWAVE_ENCRYPTION_KEY = process.env.FLUTTERWAVE_ENCRYPTION_KEY || ''
export const FLUTTERWAVE_CALLBACK_URL = process.env.FLUTTERWAVE_CALLBACK_URL || 'http://localhost:3001/api/flutterwave/webhook'

// Starknet configuration
export const STARKNET_RPC_URL = process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'

// Apibara configuration
export const DNA_TOKEN = process.env.DNA_TOKEN || ''
export const APIBARA_STREAM_URL = process.env.APIBARA_STREAM_URL || 'https://sepolia.starknet.a5a.ch'


declare const _StarknetChainId: {
    readonly SN_MAIN: "0x534e5f4d41494e";
    readonly SN_SEPOLIA: "0x534e5f5345504f4c4941";
};