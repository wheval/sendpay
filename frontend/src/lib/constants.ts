// Bank configuration constants
// To add a new bank, simply add it to the SUPPORTED_BANKS array below
// To disable a bank, set isActive to false
export interface Bank {
  code: string
  name: string
  shortName: string
  isActive: boolean
}

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
