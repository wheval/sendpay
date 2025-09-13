// Bank configuration constants
// To add a new bank, simply add it to the SUPPORTED_BANKS array below
// To disable a bank, set isActive to false
export interface Bank {
  code: string
  name: string
  shortName: string
  isActive: boolean
}


//TODO: change this to get bank from flutterwave
// Supported Nigerian Banks
export const SUPPORTED_BANKS: Bank[] = [
  {
    code: "gtb",
    name: "Guaranty Trust Bank",
    shortName: "GT Bank",
    isActive: true
  },
  {
    code: "zenith",
    name: "Zenith Bank",
    shortName: "Zenith Bank",
    isActive: true
  },
  {
    code: "access",
    name: "Access Bank",
    shortName: "Access Bank",
    isActive: true
  },
  {
    code: "first",
    name: "First Bank of Nigeria",
    shortName: "First Bank",
    isActive: true
  },
  {
    code: "uba",
    name: "United Bank for Africa",
    shortName: "UBA",
    isActive: true
  },
  {
    code: "ecobank",
    name: "Ecobank Nigeria",
    shortName: "Ecobank",
    isActive: true
  },
  {
    code: "fidelity",
    name: "Fidelity Bank",
    shortName: "Fidelity Bank",
    isActive: true
  },
  {
    code: "stanbic",
    name: "Stanbic IBTC Bank",
    shortName: "Stanbic IBTC",
    isActive: true
  },
  {
    code: "union",
    name: "Union Bank of Nigeria",
    shortName: "Union Bank",
    isActive: true
  },
  {
    code: "wema",
    name: "Wema Bank",
    shortName: "Wema Bank",
    isActive: true
  },
  {
    code: "polaris",
    name: "Polaris Bank",
    shortName: "Polaris Bank",
    isActive: true
  },
  {
    code: "keystone",
    name: "Keystone Bank",
    shortName: "Keystone Bank",
    isActive: true
  },
  {
    code: "heritage",
    name: "Heritage Bank",
    shortName: "Heritage Bank",
    isActive: true
  },
  {
    code: "unity",
    name: "Unity Bank",
    shortName: "Unity Bank",
    isActive: true
  },
]

// Helper function to get active banks
export const getActiveBanks = (): Bank[] => {
  return SUPPORTED_BANKS.filter(bank => bank.isActive)
}

// Helper function to get bank by code
export const getBankByCode = (code: string): Bank | undefined => {
  return SUPPORTED_BANKS.find(bank => bank.code === code)
}

// -------- Starknet token constants --------
export type StarknetNetwork = 'sepolia' | 'mainnet'

const NETWORK: StarknetNetwork = (process.env.NEXT_PUBLIC_STARKNET_NETWORK as StarknetNetwork) || 'sepolia'

const toLower = (addr: string) => addr?.toLowerCase()

// STRK (same provided on both)
const STRK_ADDRESSES: Record<StarknetNetwork, { address: string; decimals: string }> = {
  sepolia: { address: toLower('0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'), decimals: '18' },
  mainnet: { address: toLower('0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'), decimals: '18' },
}

// ETH
const ETH_ADDRESSES: Record<StarknetNetwork, { address: string; decimals: string }> = {
  sepolia: { address: toLower('0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'), decimals: '18' },
  mainnet: { address: toLower('0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7'), decimals: '18' },
}

// USDC
const USDC_ADDRESSES: Record<StarknetNetwork, { address: string; decimals: string }> = {
  sepolia: { address: toLower('0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080'), decimals: '6' },
  mainnet: { address: toLower('0x053C91253BC9682c04929cA02ED00b3E423f6710D2ee7e0D5EBB06F3eCF368A8'), decimals: '6' },
}

// USDT
const USDT_ADDRESSES: Record<StarknetNetwork, { address: string; decimals: string }> = {
  sepolia: { address: toLower('0x07d83b422a5feE99AFaCa50B6Adf7De759af4A725f61ccE747E06b6c09f7aB38'), decimals: '6' },
  mainnet: { address: toLower('0x068F5c6a61780768455de69077E07e89787839bf8166dEcfBf92B645209c0fB8'), decimals: '6' },
}

export type TokenSymbol = 'STRK' | 'ETH' | 'USDC' | 'USDT'

export const TOKENS: Record<TokenSymbol | 'NETWORK', any> = {
  STRK: STRK_ADDRESSES[NETWORK],
  ETH: ETH_ADDRESSES[NETWORK],
  USDC: USDC_ADDRESSES[NETWORK],
  USDT: USDT_ADDRESSES[NETWORK],
  NETWORK,
}

export const getTokenConfig = (symbol: TokenSymbol) => TOKENS[symbol]
