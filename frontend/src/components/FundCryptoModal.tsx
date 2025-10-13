"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { X } from "lucide-react";

interface FundCryptoModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
}

export function FundCryptoModal({ open, onClose, walletAddress }: FundCryptoModalProps) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Fund Crypto
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Send USDC/STRK to your wallet address on Starknet.</p>
            <Input readOnly value={walletAddress} className="font-mono" />
            <Button onClick={copy} className="w-full">{copied ? "Copied" : "Copy Address"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


