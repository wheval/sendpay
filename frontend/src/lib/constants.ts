export interface Bank {
  code: string;
  id: string; 
  name: string;
}

// -------- Starknet token constants --------
export type StarknetNetwork = "sepolia" | "mainnet";

const NETWORK: StarknetNetwork =
  (process.env.NEXT_PUBLIC_STARKNET_NETWORK as StarknetNetwork) || "sepolia";

const toLower = (addr: string) => addr?.toLowerCase();

// STRK (same provided on both)
const STRK_ADDRESSES: Record<
  StarknetNetwork,
  { address: string; decimals: string }
> = {
  sepolia: {
    address: toLower(
      "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
    ),
    decimals: "18",
  },
  mainnet: {
    address: toLower(
      "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
    ),
    decimals: "18",
  },
};

// ETH
const ETH_ADDRESSES: Record<
  StarknetNetwork,
  { address: string; decimals: string }
> = {
  sepolia: {
    address: toLower(
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"
    ),
    decimals: "18",
  },
  mainnet: {
    address: toLower(
      "0x049D36570D4e46f48e99674bd3fcc84644DdD6b96F7C741B1562B82f9e004dC7"
    ),
    decimals: "18",
  },
};

// USDC
const USDC_ADDRESSES: Record<
  StarknetNetwork,
  { address: string; decimals: string }
> = {
  sepolia: {
    address: toLower(
      "0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080"
    ),
    decimals: "6",
  },
  mainnet: {
    address: toLower(
      "0x053C91253BC9682c04929cA02ED00b3E423f6710D2ee7e0D5EBB06F3eCF368A8"
    ),
    decimals: "6",
  },
};

// USDT
const USDT_ADDRESSES: Record<
  StarknetNetwork,
  { address: string; decimals: string }
> = {
  sepolia: {
    address: toLower(
      "0x07d83b422a5feE99AFaCa50B6Adf7De759af4A725f61ccE747E06b6c09f7aB38"
    ),
    decimals: "6",
  },
  mainnet: {
    address: toLower(
      "0x068F5c6a61780768455de69077E07e89787839bf8166dEcfBf92B645209c0fB8"
    ),
    decimals: "6",
  },
};

export type TokenSymbol = "STRK" | "ETH" | "USDC" | "USDT";

export const DEFAULT_USD_NGN_FALLBACK: number = Number(process.env.USD_NGN_FALLBACK || 1500)

export const TOKENS: Record<
  TokenSymbol | "NETWORK",
  { address: string; decimals: string } | StarknetNetwork
> = {
  STRK: STRK_ADDRESSES[NETWORK],
  ETH: ETH_ADDRESSES[NETWORK],
  USDC: USDC_ADDRESSES[NETWORK],
  USDT: USDT_ADDRESSES[NETWORK],
  NETWORK,
};

export const getTokenConfig = (symbol: TokenSymbol) => TOKENS[symbol];

