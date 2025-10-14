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
  const [exchangeRate, setExchangeRate] = useState<number>(exchangeRateProp ?? 1500); // Default NGN rate

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
      return;
    }
    if (!open) return;
    (async () => {
      try {
        const token = cookies.get("jwt") || undefined;
        const res = await api.transaction.summary(token);
        const rate = (res?.exchangeRate) ?? (res?.data?.exchangeRate);
        if (typeof rate === 'number' && rate > 0) setExchangeRate(rate);
      } catch (error) {
        console.error("Failed to fetch exchange rate:", error);
      }
    })();
  }, [open, exchangeRateProp]);

  // Clear error when amount changes and meets minimum requirement
  React.useEffect(() => {
    if (error && amount) {
      const amountNum = parseFloat(amount);
      const nairaEquivalent = amountNum * exchangeRate;

      // Only clear error if the new amount meets the minimum requirement
      if (nairaEquivalent >= 200) {
        setError("");
      }
    }
  }, [amount, error, exchangeRate]);

  if (!open) return null;

  const handleWithdrawal = async () => {
    if (!amount || !selectedBank || !userId) {
      setError("Please fill in all fields");
      return;
    }

    const amountNum = parseFloat(amount);

    // Check minimum withdrawal amount (200 NGN)
    const nairaEquivalent = amountNum * exchangeRate;
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
      
      const signatureResponse = await api.withdrawal.signature(
        {
        amount,
        tokenAddress: tokenConfig.address,
          bankAccountId: selectedBank,
          token: selectedToken,
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
        "0x0444d5c9b2a6375bdce805338cdf6340439be92aec2e854704e77bedcdfd929a";
      
      // Convert amount to proper format (assuming 6 decimals for USDC)
      const amountWithDecimals = (
        parseFloat(amount) * Math.pow(10, parseInt(tokenConfig.decimals))
      ).toString();

      const calls = [
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
            String(request.timestamp), // timestamp as felt string
            // Signature
            signature.r, // signature_r
            signature.s, // signature_s
          ],
        },
      ];

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
                <Select
                  value={selectedToken}
                  onValueChange={(value: "USDC" | "STRK") =>
                    setSelectedToken(value)
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select token" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="STRK">STRK</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-sm text-muted-foreground mt-1">
                  Balance:{" "}
                  {selectedToken === "USDC"
                    ? usdcBalance
                      ? `${parseFloat(usdcBalance).toFixed(2)} USDC`
                      : "Loading..."
                    : strkBalance
                    ? `${parseFloat(strkBalance).toFixed(6)} STRK`
                    : "Loading..."}
                </div>
              </div>

              <div>
                <Label htmlFor="amount">Amount ({selectedToken})</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  step={selectedToken === "USDC" ? "0.01" : "0.000001"}
                  disabled={isLoading}
                />
                {amount && (
                  <div className="text-sm text-muted-foreground mt-1">
                    ≈ ₦{Math.round(parseFloat(amount) * exchangeRate).toLocaleString('en-NG')}
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
                disabled={isLoading || !amount || !selectedBank}
                className="w-full"
              >
                {isLoading
                  ? "Processing..."
                  : `Withdraw ₦${Math.round(parseFloat(amount || "0") * exchangeRate).toLocaleString('en-NG')}`}
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
        description={`Enter your PIN to withdraw ₦${Math.round(parseFloat(amount || "0") * exchangeRate).toLocaleString('en-NG')} to your bank account`}
      />
    </div>
  );
}
