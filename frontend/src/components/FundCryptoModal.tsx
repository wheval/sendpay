"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { normalizeHex } from "@/lib/utils";
import QRCode from "react-qr-code";
import { api } from "@/lib/api";
import { cookies } from "@/lib/cookies";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FundCryptoModalProps {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
}

export function FundCryptoModal({ open, onClose, walletAddress }: FundCryptoModalProps) {
  const [copied, setCopied] = useState(false);
  const [selectedToken, setSelectedToken] = useState<"USDC" | "STRK">("USDC");
  const [tokenAmount, setTokenAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [strkUsd, setStrkUsd] = useState<number>(0);
  const [view, setView] = useState<"wallet" | "naira">("wallet");
  const [pwbt, setPwbt] = useState<null | {
    transactionId: string;
    fiat_tx_ref: string;
    virtualAccount: {
      accountNumber: string;
      bankName: string;
      amount: number;
      currency: string;
      expiry: string;
      reference: string;
      narration?: string;
    }
  }>(null);
  // Hooks must not be conditional; keep rendering minimal UI when closed

  const normalized = normalizeHex(walletAddress || "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(normalized);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // Load exchange rate and STRK price when modal opens
  React.useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const token = cookies.get("jwt") || undefined;
        const res = await api.transaction.summary(token);
        const rate = (res?.exchangeRate) ?? (res?.data?.exchangeRate);
        const price = res?.data?.prices?.STRK_USD ?? res?.prices?.STRK_USD;
        if (typeof rate === 'number' && rate > 0) setExchangeRate(rate);
        if (typeof price === 'number' && price > 0) setStrkUsd(price);
      } catch {
        // ignore
      }
    })();
  }, [open]);

  const computeNairaEquivalent = (): number => {
    const amt = parseFloat(tokenAmount || '0');
    const usdPerToken = selectedToken === 'USDC' ? 1 : (strkUsd || 0);
    const ngn = Math.round((amt || 0) * usdPerToken * (exchangeRate || 0));
    return ngn > 0 ? ngn : 0;
  };

  const initiatePwbt = async () => {
    setError("");
    const amt = Number(tokenAmount || 0);
    if (!amt || amt <= 0) {
      setError("Enter a valid token amount");
      return;
    }
    const usdPerToken = selectedToken === 'USDC' ? 1 : (strkUsd || 0);
    const amountUSD = +(amt * usdPerToken).toFixed(6);
    setIsLoading(true);
    try {
      const token = cookies.get("jwt") || undefined;
      const res = await api.flutterwave.onrampInitiate({ amountUSD }, token);
      if (res?.success) {
        setPwbt(res.data);
      } else {
        setError(res?.message || "Failed to initiate PWBT");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to initiate PWBT");
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-lg lg:max-w-3xl w-full">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Fund Crypto
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 lg:flex lg:gap-x-8 lg:items-center">
          {/* Mobile view switcher */}
          <div className="flex gap-2 lg:hidden">
            <Button
              variant={view === 'wallet' ? 'default' : 'outline'}
              className="w-1/2 text-sm"
              onClick={() => setView('wallet')}
            >
              <span className="text-xs md:text-sm">Send from Wallet</span>
            </Button>
            <Button
              variant={view === 'naira' ? 'default' : 'outline'}
              className="w-1/2 text-sm"
              onClick={() => setView('naira')}
            >
              <span className="text-xs md:text-sm">Buy with Naira</span>
            </Button>
          </div>

          <div className={`space-y-4 lg:w-1/2 ${view === 'naira' ? 'hidden' : 'block'} lg:block`}>
            <p className="lg:text-lg leading-tight font-bold text-muted-foreground">Send USDC/STRK to your wallet address on Starknet.</p>
            
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
          
          <p className="text-center lg:mr-2 hidden lg:block"> OR</p>
          <div className={`space-y-3 lg:w-1/2 lg:space-y-4 ${view === 'wallet' ? 'hidden' : 'block'} lg:block`}>
            <p className="text-lg font-bold text-muted-foreground">Buy with Naira</p>
            {!pwbt ? (
              <>
                <div className="grid gap-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Token</label>
                    <Select value={selectedToken} onValueChange={(v: "USDC" | "STRK") => setSelectedToken(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select token" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="STRK">STRK</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Amount ({selectedToken})</label>
                    <Input type="number" step={selectedToken === 'USDC' ? "0.01" : "0.000001"} value={tokenAmount} onChange={(e) => setTokenAmount(e.target.value)} placeholder={`Enter ${selectedToken} amount`} />
                  </div>
                  {tokenAmount && (
                    <div className="text-xs lg:text-sm text-muted-foreground">
                      You will pay: ₦{computeNairaEquivalent().toLocaleString('en-NG')} (at locked rate)
                    </div>
                  )}
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{error}</div>
                )}
                <Button onClick={initiatePwbt} disabled={isLoading || !tokenAmount} className="w-full">
                  {isLoading ? 'Creating account...' : 'Generate Bank Details'}
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="font-medium">Virtual Account Details</div>
                  <div className="mt-2 grid gap-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Bank:</span> {pwbt.virtualAccount.bankName}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Account Number:</span>
                      <Input readOnly value={pwbt.virtualAccount.accountNumber} className="font-mono text-sm" />
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount to Pay:</span> ₦{pwbt.virtualAccount.amount.toLocaleString('en-NG')} {pwbt.virtualAccount.currency}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Reference:</span> {pwbt.fiat_tx_ref}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expires:</span> {new Date(pwbt.virtualAccount.expiry).toLocaleString()}
                    </div>
                  </div>
                </div>
                <Button className="w-full" onClick={onClose}>Done</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


