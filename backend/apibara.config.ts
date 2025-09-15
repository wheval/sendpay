import { defineConfig } from "apibara/config";

export default defineConfig({
  runtimeConfig: {
    sendpay: {
      streamUrl:
        process.env.APIBARA_STREAM_URL ||
        "https://mainnet.starknet.a5a.ch",
      startingBlock: Number(process.env.STARTING_BLOCK || 0),
      contractAddress: (process.env.SENDPAY_CONTRACT_ADDRESS || "0x0") as `0x${string}`,
    },
  },
  presets: {
    sepolia: {
      runtimeConfig: {
        sendpay: {
          streamUrl:
            process.env.APIBARA_STREAM_URL_SEPOLIA ||
            "https://sepolia.starknet.a5a.ch",
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
          streamUrl:
            process.env.APIBARA_STREAM_URL_MAINNET ||
            process.env.APIBARA_STREAM_URL ||
            "https://mainnet.starknet.a5a.ch",
          startingBlock: Number(
            process.env.STARTING_BLOCK_MAINNET || process.env.STARTING_BLOCK || 0
          ),
          contractAddress: (process.env.SENDPAY_CONTRACT_ADDRESS_MAINNET || process.env.SENDPAY_CONTRACT_ADDRESS || "0x0") as `0x${string}`,
        },
      },
    },
  },
});
