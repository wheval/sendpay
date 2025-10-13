"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransfer, useCallAnyContract } from "@chipi-stack/nextjs";
import { api } from "@/lib/api";
import { getTokenConfig } from "@/lib/constants";
import { cookies } from "@/lib/cookies";
import { X } from "lucide-react";

interface WithdrawalModalProps {
  open: boolean;
  onClose: () => void;
  userWalletAddress: string;
  bankAccounts: Array<{
    _id: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }>;
}

export function WithdrawalModal({ open, onClose, userWalletAddress, bankAccounts }: WithdrawalModalProps) {
  const [amount, setAmount] = useState("");
  const [selectedBank, setSelectedBank] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"input" | "approving" | "withdrawing" | "completed">("input");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { transferAsync } = useTransfer();
  const { callAnyContractAsync } = useCallAnyContract();

  if (!open) return null;

  const handleWithdrawal = async () => {
    if (!amount || !selectedBank || !userWalletAddress || !pin) {
      setError("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setError("");
    
    try {
      // Step 1: Get withdrawal signature from backend
      setStep("input");
      const tokenConfig = getTokenConfig("USDC") as { address: string; decimals: string };
      const token = cookies.get("jwt");
      
      const signatureResponse = await api.starknet.withdraw({
        amount,
        tokenAddress: tokenConfig.address,
        bankAccountId: selectedBank
      }, token || undefined);

      if (!signatureResponse.success) {
        throw new Error(signatureResponse.message || "Failed to get withdrawal signature");
      }

      const { request, signature, transactionId: txId } = signatureResponse.data;
      setTransactionId(txId);

      // Step 2: Prepare multicall for approval + withdrawal
      setStep("approving");
      
      const sendPayContractAddress = process.env.NEXT_PUBLIC_SENDPAY_CONTRACT_ADDRESS || "0x0444d5c9b2a6375bdce805338cdf6340439be92aec2e854704e77bedcdfd929a";
      
      // Convert amount to proper format (assuming 6 decimals for USDC)
      const amountWithDecimals = (parseFloat(amount) * Math.pow(10, parseInt(tokenConfig.decimals))).toString();

      const calls = [
        {
          contractAddress: tokenConfig.address,
          entrypoint: "approve",
          calldata: [
            sendPayContractAddress, // spender
            amountWithDecimals,     // amount low
            "0"                     // amount high
          ]
        },
        {
          contractAddress: sendPayContractAddress,
          entrypoint: "withdraw_with_signature",
          calldata: [
            // WithdrawalRequest struct
            request.user,           // user
            request.amount,         // amount low
            "0",                    // amount high
            request.token,          // token
            request.tx_ref,         // tx_ref
            request.nonce,          // nonce low
            "0",                    // nonce high
            request.timestamp,      // timestamp
            // Signature
            signature.r,            // signature_r
            signature.s             // signature_s
          ]
        }
      ];

      // Step 3: Execute multicall
      setStep("withdrawing");
      const transactionHash = await callAnyContractAsync({
        params: {
          encryptKey: pin, // Use the PIN as encrypt key
          wallet: { address: userWalletAddress }, // Wallet data
          contractAddress: sendPayContractAddress,
          calls: calls
        },
        bearerToken: token || ""
      });
      
      if (transactionHash) {
        setStep("completed");
        
        // Update backend with execution status
        await api.starknet.withdraw({
          transactionId: txId,
          request,
          signature
        }, token || undefined);
      }

    } catch (err: any) {
      console.error("Withdrawal error:", err);
      setError(err.message || "Withdrawal failed");
      setStep("input");
    } finally {
      setIsLoading(false);
    }
  };

  const getStepMessage = () => {
    switch (step) {
      case "input": return "Enter withdrawal details";
      case "approving": return "Approving token transfer...";
      case "withdrawing": return "Processing withdrawal...";
      case "completed": return "Withdrawal completed successfully!";
      default: return "";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Withdraw Funds
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {step === "completed" ? (
            <div className="text-center space-y-4">
              <div className="text-green-600 text-lg">✅ Withdrawal Successful!</div>
              <p className="text-sm text-muted-foreground">
                Your withdrawal has been processed. Funds will be sent to your bank account within 1-2 business days.
              </p>
              <Button onClick={onClose} className="w-full">Close</Button>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="amount">Amount (USDC)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="bank">Bank Account</Label>
                <Select value={selectedBank} onValueChange={setSelectedBank} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((bank) => (
                      <SelectItem key={bank._id} value={bank._id}>
                        {bank.bankName} - {bank.accountNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter your 4-digit PIN"
                  maxLength={4}
                  disabled={isLoading}
                />
              </div>

              <div className="text-sm text-muted-foreground">
                {getStepMessage()}
              </div>

              <Button
                onClick={handleWithdrawal}
                disabled={isLoading || !amount || !selectedBank || !pin}
                className="w-full"
              >
                {isLoading ? "Processing..." : "Withdraw Funds"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
