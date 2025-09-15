import { defineIndexer } from "apibara/indexer";
import { StarknetStream, getSelector } from "@apibara/starknet";
import type { ApibaraRuntimeConfig } from "apibara/types";
import { useLogger } from "apibara/plugins";
import mongoose from "mongoose";
import { WatcherState } from "../src/models/WatcherState";
import { ProcessedEvent } from "../src/models/ProcessedEvent";
import { Transaction } from "../src/models/Transaction";

// Event selectors from SendPay ABI
const EVENT_SELECTORS = {
  WithdrawalProcessed: getSelector("WithdrawalProcessed"),
  BatchWithdrawalProcessed: getSelector("BatchWithdrawalProcessed"),
  TokenApprovalUpdated: getSelector("TokenApprovalUpdated"),
  EmergencyPaused: getSelector("EmergencyPaused"),
  EmergencyResumed: getSelector("EmergencyResumed"),
};

function toHex(value: string | number | bigint): `0x${string}` {
  const n = BigInt(value);
  return ("0x" + n.toString(16)) as `0x${string}`;
}

function readU256(data: (string | number)[], start: number): bigint {
  const low = BigInt(data[start] as any);
  const high = BigInt(data[start + 1] as any);
  return low + (high << 128n);
}

export default function (runtimeConfig: ApibaraRuntimeConfig) {
  const { streamUrl, startingBlock, contractAddress } = (runtimeConfig as any).sendpay as {
    streamUrl: string;
    startingBlock: number;
    contractAddress: `0x${string}`;
  };

  // Ensure Mongo connection (re-use existing if present)
  if (mongoose.connection.readyState === 0) {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/sendpay";
    mongoose.set("strictQuery", true);
    mongoose.connect(mongoUri).catch((err) => {
      console.error("[sendpay.indexer] MongoDB connection error:", err);
    });
  }

  return defineIndexer(StarknetStream)({
    streamUrl,
    finality: "accepted",
    startingBlock: BigInt(startingBlock),
    filter: {
      events: [
        {
          address: contractAddress as `0x${string}`,
          // We can filter by specific keys if needed, else capture all
        },
      ],
    },
    async transform({ block, endCursor }) {
      const logger = useLogger();

      // Save watcher state for resume capability
      await WatcherState.findOneAndUpdate(
        { key: "sendpay-indexer" },
        { lastProcessedBlock: Number(block.header.blockNumber), updatedAt: new Date() },
        { upsert: true }
      );

      for (const event of block.events) {
        const selector = event.keys[0];
        const txHash = event.transactionHash;
        const logIndex = event.eventIndex;

        // de-duplication
        try {
          await ProcessedEvent.create({ txHash, logIndex, processedAt: new Date() });
        } catch (e) {
          // Duplicate event; skip
          continue;
        }

        if (selector === EVENT_SELECTORS.WithdrawalProcessed) {
          // Data layout (flattened):
          // withdrawal_id.low, withdrawal_id.high,
          // user,
          // amount.low, amount.high,
          // token_address,
          // bank_account, bank_name, account_name,
          // timestamp, block_number,
          // status
          const withdrawalId = readU256(event.data as any, 0);
          const user = toHex(event.data[2] as any);
          const amount = readU256(event.data as any, 3);
          const tokenAddress = toHex(event.data[5] as any);
          const bankAccount = event.data[6];
          const bankName = event.data[7];
          const accountName = event.data[8];
          const timestamp = Number(event.data[9]);
          const blockNumber = Number(event.data[10]);
          const status = event.data[11];

          await Transaction.findOneAndUpdate(
            { starknetTxHash: txHash },
            {
              status: "completed",
              starknetTxHash: txHash,
              $setOnInsert: {
                description: "Withdrawal processed",
                type: "withdrawn",
                amountUSD: 0,
                amountNGN: 0,
                userId: undefined,
              },
              metadata: {
                event: "WithdrawalProcessed",
                withdrawalId: withdrawalId.toString(),
                user,
                amount: amount.toString(),
                tokenAddress,
                bankAccount,
                bankName,
                accountName,
                timestamp,
                blockNumber,
                status,
              },
            },
            { upsert: true }
          );
        } else if (selector === EVENT_SELECTORS.BatchWithdrawalProcessed) {
          const batchId = readU256(event.data as any, 0).toString();
          const totalWithdrawals = readU256(event.data as any, 2).toString();
          const totalAmount = readU256(event.data as any, 4).toString();
          const timestamp = Number(event.data[6]);

          await ProcessedEvent.updateOne(
            { txHash, logIndex },
            { $set: { withdrawalId: batchId } }
          );
        } else if (selector === EVENT_SELECTORS.TokenApprovalUpdated) {
          // Optional: store as processed event metadata
          await ProcessedEvent.updateOne(
            { txHash, logIndex },
            { $set: { processedAt: new Date() } }
          );
        }
      }
    },
  });
}


