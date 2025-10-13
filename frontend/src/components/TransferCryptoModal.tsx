"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTokenConfig } from "@/lib/constants";
import { useCallAnyContract } from "@chipi-stack/nextjs";
import { X } from "lucide-react";

interface TransferCryptoModalProps {
  open: boolean;
  onClose: () => void;
}

export function TransferCryptoModal({ open, onClose }: TransferCryptoModalProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { callAnyContractAsync } = useCallAnyContract();
  if (!open) return null;

  const onTransfer = async () => {
    if (!recipient || !amount) return;
    setIsLoading(true);
    try {
      const usdc = getTokenConfig("USDC") as { address: string; decimals: string };
      // Minimal example: call ERC20 transfer(recipient, amount)
      const amountWithDecimals = (parseFloat(amount) * Math.pow(10, parseInt(usdc.decimals))).toString();
      await callAnyContractAsync({
        params: {
          encryptKey: "", // handled by Chipi SDK if needed
          wallet: { address: "" },
          contractAddress: usdc.address,
          calls: [
            {
              contractAddress: usdc.address,
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
            <Label htmlFor="to">Recipient Address</Label>
            <Input id="to" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x..." />
          </div>
          <div>
            <Label htmlFor="amount">Amount (USDC)</Label>
            <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <Button disabled={isLoading || !recipient || !amount} className="w-full" onClick={onTransfer}>
            {isLoading ? "Transferring..." : "Transfer"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}


