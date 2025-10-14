"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { getTokenConfig } from "@/lib/constants";
import { cookies } from "@/lib/cookies";
import { EnterPinModal } from "./EnterPinModal";
import { X } from "lucide-react";
import { DEFAULT_USD_NGN_FALLBACK }  from "@/lib/constants";

interface WithdrawalModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  usdcBalance: string | null;
  strkBalance: string | null;
  bankAccounts: Array<{
    id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    isDefault?: boolean;
  }>;
  exchangeRate?: number;
}

export function WithdrawalModal({
  open,
  onClose,
  userId,
  usdcBalance,
  strkBalance,
  bankAccounts,
  exchangeRate: exchangeRateProp,
}: WithdrawalModalProps) {
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<"USDC" | "STRK">("USDC");
  const [selectedBank, setSelectedBank] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<
    "input" | "approving" | "withdrawing" | "completed"
  >("input");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(exchangeRateProp ?? DEFAULT_USD_NGN_FALLBACK); // Default NGN rate
  const [strkUsd, setStrkUsd] = useState<number>(0); // STRK -> USD price
  const [lockedRate, setLockedRate] = useState<number | null>(null); // Locked rate when withdrawal starts

  // Pre-select default bank account when modal opens
  React.useEffect(() => {
    if (open && bankAccounts?.length > 0) {
      const defaultAccount = bankAccounts.find((account) => account.isDefault);
      setSelectedBank(defaultAccount ? defaultAccount.id : bankAccounts[0].id);
    }
  }, [open, bankAccounts]);

  // Sync with provided rate from parent, or fetch if not provided
  React.useEffect(() => {
    if (typeof exchangeRateProp === 'number' && exchangeRateProp > 0) {
      setExchangeRate(exchangeRateProp);
    }
    if (!open) {
      // Reset locked rate when modal closes
      setLockedRate(null);
      return;
    }
    
    // Only fetch rate if no rate was provided as prop
    if (typeof exchangeRateProp !== 'number' || exchangeRateProp <= 0) {
      (async () => {
        try {
          const token = cookies.get("jwt") || undefined;
          const res = await api.transaction.summary(token);
          const rate = (res?.exchangeRate) ?? (res?.data?.exchangeRate);
          const price = res?.data?.prices?.STRK_USD ?? res?.prices?.STRK_USD;
          if (typeof rate === 'number' && rate > 0) setExchangeRate(rate);
          if (typeof price === 'number' && price > 0) setStrkUsd(price);
        } catch (error) {
          console.error("Failed to fetch exchange rate:", error);
        }
      })();
    }
  }, [open, exchangeRateProp]);

  // Clear error when amount changes and meets minimum requirement
  React.useEffect(() => {
    if (error && amount) {
      const amountNum = parseFloat(amount);
      const usdPerToken = selectedToken === 'USDC' ? 1 : (strkUsd || 0);
      const currentRate = lockedRate || exchangeRate;
      const nairaEquivalent = amountNum * usdPerToken * currentRate;

      // Only clear error if the new amount meets the minimum requirement
      if (nairaEquivalent >= 200) {
        setError("");
      }
    }
  }, [amount, error, exchangeRate, lockedRate]);

  if (!open) return null;

  const handleWithdrawal = async () => {
    if (!amount || !selectedBank || !userId) {
      setError("Please fill in all fields");
      return;
    }

    const amountNum = parseFloat(amount);

    // Lock the exchange rate when withdrawal starts
    setLockedRate(exchangeRate);

    // Check minimum withdrawal amount (200 NGN)
    const usdPerToken = selectedToken === 'USDC' ? 1 : (strkUsd || 0);
    const nairaEquivalent = amountNum * usdPerToken * exchangeRate;
    if (nairaEquivalent < 200) {
      setError(
        `Minimum withdrawal amount is ₦200. You entered ₦${Math.round(nairaEquivalent).toLocaleString('en-NG')}`
      );
      return;
    }

    // Check if user has sufficient balance
    const currentBalance = selectedToken === "USDC" ? usdcBalance : strkBalance;
    const balanceNum = currentBalance ? parseFloat(currentBalance) : 0;

    if (amountNum > balanceNum) {
      setError(
        `Insufficient ${selectedToken} balance. Available: ${balanceNum.toFixed(
          selectedToken === "USDC" ? 2 : 6
        )} ${selectedToken}`
      );
      return;
    }

    setShowPinModal(true);
  };

  const executeWithdrawal = async (pin: string) => {
    setShowPinModal(false);
    setIsLoading(true);
    setError("");
    setSuccess(false);
    
    try {
      // Step 1: Get withdrawal signature from backend
      setStep("input");
      const tokenConfig = getTokenConfig(selectedToken) as {
        address: string;
        decimals: string;
      };
      const token = cookies.get("jwt");
      
      // Use locked exchange rate (set when withdrawal button was clicked)
      const lockedExchangeRate = lockedRate || exchangeRate;

      const signatureResponse = await api.withdrawal.signature(
        {
          amount,
          tokenAddress: tokenConfig.address,
          bankAccountId: selectedBank,
          token: 'USDC',
          lockedExchangeRate,
        },
        token || undefined
      );

      if (!signatureResponse.success) {
        throw new Error(
          signatureResponse.message || "Failed to get withdrawal signature"
        );
      }

      const {
        request,
        signature,
        transactionId: txId,
      } = signatureResponse.data;
      setTransactionId(txId);

      // Step 2: Prepare multicall for approval + withdrawal
      setStep("approving");
      
      const sendPayContractAddress =
        process.env.NEXT_PUBLIC_SENDPAY_CONTRACT_ADDRESS ||
        "0x03bfa7e91e5a6b006d0172e854e0ad2ef5c06ab7e6329116003022a28caf7b39";
      
      // Convert amount to proper format (assuming 6 decimals for USDC)
      const amountWithDecimals = (
        parseFloat(amount) * Math.pow(10, parseInt(tokenConfig.decimals))
      ).toString();

      // Toggle to test approve-only path
      const APPROVE_ONLY = false;

      // Use latest block timestamp when available; fallback to local time
      //TODO: Make this dynamic based on the network
      const timestampFelt = String(
        await (async () => {
          try {
            const resp = await fetch('/api/starknet/time', { cache: 'no-store' });
            if (resp.ok) {
              const j = await resp.json();
              if (j?.success && typeof j.timestamp === 'number') return j.timestamp;
            }
          } catch {}
          return Math.floor(Date.now() / 1000);
        })()
      );

      const callsAll = [
        {
          contractAddress: tokenConfig.address,
          entrypoint: "approve",
          calldata: [
            sendPayContractAddress, // spender
            amountWithDecimals, // amount low
            "0", // amount high
          ],
        },
        {
          contractAddress: sendPayContractAddress,
          entrypoint: "withdraw_with_signature",
          calldata: [
            // WithdrawalRequest struct
            request.user, // user
            request.amount, // amount low
            "0", // amount high
            request.token, // token
            request.tx_ref, // tx_ref
            request.nonce, // nonce low
            "0", // nonce high
            timestampFelt, // override timestamp to current block time window
            // Signature
            signature.r, // signature_r
            signature.s, // signature_s
          ],
        },
      ];

      const calls = APPROVE_ONLY ? [callsAll[0]] : callsAll;

      // Step 3: Get wallet and execute multicall
      setStep("withdrawing");

      // Get wallet using API route
      const walletRes = await fetch("/api/chipi/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const walletData = await walletRes.json();

      if (!walletRes.ok || !walletData.success) {
        throw new Error(walletData.message || "Failed to fetch wallet");
      }

      const wallet = walletData.data;

      if (!wallet) {
        throw new Error(
          "No wallet found for user. Please create a wallet first."
        );
      }

      const txRes = await fetch("/api/chipi/call-any-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptKey: pin,
          wallet,
          contractAddress: sendPayContractAddress,
          calls,
        }),
      });
      const txJson = await txRes.json();
      if (!txRes.ok || !txJson.success) {
        throw new Error(txJson.message || "Failed to submit transaction");
      }
      const transactionHash = txJson.data;
      
      if (transactionHash) {
        setStep("completed");
        setSuccess(true);
        
        // Update backend with execution status
        await api.withdrawal.execute(
          {
          transactionId: txId,
          request,
            signature,
          },
          token || undefined
        );

        setTimeout(() => {
          onClose();
          setSuccess(false);
          setStep("input");
        }, 2000);
      }
    } catch (err: unknown) {
      console.error("Withdrawal error:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Withdrawal failed");
      setStep("input");
    } finally {
      setIsLoading(false);
    }
  };

  const getStepMessage = () => {
    switch (step) {
      case "input":
        return "Enter withdrawal details";
      case "approving":
        return "Approving token transfer...";
      case "withdrawing":
        return "Processing withdrawal...";
      case "completed":
        return "Withdrawal completed successfully!";
      default:
        return "";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Withdraw Funds
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )} */}

          {step === "completed" ? (
            <div className="text-center space-y-4">
              <div className="text-green-600 text-lg">
                ✅ Withdrawal Successful!
              </div>
              <p className="text-sm text-muted-foreground">
                Your withdrawal has been processed. Funds will arrive in 30s.
              </p>
              <Button onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="token">Token</Label>
                <Select value={"USDC"} disabled>
                  <SelectTrigger className="disabled:opacity-100 [&_[data-slot=trigger]_[data-slot=icon]]:hidden">
                    <SelectValue className="disabled:opacity-100" placeholder="USDC" />
                  </SelectTrigger>
                  <SelectContent className="[&_[data-slot=trigger]_[data-slot=icon]]:hidden">
                    <SelectItem value="USDC">USDC</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-xs lg:text-sm text-muted-foreground mt-1">
                  Balance: {usdcBalance ? `${parseFloat(usdcBalance).toFixed(2)} USDC` : "Loading..."}
                </div>
              </div>

              <div>
                <Label htmlFor="amount">Amount (USDC)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  step={"0.01"}
                  disabled={isLoading}
                />
                {amount && (
                  <div className="text-xs lg:text-sm text-muted-foreground flex items-center gap-x-2 mt-1">
                    <span className="text-xs">you will receive:</span>
                    {(() => {
                      const amountNum = parseFloat(amount || '0');
                      const usdPerToken = 1;
                      const currentRate = lockedRate || exchangeRate;
                      const ngn = Math.round(amountNum * usdPerToken * currentRate);
                      return `≈ ₦${ngn.toLocaleString('en-NG')}`;
                    })()}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="bank">Bank Account</Label>
                <Select
                  value={selectedBank}
                  onValueChange={setSelectedBank}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts?.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.bankName} - {bank.accountNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs lg:text-sm text-muted-foreground mt-1">
                  {/* this should display the account name */}
                  {selectedBank && bankAccounts
                    ? bankAccounts.find((bank) => bank.id === selectedBank)?.accountName || ""
                    : ""}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">
                    Withdrawal completed successfully!
                  </p>
              </div>
              )}

              {/* <div className="text-sm text-muted-foreground">
                {getStepMessage()}
              </div> */}

              <Button
                onClick={handleWithdrawal}
                disabled={isLoading || !amount || !selectedBank || !usdcBalance || parseFloat(usdcBalance) <= 0 || parseFloat(amount || '0') > parseFloat(usdcBalance || '0')}
                className="w-full"
              >
                {(() => {
                  if (isLoading) return 'Processing...';
                  if (!usdcBalance || parseFloat(usdcBalance) <= 0) return 'Insufficient USDC Balance';
                  const amountNum = parseFloat(amount || '0');
                  const balanceNum = parseFloat(usdcBalance || '0');
                  if (amountNum > balanceNum) return 'Amount exceeds balance';
                  const usdPerToken = 1; // USDC only
                  const currentRate = lockedRate || exchangeRate;
                  const ngn = Math.round(amountNum * usdPerToken * currentRate);
                  return `Withdraw ₦${ngn.toLocaleString('en-NG')}`;
                })()}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <EnterPinModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onPinEntered={(pin) => executeWithdrawal(pin)}
        title="Enter PIN to Withdraw"
        description={`Enter your PIN to withdraw ₦${Math.round(parseFloat(amount || "0") * (lockedRate || exchangeRate)).toLocaleString('en-NG')} to your bank account`}
      />
    </div>
  );
}
