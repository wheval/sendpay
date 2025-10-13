"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CryptoJS from "crypto-js";
import { Account, RpcProvider } from "starknet";
import { cookies } from "@/lib/cookies";
import { api } from "@/lib/api";

interface EnterPinModalProps {
  open: boolean;
  onClose: () => void;
  onPinVerified: (decryptedPrivateKey: string, account: Account) => void;
  walletAddress: string;
  encryptedPrivateKey: string;
  title?: string;
  description?: string;
}

export function EnterPinModal({ 
  open, 
  onClose, 
  onPinVerified, 
  walletAddress, 
  encryptedPrivateKey,
  title = "Enter your PIN",
  description = "Please enter your PIN to authorize this transaction."
}: EnterPinModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const inputsRef = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);

  const setInputRef = (index: number) => (el: HTMLInputElement | null): void => {
    inputsRef.current[index] = el;
  };

  useEffect(() => {
    if (open) {
      setDigits(["", "", "", ""]);
      setError("");
      setTimeout(() => inputsRef.current[0]?.focus(), 0);
    }
  }, [open]);

  const setDigit = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    if (val && idx < 3) inputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const pin = digits.join("");
  const disabled = isLoading || pin.length !== 4;

  const handleVerifyPin = async () => {
    if (pin.length !== 4) return;

    try {
      setIsLoading(true);
      setError("");

      // Decrypt private key with PIN
      const decryptedPrivateKey = CryptoJS.AES.decrypt(encryptedPrivateKey, pin).toString(CryptoJS.enc.Utf8);
      
      if (!decryptedPrivateKey) {
        setError("Invalid PIN. Please try again.");
        setDigits(["", "", "", ""]);
        setTimeout(() => inputsRef.current[0]?.focus(), 100);
        return;
      }

      // Create account instance
      const nodeUrl = process.env.NEXT_PUBLIC_STARKNET_NODE_URL || 'https://starknet-mainnet.public.blastapi.io/rpc/v0_7';
      const provider = new RpcProvider({ nodeUrl });
      const account = new Account(provider, walletAddress, decryptedPrivateKey);

      // Verify the account is valid by checking if the address matches
      if (account.address !== walletAddress) {
        setError("Invalid wallet configuration. Please contact support.");
        return;
      }

      // PIN verified successfully
      onPinVerified(decryptedPrivateKey, account);
      onClose();
      setDigits(["", "", "", ""]);
      setError("");

    } catch (error) {
      console.error('PIN verification failed:', error);
      setError("Invalid PIN. Please try again.");
      setDigits(["", "", "", ""]);
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg max-w-sm w-full">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">×</Button>
          </div>

          <p className="text-xs text-muted-foreground">{description}</p>

          <div className="flex items-center justify-between gap-2">
            {digits.map((d, i) => (
              <Input
                key={i}
                ref={setInputRef(i)}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`w-12 h-12 text-center text-lg ${error ? 'border-red-500' : ''}`}
              />
            ))}
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          <Button
            className="w-full"
            disabled={disabled}
            onClick={handleVerifyPin}
          >
            {isLoading ? "Verifying..." : "Verify PIN"}
          </Button>
        </div>
      </div>
    </div>
  );
}
