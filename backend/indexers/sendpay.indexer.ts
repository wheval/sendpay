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
import axios from "axios";
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
  // OpenZeppelin AccessControl events (sometimes emitted by upgrades/roles)
  RoleGranted: getSelector("RoleGranted"),
  RoleGrantedWithDelay: getSelector("RoleGrantedWithDelay"),
  RoleRevoked: getSelector("RoleRevoked"),
  RoleAdminChanged: getSelector("RoleAdminChanged"),
  AccessControlEvent: getSelector("Event"),
  SENDPAY_Event: getSelector("Event"),
};

// Normalize to lowercase for robust comparisons
const EVENT_SELECTORS_LC = Object.fromEntries(
  Object.entries(EVENT_SELECTORS).map(([k, v]) => [k, String(v).toLowerCase()])
) as Record<keyof typeof EVENT_SELECTORS, string>;

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
  const { streamUrl, startingBlock, contractAddress } = (runtimeConfig as any)
    .sendpay as {
    streamUrl: string;
    startingBlock: number;
    contractAddress: `0x${string}`;
  };

  // Ensure Mongo connection (re-use existing if present)
  if (mongoose.connection.readyState === 0) {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/sendpay";
    mongoose.set("strictQuery", true);
    mongoose.connect(mongoUri).catch((err) => {
      console.error("[sendpay.indexer] MongoDB connection error:", err);
    });
  }

  // Optional startup reconciliation to (re)attempt stuck payouts
  async function reconcilePendingWithdrawals() {
    const enabled = String(process.env.RECONCILE_ON_START || "false").toLowerCase() === "true";
    if (!enabled) {
      console.log("[sendpay.indexer] Startup reconciliation disabled. Set RECONCILE_ON_START=true to enable.");
      return;
    }

    try {
      console.log("[sendpay.indexer] Running startup reconciliation for pending/stuck withdrawals...");
      const candidates = await Transaction.find({
        flow: "offramp",
        status: { $in: ["submitted_onchain", "payout_pending", "payout_failed"] },
        "metadata.withdrawalId": { $exists: true },
      }).sort({ createdAt: -1 }).limit(50);

      console.log(`[sendpay.indexer] Found ${candidates.length} candidates to reconcile`);

      for (const tx of candidates) {
        try {
          const withdrawalId = (tx as any)?.metadata?.withdrawalId;
          const bankAccountId = (tx as any)?.metadata?.bankAccountId;
          if (!withdrawalId || !bankAccountId) {
            console.warn("[sendpay.indexer] Skipping tx with missing withdrawalId/bankAccountId", String((tx as any)._id));
            continue;
          }

          const bank = await BankAccount.findById(bankAccountId);
          if (!bank) {
            console.warn("[sendpay.indexer] Skipping tx; bank account not found", bankAccountId);
            continue;
          }

          // Convert amount from stored USD using locked rate if present
          const usdAmount = Number((tx as any)?.amountUSD || 0);
          const lockedRate = (tx as any)?.metadata?.lockedExchangeRate;
          const ngnAmount = typeof lockedRate === "number" && lockedRate > 0
            ? Math.round(usdAmount * lockedRate)
            : await exchangeRateService.convertUSDToNGN(usdAmount);

          if (!Number.isFinite(ngnAmount) || ngnAmount < 100) {
            console.warn(`[sendpay.indexer] Skipping withdrawal ${withdrawalId} - NGN amount invalid or below minimum: ₦${ngnAmount}`);
            continue;
          }

          // Generate deterministic idempotent reference per attempt
          const reference = `sendpay${withdrawalId}${Date.now()}`.replace(/[^a-zA-Z0-9]/g, "");

          console.log(`[sendpay.indexer] Re-initiating payout`, {
            withdrawalId,
            bank: `${bank.bankName} (${bank.bankCode})`,
            account: bank.accountNumber,
            ngnAmount,
            reference,
          });

          const transfer = await flutterwaveService.createDirectTransfer({
            bankCode: bank.bankCode,
            accountNumber: bank.accountNumber,
            amountNGN: ngnAmount,
            reference,
            narration: `SendPay withdrawal ${withdrawalId}`,
            callback_url: process.env.FLUTTERWAVE_CALLBACK_URL || undefined,
            idempotencyKey: reference,
          });

          await Transaction.findByIdAndUpdate(tx._id, {
            $set: {
              status: "payout_pending",
              metadata: {
                ...(tx as any).metadata,
                flutterwave_reference: transfer?.data?.reference || reference,
                flutterwave_transfer_id: transfer?.data?.id || null,
                ngnAmount,
                usdAmount,
                payoutInitiatedAt: new Date(),
                reconciledAtStartup: true,
              },
            },
          });

          console.log(`[sendpay.indexer] Startup payout re-init success for withdrawal ${withdrawalId}`);
        } catch (err: any) {
          console.error("[sendpay.indexer] Startup payout re-init failed", {
            error: err?.response?.data || err?.message || String(err),
          });
          // Soft-fail; do not throw to keep iterating other candidates
        }
      }
    } catch (e) {
      console.error("[sendpay.indexer] Reconciliation fatal error:", e);
    }
  }

  // Fire and forget; controlled via env flag
  void reconcilePendingWithdrawals();

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
        {
          lastProcessedBlock: Number(block.header.blockNumber),
          updatedAt: new Date(),
        },
        { upsert: true }
      );

      for (const event of block.events) {
        // Use the last key as the selector; some streams append the selector at the end
        const selector = event.keys[event.keys.length - 1]; //selctor is suppose to en the first sha but this works
        const txHash = event.transactionHash;
        const logIndex = event.eventIndex;

        // de-duplication and event data storage
        let eventType = "Unknown";
        let eventData: any = {};

        // Determine event type and parse data based on actual ABI structure
        const selectorLc = String(selector).toLowerCase();

        if (selectorLc === EVENT_SELECTORS_LC.WithdrawalCreated) {
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
            blockNumber,
          };
        } else if (selectorLc === EVENT_SELECTORS_LC.WithdrawalCompleted) {
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
            blockNumber,
          };
        } else if (selectorLc === EVENT_SELECTORS_LC.WithdrawalFailed) {
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
            blockNumber,
          };
        } else if (selectorLc === EVENT_SELECTORS_LC.DepositCompleted) {
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
            timestamp,
          };
        } else if (selectorLc === EVENT_SELECTORS_LC.EmergencyPaused) {
          eventType = "EmergencyPaused";
          // Data structure from ABI: reason, timestamp
          const reason = event.data[0] as string;
          const timestamp = Number(event.data[1]);

          eventData = {
            reason,
            timestamp,
          };
        } else if (selectorLc === EVENT_SELECTORS_LC.EmergencyResumed) {
          eventType = "EmergencyResumed";
          // Data structure from ABI: timestamp
          const timestamp = Number(event.data[0]);

          eventData = {
            timestamp,
          };
        } else if (selectorLc === EVENT_SELECTORS_LC.RoleChanged) {
          eventType = "RoleChanged";
          // Data: (role, account, sender)
          const role = event.data[0] as string;
          const account = toHex(event.data[1] as any);
          const sender = toHex((event.data[2] ?? event.data[1]) as any);
          const timestamp = Number(event.data[3] ?? 0);
          eventData = { role, account, sender, timestamp };
        } else if (
          selectorLc === String(EVENT_SELECTORS.RoleGranted).toLowerCase()
        ) {
          eventType = "RoleGranted";
          // Data: (role, account, sender)
          const role = event.data[0] as string;
          const account = toHex(event.data[1] as any);
          const sender = toHex((event.data[2] ?? event.data[1]) as any);
          const timestamp = Number(event.data[3] ?? 0);
          eventData = { role, account, sender, timestamp };
        } else if (
          selectorLc === String(EVENT_SELECTORS.RoleRevoked).toLowerCase()
        ) {
          eventType = "RoleRevoked";
          // Data: (role, account, sender)
          const role = event.data[0] as string;
          const account = toHex(event.data[1] as any);
          const sender = toHex((event.data[2] ?? event.data[1]) as any);
          const timestamp = Number(event.data[3] ?? 0);
          eventData = { role, account, sender, timestamp };
        } else if (
          selectorLc === String(EVENT_SELECTORS.RoleAdminChanged).toLowerCase()
        ) {
          eventType = "RoleAdminChanged";
          // Data: (role, account, sender)
          const role = event.data[0] as string;
          const account = toHex(event.data[1] as any);
          const sender = toHex((event.data[2] ?? event.data[1]) as any);
          const timestamp = Number(event.data[3] ?? 0);
          eventData = { role, account, sender, timestamp };
        } else if (
          selectorLc ===
            String(EVENT_SELECTORS.AccessControlEvent).toLowerCase() ||
          selectorLc === String(EVENT_SELECTORS.SENDPAY_Event).toLowerCase()
        ) {
          eventType = "Unknown";
        } else if (selectorLc === EVENT_SELECTORS_LC.PayoutToTreasury) {
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
            timestamp,
          };
        }

        // Log the classified event type and parsed data (trimmed) for local debugging
        try {
          useLogger().info("[sendpay.indexer] classified event", {
            eventType,
            txHash,
            logIndex,
            parsedKeys: Object.keys(eventData || {}),
            dataLen: Array.isArray(event.data) ? event.data.length : 0,
          });
        } catch {}

        try {
          await ProcessedEvent.create({
            txHash,
            logIndex,
            eventType,
            eventData,
            processedAt: new Date(),
          });
        } catch (e) {
          // Duplicate event; skip
          continue;
        }

        if (selector === EVENT_SELECTORS.WithdrawalCreated) {
          // Use already parsed data from eventData
          const { withdrawalId, user, amount, tokenAddress, txRef } = eventData;

          useLogger().info(`[sendpay.indexer] Processing WithdrawalCreated event:`, {
            withdrawalId,
            user,
            amount,
            tokenAddress,
            txRef,
            txHash
          });

          // Find the pending transaction created by our backend signature step using tx_ref
          // Handle potential txRef format differences (with/without leading zeros)
          let pendingTx = await Transaction.findOne({
            "metadata.txRef": txRef,
          });
          
          // If not found, try with normalized txRef (remove leading zeros)
          if (!pendingTx && txRef.startsWith('0x')) {
            const normalizedTxRef = txRef.replace(/^0x0+/, '0x');
            if (normalizedTxRef !== txRef) {
              pendingTx = await Transaction.findOne({
                "metadata.txRef": normalizedTxRef,
              });
              if (pendingTx) {
                useLogger().info(`[sendpay.indexer] Found transaction with normalized txRef: ${normalizedTxRef}`);
              }
            }
          }
          
          // If still not found, try with padded txRef (add leading zero if needed)
          if (!pendingTx && txRef.startsWith('0x')) {
            const paddedTxRef = txRef.replace(/^0x/, '0x0');
            if (paddedTxRef !== txRef) {
              pendingTx = await Transaction.findOne({
                "metadata.txRef": paddedTxRef,
              });
              if (pendingTx) {
                useLogger().info(`[sendpay.indexer] Found transaction with padded txRef: ${paddedTxRef}`);
              }
            }
          }
          
          if (pendingTx) {
            useLogger().info(`[sendpay.indexer] Found pending transaction for txRef: ${txRef}`, {
              transactionId: pendingTx._id,
              currentStatus: pendingTx.status,
              bankAccountId: (pendingTx.metadata as any)?.bankAccountId
            });
            // Save linkage and mark as payout pending
            pendingTx.status = "payout_pending";
            pendingTx.metadata = {
              ...pendingTx.metadata,
              withdrawalId: withdrawalId,
              user,
              amountInDecimal: amount,
              tokenAddress,
              onchainTxHash: txHash,
            } as any;
            await pendingTx.save();

            try {
              // Load bank details from stored bankAccountId (server-side PII only)
              const bankAccountId = (pendingTx.metadata as any)?.bankAccountId;
              
              // Validate bankAccountId exists
              if (!bankAccountId) {
                useLogger().error('[sendpay.indexer] Missing bankAccountId for txRef:', txRef);
                return;
              }

              const bank = await BankAccount.findById(bankAccountId);
              if (!bank) {
                useLogger().error('[sendpay.indexer] Bank account not found for ID:', bankAccountId);
                return;
              }

              // Convert amount (USDC with 6 decimals) using locked FX if available
              const usdAmount = Number(amount) / 1e6;
              const lockedRate = (pendingTx.metadata as any)?.lockedExchangeRate;
              const ngnAmount = typeof lockedRate === 'number' && lockedRate > 0
                ? Math.round(usdAmount * lockedRate)
                : await exchangeRateService.convertUSDToNGN(usdAmount);

              // Ensure NGN amount meets Flutterwave minimum
              if (ngnAmount < 100) {
                useLogger().error(`[sendpay.indexer] NGN amount ${ngnAmount} below Flutterwave minimum of ₦100`);
                // Mark transaction as failed due to amount too low
                await Transaction.findByIdAndUpdate(pendingTx._id, {
                  $set: {
                    status: "payout_failed",
                    metadata: {
                      ...(pendingTx.metadata as any),
                      error: "Amount below Flutterwave minimum (₦100)",
                      ngnAmount,
                      usdAmount,
                    },
                  },
                });
                return;
              }

              // Create alphanumeric reference for Flutterwave V4
              const alphanumericRef = `sendpay${withdrawalId}${Date.now()}`.replace(/[^a-zA-Z0-9]/g, '');

              // Log outbound IP from indexer host just before payout
              try {
                const ip = await axios.get("https://api.ipify.org", { timeout: 4000 }).then(r => r.data).catch(() => undefined);
                if (ip) useLogger().info("[sendpay.indexer] Outbound Source IP (indexer):", { ip, withdrawalId });
              } catch {}

              const transfer =
                await flutterwaveService.createDirectTransfer({
                  bankCode: bank.bankCode,
                  accountNumber: bank.accountNumber,
                  amountNGN: ngnAmount,
                  reference: alphanumericRef,
                  narration: `SendPay withdrawal ${withdrawalId}`,
                  callback_url:
                    process.env.FLUTTERWAVE_CALLBACK_URL || undefined,
                  idempotencyKey: alphanumericRef,
                });

              await Transaction.findByIdAndUpdate(pendingTx._id, {
                $set: {
                  status: "payout_pending",
                  metadata: {
                    ...(pendingTx.metadata as any),
                    flutterwave_reference:
                      transfer?.data?.reference || alphanumericRef,
                    flutterwave_transfer_id: transfer?.data?.id || null,
                    ngnAmount,
                    usdAmount,
                    payoutInitiatedAt: new Date(),
                  },
                },
              });

              useLogger().info(`[sendpay.indexer] Payout initiated for withdrawal ${withdrawalId}: ₦${ngnAmount}`);
            } catch (err) {
              useLogger().error(
                "[sendpay.indexer] Payout initiation failed",
                err
              );
              
              // Log detailed error information
              if (err.response?.data) {
                useLogger().error("[sendpay.indexer] Flutterwave error details:", err.response.data);
              }
              
              // Mark transaction as failed if payout initiation fails
              await Transaction.findByIdAndUpdate(pendingTx._id, {
                $set: {
                  status: "payout_failed",
                  metadata: {
                    ...(pendingTx.metadata as any),
                    error: "Payout initiation failed",
                    errorDetails: err instanceof Error ? err.message : String(err),
                    flutterwaveError: err.response?.data || null,
                    payoutFailedAt: new Date(),
                  },
                },
              });
            }
          } else {
            useLogger().error(`[sendpay.indexer] No pending transaction found for txRef: ${txRef}`, {
              withdrawalId,
              user,
              amount,
              tokenAddress,
              txRef,
              txHash
            });
          }
        } else if (selector === EVENT_SELECTORS.WithdrawalCompleted) {
          const { withdrawalId } = eventData;
          
          // Mark as onchain_completed - contract has confirmed the withdrawal
          await Transaction.updateMany(
            { 
              "metadata.withdrawalId": withdrawalId,
              // Only update if payout was completed (webhook should have run first)
              status: "payout_completed"
            },
            {
              $set: {
                status: "onchain_completed",
                metadata: {
                  updatedAt: new Date(),
                  event: "WithdrawalCompleted",
                  onchainCompletedBy: "indexer",
                  onchainCompletedAt: new Date(),
                },
              },
            }
          );
          
          useLogger().info(`[sendpay.indexer] WithdrawalCompleted event processed for withdrawal ${withdrawalId} - marked as onchain_completed`);
        } else if (selector === EVENT_SELECTORS.WithdrawalFailed) {
          const { withdrawalId } = eventData;
          
          // Update transactions but avoid race conditions with webhook
          await Transaction.updateMany(
            { 
              "metadata.withdrawalId": withdrawalId,
              // Only update if not already failed by webhook
              status: { $nin: ["payout_failed", "payout_completed"] }
            },
            {
              $set: {
                status: "payout_failed",
                metadata: { 
                  updatedAt: new Date(), 
                  event: "WithdrawalFailed",
                  failedBy: "indexer",
                },
              },
            }
          );
          
          useLogger().info(`[sendpay.indexer] WithdrawalFailed event processed for withdrawal ${withdrawalId}`);
        } else if (selector === EVENT_SELECTORS.DepositCompleted) {
          // Handle on-ramp completion
          const { user, amount, tokenAddress, fiatTxRef } = eventData;

          await Transaction.findOneAndUpdate(
            { "metadata.fiatTxRef": fiatTxRef },
            {
              status: "credited",
              starknetTxHash: txHash,
              $setOnInsert: {
                description: "Deposit completed",
                flow: "onramp",
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
          const { withdrawalId, treasuryAddress, amount, tokenAddress } =
            eventData;

          await Transaction.findOneAndUpdate(
            { "metadata.withdrawalId": withdrawalId },
            {
              $set: {
                status: "payout_failed",
                metadata: {
                  ...eventData,
                  treasuryAddress,
                  event: "PayoutToTreasury",
                },
              },
            }
          );
        } else if (selector === EVENT_SELECTORS.EmergencyPaused) {
          // Log emergency pause
          useLogger().warn(
            "[sendpay.indexer] Contract emergency paused",
            eventData
          );
        } else if (selector === EVENT_SELECTORS.EmergencyResumed) {
          // Log emergency resume
          useLogger().info(
            "[sendpay.indexer] Contract emergency resumed",
            eventData
          );
        } else if (selector === EVENT_SELECTORS.RoleChanged) {
          // Log role changes
          useLogger().info("[sendpay.indexer] Role changed", eventData);
        }
      }
    },
  });
}
