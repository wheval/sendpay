"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { normalizeHex } from "@/lib/utils";
import QRCode from "react-qr-code";

interface FundCryptoModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
}

export function FundCryptoModal({ open, onClose, walletAddress }: FundCryptoModalProps) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const normalized = normalizeHex(walletAddress || "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(normalized);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Fund Crypto
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <p className="text-lg font-bold text-muted-foreground">Send USDC/STRK to your wallet address on Starknet.</p>
            
            {/* QR Code */}
            <div className="flex flex-col items-center space-y-3">
              <div className="bg-white p-4 rounded-lg">
                <QRCode 
                  value={normalized}
                  size={180}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Scan this QR code with your crypto wallet to send funds
              </p>
            </div>

            {/* Wallet Address with Copy Icon */}
            <div className="space-y-2">
              {/* <p className="text-sm font-medium text-muted-foreground">address:</p> */}
              <div className="flex items-center space-x-2">
                <Input 
                  readOnly 
                  value={normalized} 
                  className="font-mono text-sm flex-1" 
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={copy}
                  className="shrink-0"
                >
                  {copied? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          
          <p className="text-center"> OR</p>
          <div>
            <p className="text-lg font-bold text-muted-foreground">Buy with Naira <span className="font-normal">(coming soon)</span></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


