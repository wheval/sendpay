"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { cookies } from "@/lib/cookies";
import { EnterPinModal } from "./EnterPinModal";

interface TransferCryptoModalProps {
  open: boolean;
  onClose: () => void;
  usdcBalance?: string | null;
  strkBalance?: string | null;
  userId?: string;
}

export function TransferCryptoModal({ open, onClose, usdcBalance, strkBalance, userId }: TransferCryptoModalProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<"USDC" | "STRK">("USDC");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  if (!open) return null;

  // Get current balance for selected token
  const currentBalance = selectedToken === "USDC" ? usdcBalance : strkBalance;
  const balanceNumber = Number(currentBalance || "0");
  const amountNumber = Number(amount || "0");
  const hasInsufficientBalance = amountNumber > balanceNumber;

  const onTransfer = () => {
    if (!recipient || !amount || hasInsufficientBalance) return;
    
    // Validate recipient address (basic Starknet address validation)
    if (!recipient.startsWith("0x") || recipient.length !== 66) {
      setError("Invalid recipient address. Please enter a valid Starknet address.");
      return;
    }

    setError(null);
    setShowPinModal(true);
  };

  const executeTransfer = async (pin: string) => {
    setShowPinModal(false);
    setIsLoading(true);
    
    try {
      // Get authentication token
      const token = cookies.get("jwt");
      if (!token) {
        throw new Error("Authentication required. Please log in again.");
      }

      if (!userId) {
        throw new Error("User ID is required for wallet access.");
      }

      // Get wallet using API route
      const walletRes = await fetch("/api/chipi/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const walletData = await walletRes.json();

      if (!walletRes.ok || !walletData.success) {
        throw new Error(walletData.message || "Failed to fetch wallet");
      }

      const wallet = walletData.data;

      if (!wallet) {
        throw new Error("No wallet found for user. Please create a wallet first.");
      }
   
      // Execute transfer using API route
      const transferRes = await fetch("/api/chipi/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          pin,
          wallet,
          recipient,
          amount,
          token: selectedToken
        }),
      });

      const transferData = await transferRes.json();

      if (!transferRes.ok || !transferData.success) {
        throw new Error(transferData.message || "Transfer failed");
      }

      const result = transferData.data;
      
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
      
    } catch (error: unknown) {
      console.error("Transfer error:", error);
      const errorMessage = error instanceof Error ? error.message : "Transfer failed. Please try again.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Transfer Crypto
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="token">Token</Label>
            <Select value={selectedToken} onValueChange={(value: "USDC" | "STRK") => setSelectedToken(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USDC">USDC</SelectItem>
                <SelectItem value="STRK">STRK</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              Balance: {currentBalance ? `${Number(currentBalance).toFixed(2)} ${selectedToken}` : "Loading..."}
            </p>
          </div>
          
          <div>
            <Label htmlFor="to">Recipient Address</Label>
            <Input id="to" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x..." />
          </div>
          
          <div>
            <Label htmlFor="amount">Amount ({selectedToken})</Label>
            <Input 
              id="amount" 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              placeholder="0.00" 
              step={selectedToken === "USDC" ? "0.01" : "0.000000000000000001"}
            />
            {hasInsufficientBalance && amount && (
              <p className="text-sm text-red-500 mt-1">
                Insufficient balance. Available: {balanceNumber.toFixed(2)} {selectedToken}
              </p>
            )}
          </div>
          
          <Button 
            disabled={isLoading || !recipient || !amount || hasInsufficientBalance} 
            className="w-full" 
            onClick={onTransfer}
          >
            {isLoading ? "Transferring..." : success ? "Transfer Successful!" : `Transfer ${selectedToken}`}
          </Button>
          
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-600">Transfer successful! Check your wallet for confirmation.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* PIN Modal */}
      <EnterPinModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onPinEntered={(pin) => executeTransfer(pin)}
        title="Enter PIN to Transfer"
        description={`Enter your PIN to transfer ${amount} ${selectedToken} to ${recipient.slice(0, 10)}...`}
      />
    </div>
  );
}


