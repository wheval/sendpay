"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTokenConfig } from "@/lib/constants";
import { useCallAnyContract } from "@chipi-stack/nextjs";
import { X } from "lucide-react";

interface TransferCryptoModalProps {
  open: boolean;
  onClose: () => void;
  usdcBalance?: string | null;
  strkBalance?: string | null;
  userWalletAddress?: string;
}

export function TransferCryptoModal({ open, onClose, usdcBalance, strkBalance, userWalletAddress }: TransferCryptoModalProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<"USDC" | "STRK">("USDC");
  const [isLoading, setIsLoading] = useState(false);
  const { callAnyContractAsync } = useCallAnyContract();
  if (!open) return null;

  // Get current balance for selected token
  const currentBalance = selectedToken === "USDC" ? usdcBalance : strkBalance;
  const balanceNumber = Number(currentBalance || "0");
  const amountNumber = Number(amount || "0");
  const hasInsufficientBalance = amountNumber > balanceNumber;

  const onTransfer = async () => {
    if (!recipient || !amount || hasInsufficientBalance) return;
    setIsLoading(true);
    try {
      const tokenConfig = getTokenConfig(selectedToken) as { address: string; decimals: string };
      // Convert amount to token decimals
      const amountWithDecimals = (parseFloat(amount) * Math.pow(10, parseInt(tokenConfig.decimals))).toString();
      
      await callAnyContractAsync({
        params: {
          encryptKey: "", // handled by Chipi SDK if needed
          wallet: { address: userWalletAddress || "" },
          contractAddress: tokenConfig.address,
          calls: [
            {
              contractAddress: tokenConfig.address,
              entrypoint: "transfer",
              calldata: [recipient, amountWithDecimals, "0"],
            },
          ],
        },
        bearerToken: "",
      });
      onClose();
    } catch {
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
            {isLoading ? "Transferring..." : `Transfer ${selectedToken}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


