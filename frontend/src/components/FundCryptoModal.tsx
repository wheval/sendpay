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
  generateSimulatedPwbtData,
  addSimulatedBalance,
  setSimulationActive,
  isSimulationActive
} from "@/lib/pwbt-simulation";
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
  onBalanceUpdate?: () => void;
}

export function FundCryptoModal({ open, onClose, walletAddress, onBalanceUpdate }: FundCryptoModalProps) {
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
  const [countdown, setCountdown] = useState<number>(0);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [simulationMode] = useState(() => {
    // Enable simulation mode (set to false to use real Flutterwave)
    const useSimulation = true;
    if (useSimulation) {
      setSimulationActive(true);
    }
    return useSimulation;
  });
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

  // Countdown timer effect
  React.useEffect(() => {
    if (countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Timer expired, reset state
          setPwbt(null);
          setPaymentConfirmed(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

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
      if (simulationMode) {
        // SIMULATION MODE: Generate fake bank details
        const simulatedData = generateSimulatedPwbtData(amountUSD);
        setPwbt(simulatedData);
        
        // Start countdown (15 minutes = 900 seconds)
        setCountdown(900);
      } else {
        // REAL MODE: Use Flutterwave API
        const token = cookies.get("jwt") || undefined;
        const res = await api.flutterwave.onrampInitiate({ amountUSD }, token);
        if (res?.success) {
          setPwbt(res.data);
          // Start countdown based on expiry time
          const expiryTime = new Date(res.data.virtualAccount.expiry).getTime();
          const now = Date.now();
          const remainingSeconds = Math.max(0, Math.floor((expiryTime - now) / 1000));
          setCountdown(remainingSeconds);
        } else {
          setError(res?.message || "Failed to initiate PWBT");
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to initiate PWBT");
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <Card className="max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Fund Crypto
            <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tab switcher - always visible */}
          <div className="flex gap-2">
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

          <div className={`space-y-4 ${view === 'naira' ? 'hidden' : 'block'}`}>
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
          
          <div className={`space-y-3 ${view === 'wallet' ? 'hidden' : 'block'}`}>
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
            ) : paymentConfirmed ? (
              <div className="space-y-3 text-center">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-center">
                      <div className="w-[120px] h-[120px] mb-4 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-[96px]">✓</span>
                      </div>
                    </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-bold text-lg w-full text-green-800">Payment Successful!</div>
                  </div>
                  <div className="text-sm text-green-700 space-y-1">
                    <div>Your payment of <strong>₦{pwbt.virtualAccount.amount.toLocaleString('en-NG')}</strong> has been received.</div>
                    <div>You received <strong>{tokenAmount} {selectedToken}</strong> in your wallet.</div>
                    <div>Transaction ID: <strong>{pwbt.fiat_tx_ref}</strong></div>
                  </div>
                </div>
                <Button className="w-full" onClick={() => {
                  setPaymentConfirmed(false);
                  setPwbt(null);
                  setTokenAmount('');
                  onClose();
                }}>
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-blue-50 dark:bg-transparent border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="font-medium">Account Details</div>
                  <div className="mt-2 grid gap-y-1.5 gap-x-0 text-sm">
                    <div className="font-bold">
                      <span className="text-muted-foreground font-normal inline-block w-[125px]">Bank:</span>{pwbt.virtualAccount.bankName}
                    </div>
                     <div className="flex items-center">
                       <span className="text-muted-foreground inline-block w-[125px]">Account Number:</span>
                       <span className="font-bold">{pwbt.virtualAccount.accountNumber}</span>
                     </div>
                     <div className="flex items-center">
                       <span className="text-muted-foreground inline-block w-[125px]">Account Name:</span>
                       <span className="font-bold">SENDPAY HQ</span>
                     </div>
                    <div>
                      <span className="text-muted-foreground inline-block w-[125px]">Amount to Pay:</span> <span className="font-bold">₦{pwbt.virtualAccount.amount.toLocaleString('en-NG')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground inline-block w-[125px]">Reference:</span><span className="font-bold">{pwbt.fiat_tx_ref}</span>
                    </div>
                    <div className="flex items-center ">
                      <span className="text-muted-foreground inline-block w-[125px]">Expires in:</span>
                      <span className={`font-mono ${countdown < 300 ? 'text-red-600' : 'text-green-600'}`}>
                        {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                </div>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    // Simulate payment confirmation
                    setPaymentConfirmed(true);
                    
                    // Add simulated balance
                    const amount = parseFloat(tokenAmount || '0');
                    addSimulatedBalance(selectedToken, amount);
                    
                    // Clear countdown
                    setCountdown(0);
                    
                    // Notify parent component to refresh balance
                    if (onBalanceUpdate) {
                      onBalanceUpdate();
                    }
                  }}
                >
                  I&apos;ve Sent It
                </Button>
                <Button variant="outline" className="w-full" onClick={() => {
                  setPwbt(null);
                  setCountdown(0);
                  setPaymentConfirmed(false);
                }}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