export const SUPPORTED_BANKS: Bank[] = [
  {
    id: "2300",
    code: "110005",
    name: "3Line Card Management Limited"
  },
  {
    id: "2324",
    code: "120001",
    name: "9 Payment Service Bank"
  },
  {
    id: "1814",
    code: "050005",
    name: "Aaa Finance"
  },
  {
    id: "191",
    code: "044",
    name: "Access Bank"
  },
  {
    id: "147",
    code: "323",
    name: "Access Money"
  },
  {
    id: "2269",
    code: "100013",
    name: "AccessMobile"
  },
  {
    id: "2306",
    code: "110011",
    name: "Arca Payments"
  },
  {
    id: "174",
    code: "401",
    name: "ASO Savings and & Loans"
  },
  {
    id: "2294",
    code: "100052",
    name: "Beta-Access Yello"
  },
  {
    id: "1815",
    code: "050006",
    name: "Branch International Financial Services"
  },
  {
    id: "2314",
    code: "110021",
    name: "Bud Infrastructure Limited"
  },
  {
    id: "2316",
    code: "110023",
    name: "Capricorn Digital"
  },
  {
    id: "2332",
    code: "999001",
    name: "CBN_TSA"
  },
  {
    id: "173",
    code: "317",
    name: "Cellulant"
  },
  {
    id: "2307",
    code: "110012",
    name: "Cellulant Pssp"
  },
  {
    id: "162",
    code: "303",
    name: "ChamsMobile"
  },
  {
    id: "145",
    code: "023",
    name: "CitiBank"
  },
  {
    id: "2288",
    code: "100032",
    name: "Contec Global Infotech Limited (NowNow)"
  },
  {
    id: "183",
    code: "559",
    name: "Coronation Merchant Bank"
  },
  {
    id: "1810",
    code: "050001",
    name: "County Finance Ltd"
  },
  {
    id: "2311",
    code: "110017",
    name: "Crowdforce"
  },
  {
    id: "2309",
    code: "110014",
    name: "Cyberspace Limited"
  },
  {
    id: "170",
    code: "063",
    name: "Diamond Bank"
  },
  {
    id: "1821",
    code: "050013",
    name: "Dignity Finance"
  },
  {
    id: "148",
    code: "302",
    name: "Eartholeum"
  },
  {
    id: "152",
    code: "050",
    name: "Ecobank Plc"
  },
  {
    id: "2264",
    code: "100008",
    name: "Ecobank Xpress Account"
  },
  {
    id: "153",
    code: "307",
    name: "EcoMobile"
  },
  {
    id: "1820",
    code: "050012",
    name: "Enco Finance"
  },
  {
    id: "169",
    code: "084",
    name: "Enterprise Bank"
  },
  {
    id: "143",
    code: "306",
    name: "eTranzact"
  },
  {
    id: "1818",
    code: "050009",
    name: "FAST CREDIT"
  },
  {
    id: "136",
    code: "309",
    name: "FBNMobile"
  },
  {
    id: "1824",
    code: "060002",
    name: "FBNQUEST Merchant Bank"
  },
  {
    id: "2287",
    code: "100031",
    name: "FCMB Easy Account"
  },
  {
    id: "2258",
    code: "100001",
    name: "FET"
  },
  {
    id: "1811",
    code: "050002",
    name: "Fewchore Finance Company Limited"
  },
  {
    id: "144",
    code: "070",
    name: "Fidelity Bank"
  },
  {
    id: "154",
    code: "318",
    name: "Fidelity Mobile"
  },
  {
    id: "2299",
    code: "110004",
    name: "First Apple Limited"
  },
  {
    id: "137",
    code: "011",
    name: "First Bank of Nigeria"
  },
  {
    id: "186",
    code: "214",
    name: "First City Monument Bank"
  },
  {
    id: "2297",
    code: "110002",
    name: "Flutterwave Technology Solutions Limited"
  },
  {
    id: "134",
    code: "308",
    name: "FortisMobile"
  },
  {
    id: "184",
    code: "601",
    name: "FSDH"
  },
  {
    id: "1819",
    code: "050010",
    name: "FUNDQUEST FINANCIAL SERVICES LTD"
  },
  {
    id: "1731",
    code: "103",
    name: "Globus Bank"
  },
  {
    id: "2278",
    code: "100022",
    name: "GoMoney"
  },
  {
    id: "1826",
    code: "060004",
    name: "Greenwich Merchant Bank"
  },
  {
    id: "177",
    code: "058",
    name: "GTBank Plc"
  },
  {
    id: "189",
    code: "315",
    name: "GTMobile"
  },
  {
    id: "149",
    code: "324",
    name: "Hedonmark"
  },
  {
    id: "175",
    code: "030",
    name: "Heritage"
  },
  {
    id: "2325",
    code: "120002",
    name: "Hopepsb"
  },
  {
    id: "2285",
    code: "100029",
    name: "Innovectives Kesh"
  },
  {
    id: "2283",
    code: "100027",
    name: "Intellifin"
  },
  {
    id: "2305",
    code: "110010",
    name: "Interswitch Financial Inclusion Services (Ifis)"
  },
  {
    id: "2298",
    code: "110003",
    name: "Interswitch Limited"
  },
  {
    id: "151",
    code: "301",
    name: "JAIZ Bank"
  },
  {
    id: "2303",
    code: "110008",
    name: "Kadick Integration Limited"
  },
  {
    id: "2271",
    code: "100015",
    name: "Kegow"
  },
  {
    id: "2292",
    code: "100036",
    name: "Kegow(Chamsmobile)"
  },
  {
    id: "181",
    code: "082",
    name: "Keystone Bank"
  },
  {
    id: "2315",
    code: "110022",
    name: "Koraypay"
  },
  {
    id: "1835",
    code: "070012",
    name: "Lagos Building Investment Company"
  },
  {
    id: "2323",
    code: "110044",
    name: "Leadremit Limited"
  },
  {
    id: "1804",
    code: "000029",
    name: "Lotus Bank"
  },
  {
    id: "2291",
    code: "100035",
    name: "M36"
  },
  {
    id: "2312",
    code: "110018",
    name: "Microsystems Investment And Development Limited"
  },
  {
    id: "185",
    code: "313",
    name: "Mkudi"
  },
  {
    id: "2326",
    code: "120003",
    name: "Momo Psb"
  },
  {
    id: "2328",
    code: "120005",
    name: "Money Master Psb"
  },
  {
    id: "150",
    code: "325",
    name: "MoneyBox"
  },
  {
    id: "2318",
    code: "110025",
    name: "Netapps Technology Limited"
  },
  {
    id: "1856",
    code: "090108",
    name: "New Prudential Bank"
  },
  {
    id: "1813",
    code: "050004",
    name: "Newedge Finance Ltd"
  },
  {
    id: "2313",
    code: "110019",
    name: "Nibssussd Payments"
  },
  {
    id: "156",
    code: "999",
    name: "NIP Virtual Bank"
  },
  {
    id: "2321",
    code: "110028",
    name: "Nomba Financial Services Limited"
  },
  {
    id: "1825",
    code: "060003",
    name: "Nova Merchant Bank"
  },
  {
    id: "1830",
    code: "070007",
    name: "Omoluabi savings and loans"
  },
  {
    id: "2282",
    code: "100026",
    name: "One Finance"
  },
  {
    id: "2260",
    code: "100004",
    name: "Opay"
  },
  {
    id: "1809",
    code: "000036",
    name: "Optimus Bank"
  },
  {
    id: "182",
    code: "327",
    name: "Pagatech"
  },
  {
    id: "2289",
    code: "100033",
    name: "PALMPAY"
  },
  {
    id: "1805",
    code: "000030",
    name: "Parallex Bank"
  },
  {
    id: "2259",
    code: "100003",
    name: "Parkway-ReadyCash"
  },
  {
    id: "167",
    code: "526",
    name: "Parralex"
  },
  {
    id: "160",
    code: "329",
    name: "PayAttitude Online"
  },
  {
    id: "171",
    code: "305",
    name: "Paycom"
  },
  {
    id: "2301",
    code: "110006",
    name: "Paystack Payments Limited"
  },
  {
    id: "180",
    code: "076",
    name: "Polaris Bank"
  },
  {
    id: "1806",
    code: "000031",
    name: "PremiumTrust Bank"
  },
  {
    id: "2295",
    code: "101",
    name: "ProvidusBank PLC"
  },
  {
    id: "2308",
    code: "110013",
    name: "Qr Payments"
  },
  {
    id: "2330",
    code: "502",
    name: "Rand merchant Bank"
  },
  {
    id: "140",
    code: "311",
    name: "ReadyCash (Parkway)"
  },
  {
    id: "2317",
    code: "110024",
    name: "Resident Fintech Limited"
  },
  {
    id: "1812",
    code: "050003",
    name: "Sagegrey Finance Limited"
  },
  {
    id: "1808",
    code: "000034",
    name: "SIGNATURE BANK"
  },
  {
    id: "2327",
    code: "120004",
    name: "Smartcash Payment Service Bank"
  },
  {
    id: "2319",
    code: "110026",
    name: "Spay Business"
  },
  {
    id: "2263",
    code: "100007",
    name: "Stanbic IBTC @ease wallet"
  },
  {
    id: "158",
    code: "221",
    name: "Stanbic IBTC Bank"
  },
  {
    id: "133",
    code: "304",
    name: "Stanbic Mobile Money"
  },
  {
    id: "142",
    code: "068",
    name: "Standard Chartered Bank"
  },
  {
    id: "179",
    code: "232",
    name: "Sterling Bank"
  },
  {
    id: "138",
    code: "326",
    name: "Sterling Mobile"
  },
  {
    id: "172",
    code: "100",
    name: "SunTrust Bank"
  },
  {
    id: "135",
    code: "328",
    name: "TagPay"
  },
  {
    id: "1802",
    code: "000026",
    name: "Taj Bank Limited"
  },
  {
    id: "2302",
    code: "110007",
    name: "TeamApt"
  },
  {
    id: "155",
    code: "319",
    name: "TeasyMobile"
  },
  {
    id: "1816",
    code: "050007",
    name: "Tekla Finance Ltd"
  },
  {
    id: "1801",
    code: "000025",
    name: "Titan Trust Bank"
  },
  {
    id: "2293",
    code: "100039",
    name: "Titan-Paystack"
  },
  {
    id: "1822",
    code: "050014",
    name: "TRINITY FINANCIAL SERVICES LIMITED"
  },
  {
    id: "188",
    code: "523",
    name: "Trustbond"
  },
  {
    id: "178",
    code: "032",
    name: "Union Bank"
  },
  {
    id: "190",
    code: "033",
    name: "United Bank for Africa"
  },
  {
    id: "146",
    code: "215",
    name: "Unity Bank"
  },
  {
    id: "2310",
    code: "110015",
    name: "Vas2Nets Limited"
  },
  {
    id: "2304",
    code: "110009",
    name: "Venture Garden Nigeria Limited"
  },
  {
    id: "1857",
    code: "090110",
    name: "VFD Micro Finance Bank"
  },
  {
    id: "157",
    code: "320",
    name: "VTNetworks"
  },
  {
    id: "168",
    code: "035",
    name: "Wema Bank"
  },
  {
    id: "2322",
    code: "110029",
    name: "Woven Finance"
  },
  {
    id: "2320",
    code: "110027",
    name: "Yello Digital Financial Services"
  },
  {
    id: "141",
    code: "057",
    name: "Zenith Bank"
  },
  {
    id: "161",
    code: "322",
    name: "ZenithMobile"
  },
  {
    id: "2281",
    code: "100025",
    name: "Zinternet Nigera Limited"
  },
  {
    id: "2290",
    code: "100034",
    name: "Zwallet"
  }
];
