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
// Use fully-qualified Cairo event names from ABI for reliable selector matching
const EVENT_SELECTORS = {
  WithdrawalCreated: getSelector("sendpay::sendpay::WithdrawalCreated"),
  WithdrawalCompleted: getSelector("sendpay::sendpay::WithdrawalCompleted"),
  WithdrawalFailed: getSelector("sendpay::sendpay::WithdrawalFailed"),
  DepositCompleted: getSelector("sendpay::sendpay::DepositCompleted"),
  EmergencyPaused: getSelector("sendpay::sendpay::EmergencyPaused"),
  EmergencyResumed: getSelector("sendpay::sendpay::EmergencyResumed"),
  RoleChanged: getSelector("sendpay::sendpay::RoleChanged"),
  PayoutToTreasury: getSelector("sendpay::sendpay::PayoutToTreasury"),
  // OpenZeppelin AccessControl events (sometimes emitted by upgrades/roles)
  OZ_RoleGranted: getSelector("openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted"),
  OZ_RoleGrantedWithDelay: getSelector("openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGrantedWithDelay"),
  OZ_RoleRevoked: getSelector("openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked"),
  OZ_RoleAdminChanged: getSelector("openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged"),
  OZ_AccessControlEvent: getSelector("openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::Event"),
  SENDPAY_Event: getSelector("sendpay::sendpay::Event"),
  // Short names as emitted by some indexers/explorers
  SHORT_RoleGranted: getSelector("RoleGranted"),
  SHORT_RoleRevoked: getSelector("RoleRevoked"),
  SHORT_RoleAdminChanged: getSelector("RoleAdminChanged"),
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

      // (intentionally no block-level logs in production)

      for (const event of block.events) {
        // Use the last key as the selector; some streams append the selector at the end
        const selector = event.keys[event.keys.length - 1];
        const txHash = event.transactionHash;
        const logIndex = event.eventIndex;

        // de-duplication and event data storage
        let eventType = "Unknown";
        let eventData: any = {};

        // Debug raw event info for local verification
        useLogger().info("[sendpay.indexer] raw event", {
          selector,
          keysCount: event.keys?.length || 0,
          txHash,
          logIndex,
        });

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
            blockNumber
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
            blockNumber
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
            blockNumber
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
            timestamp
          };
        } else if (selectorLc === EVENT_SELECTORS_LC.EmergencyPaused) {
          eventType = "EmergencyPaused";
          // Data structure from ABI: reason, timestamp
          const reason = event.data[0] as string;
          const timestamp = Number(event.data[1]);

          eventData = {
            reason,
            timestamp
          };
        } else if (selectorLc === EVENT_SELECTORS_LC.EmergencyResumed) {
          eventType = "EmergencyResumed";
          // Data structure from ABI: timestamp
          const timestamp = Number(event.data[0]);

          eventData = {
            timestamp
          };
        } else if (
          selectorLc === EVENT_SELECTORS_LC.RoleChanged ||
          selectorLc === String(EVENT_SELECTORS.OZ_RoleGranted).toLowerCase() ||
          selectorLc === String(EVENT_SELECTORS.OZ_RoleGrantedWithDelay).toLowerCase() ||
          selectorLc === String(EVENT_SELECTORS.OZ_RoleRevoked).toLowerCase() ||
          selectorLc === String(EVENT_SELECTORS.OZ_RoleAdminChanged).toLowerCase() ||
          selectorLc === String(EVENT_SELECTORS.SHORT_RoleGranted).toLowerCase() ||
          selectorLc === String(EVENT_SELECTORS.SHORT_RoleRevoked).toLowerCase() ||
          selectorLc === String(EVENT_SELECTORS.SHORT_RoleAdminChanged).toLowerCase()
        ) {
          eventType = "RoleChanged";
          // Data: (role, account, sender)
          const role = event.data[0] as string;
          const account = toHex(event.data[1] as any);
          const sender = toHex((event.data[2] ?? event.data[1]) as any);
          const timestamp = Number(event.data[3] ?? 0);
          eventData = { role, account, sender, timestamp };
        } else if (
          selectorLc === String(EVENT_SELECTORS.OZ_AccessControlEvent).toLowerCase() ||
          selectorLc === String(EVENT_SELECTORS.SENDPAY_Event).toLowerCase()
        ) {
          // Flat enum wrapper; some nodes emit only the outer enum selector and put the
          // variant data in `data`. Heuristic: if data has 3 felts, it likely matches
          // AccessControl (role, account, sender). Map it for observability.
          if (Array.isArray(event.data) && event.data.length === 3) {
            eventType = "RoleChanged";
            eventData = {
              role: event.data[0] as string,
              account: toHex(event.data[1] as any),
              sender: toHex(event.data[2] as any),
              timestamp: 0
            };
          } else {
            eventType = "Unknown";
          }
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
            timestamp
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
            // Save linkage and mark as payout pending
            pendingTx.status = "payout_pending";
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
                      status: "payout_pending",
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
                status: "payout_completed",
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
                status: "payout_failed",
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
          const { withdrawalId, treasuryAddress, amount, tokenAddress } = eventData;
          
          await Transaction.findOneAndUpdate(
            { "metadata.withdrawalId": withdrawalId },
            {
              $set: {
                status: "payout_failed",
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


