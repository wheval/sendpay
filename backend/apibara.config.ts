import { defineConfig } from "apibara/config";

const resolveStreamUrl = (fallbackPublicUrl: string, overrideEnv?: string) => {
  // If explicit override is provided, use it
  if (overrideEnv) return overrideEnv;
  // If DNA token and DNA URL are provided, prefer DNA endpoint
  if (process.env.DNA_TOKEN && process.env.APIBARA_STREAM_URL) {
    return process.env.APIBARA_STREAM_URL;
  }
  // Otherwise, use public RPC stream
  return fallbackPublicUrl;
};

export default defineConfig({
  runtimeConfig: {
    sendpay: {
      streamUrl: resolveStreamUrl(
        "https://mainnet.starknet.a5a.ch",
        process.env.APIBARA_STREAM_URL_MAINNET || process.env.APIBARA_STREAM_URL
      ),
      startingBlock: Number(process.env.STARTING_BLOCK || 0),
      contractAddress: (process.env.SENDPAY_CONTRACT_ADDRESS || "0x0") as `0x${string}`,
    },
  },
  presets: {
    sepolia: {
      runtimeConfig: {
        sendpay: {
          streamUrl: resolveStreamUrl(
            "https://sepolia.starknet.a5a.ch",
            process.env.APIBARA_STREAM_URL_SEPOLIA
          ),
          startingBlock: Number(
            process.env.STARTING_BLOCK_SEPOLIA || process.env.STARTING_BLOCK || 0
          ),
          contractAddress: (process.env.SENDPAY_CONTRACT_ADDRESS_SEPOLIA || process.env.SENDPAY_CONTRACT_ADDRESS || "0x0") as `0x${string}`,
        },
      },
    },
    mainnet: {
      runtimeConfig: {
        sendpay: {
          streamUrl: resolveStreamUrl(
            "https://mainnet.starknet.a5a.ch",
            process.env.APIBARA_STREAM_URL_MAINNET || process.env.APIBARA_STREAM_URL
          ),
          startingBlock: Number(
            process.env.STARTING_BLOCK_MAINNET || process.env.STARTING_BLOCK || 0
          ),
          contractAddress: (process.env.SENDPAY_CONTRACT_ADDRESS_MAINNET || process.env.SENDPAY_CONTRACT_ADDRESS || "0x0") as `0x${string}`,
        },
      },
    },
  },
});
