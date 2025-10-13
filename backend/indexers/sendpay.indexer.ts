import { defineIndexer } from "apibara/indexer";
import { StarknetStream, getSelector } from "@apibara/starknet";
import type { ApibaraRuntimeConfig } from "apibara/types";
import { useLogger } from "apibara/plugins";
import mongoose from "mongoose";
import { WatcherState } from "../src/models/WatcherState";
import { ProcessedEvent } from "../src/models/ProcessedEvent";
import { Transaction } from "../src/models/Transaction";
import { BankAccount } from "../src/models/BankAccount";
import { flutterwaveService } from "../src/services/flutterwave.service";
import { exchangeRateService } from "../src/services/exchange-rate.service";

// Event selectors from SendPay ABI (using the correct event names from deployed contract)
const EVENT_SELECTORS = {
  WithdrawalCreated: getSelector("WithdrawalCreated"),
  WithdrawalCompleted: getSelector("WithdrawalCompleted"),
  WithdrawalFailed: getSelector("WithdrawalFailed"),
  DepositCompleted: getSelector("DepositCompleted"),
  EmergencyPaused: getSelector("EmergencyPaused"),
  EmergencyResumed: getSelector("EmergencyResumed"),
  RoleChanged: getSelector("RoleChanged"),
  PayoutToTreasury: getSelector("PayoutToTreasury"),
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

        // de-duplication and event data storage
        let eventType = "Unknown";
        let eventData: any = {};

        // Determine event type and parse data based on actual ABI structure
        if (selector === EVENT_SELECTORS.WithdrawalCreated) {
          eventType = "WithdrawalCreated";
          // Data structure from ABI: withdrawal_id, user, amount, token_address, tx_ref, timestamp, block_number
          const withdrawalId = readU256(event.data as any, 0);
          const user = toHex(event.data[2] as any);
          const amount = readU256(event.data as any, 3);
          const tokenAddress = toHex(event.data[5] as any);
          const txRef = event.data[6] as string;
          const timestamp = Number(event.data[7]);
          const blockNumber = Number(event.data[8]);

          eventData = {
            withdrawalId: withdrawalId.toString(),
            user,
            amount: amount.toString(),
            tokenAddress,
            txRef,
            timestamp,
            blockNumber
          };
        } else if (selector === EVENT_SELECTORS.WithdrawalCompleted) {
          eventType = "WithdrawalCompleted";
          // Data structure from ABI: withdrawal_id, user, amount, token_address, tx_ref, timestamp, block_number
          const withdrawalId = readU256(event.data as any, 0);
          const user = toHex(event.data[2] as any);
          const amount = readU256(event.data as any, 3);
          const tokenAddress = toHex(event.data[5] as any);
          const txRef = event.data[6] as string;
          const timestamp = Number(event.data[7]);
          const blockNumber = Number(event.data[8]);

          eventData = {
            withdrawalId: withdrawalId.toString(),
            user,
            amount: amount.toString(),
            tokenAddress,
            txRef,
            timestamp,
            blockNumber
          };
        } else if (selector === EVENT_SELECTORS.WithdrawalFailed) {
          eventType = "WithdrawalFailed";
          // Data structure from ABI: withdrawal_id, user, amount, token_address, tx_ref, timestamp, block_number
          const withdrawalId = readU256(event.data as any, 0);
          const user = toHex(event.data[2] as any);
          const amount = readU256(event.data as any, 3);
          const tokenAddress = toHex(event.data[5] as any);
          const txRef = event.data[6] as string;
          const timestamp = Number(event.data[7]);
          const blockNumber = Number(event.data[8]);

          eventData = {
            withdrawalId: withdrawalId.toString(),
            user,
            amount: amount.toString(),
            tokenAddress,
            txRef,
            timestamp,
            blockNumber
          };
        } else if (selector === EVENT_SELECTORS.DepositCompleted) {
          eventType = "DepositCompleted";
          // Data structure from ABI: user, amount, token_address, fiat_tx_ref, timestamp
          const user = toHex(event.data[0] as any);
          const amount = readU256(event.data as any, 1);
          const tokenAddress = toHex(event.data[3] as any);
          const fiatTxRef = event.data[4] as string;
          const timestamp = Number(event.data[5]);

          eventData = {
            user,
            amount: amount.toString(),
            tokenAddress,
            fiatTxRef,
            timestamp
          };
        } else if (selector === EVENT_SELECTORS.EmergencyPaused) {
          eventType = "EmergencyPaused";
          // Data structure from ABI: reason, timestamp
          const reason = event.data[0] as string;
          const timestamp = Number(event.data[1]);

          eventData = {
            reason,
            timestamp
          };
        } else if (selector === EVENT_SELECTORS.EmergencyResumed) {
          eventType = "EmergencyResumed";
          // Data structure from ABI: timestamp
          const timestamp = Number(event.data[0]);

          eventData = {
            timestamp
          };
        } else if (selector === EVENT_SELECTORS.RoleChanged) {
          eventType = "RoleChanged";
          // Data structure from ABI: role, old_admin, new_admin, timestamp
          const role = event.data[0] as string;
          const oldAdmin = toHex(event.data[1] as any);
          const newAdmin = toHex(event.data[2] as any);
          const timestamp = Number(event.data[3]);

          eventData = {
            role,
            oldAdmin,
            newAdmin,
            timestamp
          };
        } else if (selector === EVENT_SELECTORS.PayoutToTreasury) {
          eventType = "PayoutToTreasury";
          // Data structure from ABI: withdrawal_id, treasury_address, amount, token_address, timestamp
          const withdrawalId = readU256(event.data as any, 0);
          const treasuryAddress = toHex(event.data[2] as any);
          const amount = readU256(event.data as any, 3);
          const tokenAddress = toHex(event.data[5] as any);
          const timestamp = Number(event.data[6]);

          eventData = {
            withdrawalId: withdrawalId.toString(),
            treasuryAddress,
            amount: amount.toString(),
            tokenAddress,
            timestamp
          };
        }

        try {
          await ProcessedEvent.create({ 
            txHash, 
            logIndex, 
            eventType,
            eventData,
            processedAt: new Date() 
          });
        } catch (e) {
          // Duplicate event; skip
          continue;
        }

        if (selector === EVENT_SELECTORS.WithdrawalCreated) {
          // Use already parsed data from eventData
          const { withdrawalId, user, amount, tokenAddress, txRef } = eventData;

          // Find the pending transaction created by our backend signature step using tx_ref
          const pendingTx = await Transaction.findOne({ "metadata.txRef": txRef });
          if (pendingTx) {
            // Save linkage and mark as fiat_processing
            pendingTx.status = "pending";
            pendingTx.metadata = {
              ...pendingTx.metadata,
              withdrawalId: withdrawalId,
              user,
              amount: amount,
              tokenAddress,
              onchainTxHash: txHash,
            } as any;
            await pendingTx.save();

            try {
              // Load bank details from stored bankAccountId (server-side PII only)
              const bankAccountId = (pendingTx.metadata as any)?.bankAccountId;
              if (bankAccountId) {
                const bank = await BankAccount.findById(bankAccountId);
                if (bank) {
                  // Convert amount (assumes amount is USDC with 6 decimals)
                  const usdAmount = Number(amount) / 1e6;
                  const ngnAmount = await exchangeRateService.convertUSDToNGN(usdAmount);
                  const reference = `wd_${withdrawalId}`;

                  const transfer = await flutterwaveService.initiatePayout({
                    bankCode: bank.bankCode,
                    accountNumber: bank.accountNumber,
                    amount: ngnAmount,
                    narration: `SendPay withdrawal ${reference}`,
                    reference,
                    beneficiaryName: bank.accountName || "Beneficiary",
                  });

                  await Transaction.findByIdAndUpdate(pendingTx._id, {
                    $set: {
                      status: "pending",
                      metadata: {
                        ...(pendingTx.metadata as any),
                        flutterwave_reference: transfer?.data?.reference || reference,
                        flutterwave_transfer_id: transfer?.data?.id || null,
                      },
                    },
                  });
                }
              }
            } catch (err) {
              useLogger().error("[sendpay.indexer] Payout initiation failed", err);
            }
          }

        } else if (selector === EVENT_SELECTORS.WithdrawalCompleted) {
          const { withdrawalId } = eventData;
          await Transaction.updateMany(
            { "metadata.withdrawalId": withdrawalId },
            {
              $set: {
                status: "completed",
                metadata: { updatedAt: new Date(), event: "WithdrawalCompleted" },
              },
            }
          );

        } else if (selector === EVENT_SELECTORS.WithdrawalFailed) {
          const { withdrawalId } = eventData;
          await Transaction.updateMany(
            { "metadata.withdrawalId": withdrawalId },
            {
              $set: {
                status: "failed",
                metadata: { updatedAt: new Date(), event: "WithdrawalFailed" },
              },
            }
          );

        } else if (selector === EVENT_SELECTORS.DepositCompleted) {
          // Handle on-ramp completion
          const { user, amount, tokenAddress, fiatTxRef } = eventData;
          
          await Transaction.findOneAndUpdate(
            { "metadata.fiatTxRef": fiatTxRef },
            {
              status: "completed",
              starknetTxHash: txHash,
              $setOnInsert: {
                description: "Deposit completed",
                type: "deposited",
                amountUSD: Number(amount) / 1e6, // Convert from wei
                amountNGN: 0,
                userId: undefined,
              },
              metadata: {
                event: "DepositCompleted",
                user,
                amount: amount,
                tokenAddress,
                fiatTxRef,
                onchainTxHash: txHash,
              },
            },
            { upsert: true }
          );

        } else if (selector === EVENT_SELECTORS.PayoutToTreasury) {
          // Handle treasury payouts (failed withdrawal recoveries)
          const { withdrawalId, treasuryAddress, amount, tokenAddress } = eventData;
          
          await Transaction.findOneAndUpdate(
            { "metadata.withdrawalId": withdrawalId },
            {
              $set: {
                status: "treasury_payout",
                metadata: { 
                  ...eventData,
                  treasuryAddress,
                  event: "PayoutToTreasury" 
                },
              },
            }
          );

        } else if (selector === EVENT_SELECTORS.EmergencyPaused) {
          // Log emergency pause
          useLogger().warn("[sendpay.indexer] Contract emergency paused", eventData);

        } else if (selector === EVENT_SELECTORS.EmergencyResumed) {
          // Log emergency resume
          useLogger().info("[sendpay.indexer] Contract emergency resumed", eventData);

        } else if (selector === EVENT_SELECTORS.RoleChanged) {
          // Log role changes
          useLogger().info("[sendpay.indexer] Role changed", eventData);
        }
      }
    },
  });
}


