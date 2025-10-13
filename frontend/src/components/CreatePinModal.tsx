"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cookies } from "@/lib/cookies";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";
import { api } from "@/lib/api";

interface CreatePinModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (walletPublicKey: string) => void;
}

export function CreatePinModal({ open, onClose, onSuccess }: CreatePinModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [confirmDigits, setConfirmDigits] = useState(["", "", "", ""]);
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [error, setError] = useState<string | null>(null);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);
  const confirmInputsRef = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);
  const { toast } = useToast();
  

  const setInputRef = (index: number) => (el: HTMLInputElement | null): void => {
    inputsRef.current[index] = el;
  };

  const setConfirmInputRef = (index: number) => (el: HTMLInputElement | null): void => {
    confirmInputsRef.current[index] = el;
  };

  useEffect(() => {
    if (open) {
      setDigits(["", "", "", ""]);
      setConfirmDigits(["", "", "", ""]);
      setStep('create');
      setError(null);
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

  const setConfirmDigit = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...confirmDigits];
    next[idx] = val;
    setConfirmDigits(next);
    if (val && idx < 3) confirmInputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handleConfirmKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !confirmDigits[idx] && idx > 0) {
      confirmInputsRef.current[idx - 1]?.focus();
    }
  };

  const pin = digits.join("");
  const confirmPin = confirmDigits.join("");
  const disabled = isLoading || pin.length !== 4;
  const confirmDisabled = isLoading || confirmPin.length !== 4;
  const pinsMatch = pin === confirmPin && pin.length === 4;

  if (!open) return null;

  const handleCreatePin = async () => {
    if (pin.length !== 4) return;
    
    // Clear any previous errors
    setError(null);
    
    // Move to confirmation step
    setStep('confirm');
    setConfirmDigits(["", "", "", ""]);
    setTimeout(() => confirmInputsRef.current[0]?.focus(), 100);
  };

  const handleConfirmPin = async () => {
    if (!pinsMatch) return;
    
    const bearerToken = cookies.get("jwt");
    if (!bearerToken) {
      setError("Authentication required. Please log in again.");
      toast({
        title: "Authentication Error",
        description: "Please log in again to create your wallet.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get user ID from stored user data
      const userDataString = cookies.get("user") || localStorage.getItem("user");
      if (!userDataString) {
        throw new Error("User data not found. Please log in again.");
      }
      
      let userId: string;
      try {
        const userData = JSON.parse(userDataString);
        userId = userData.id;
        if (!userId) {
          throw new Error("User ID not found in user data.");
        }
      } catch (parseError) {
        throw new Error("Invalid user data. Please log in again.");
      }

      // Call API route to create wallet and surface response
      const res = await fetch('/api/chipi/create-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptKey: pin, externalUserId: userId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Create wallet failed');
      }

      // Success! Surface response details and keep modal open so you can see it
      const result = data?.data || {};
      console.log('Create wallet result:', result);
      toast({
        title: "Wallet Created Successfully!",
        description: ``,
        variant: "default",
      });
      
      // Sync wallet address to backend user profile
      try {
        if (result?.walletPublicKey) {
          await api.user.walletSync(result.walletPublicKey as string, bearerToken);
        }
      } catch (e) {
        // Non-fatal: continue even if sync fails; UI state will still update via onSuccess
      }
      
      // Optional: if caller wants to react, they can pass onSuccess. Otherwise, keep modal open
      if (onSuccess && result?.walletPublicKey) {
        onSuccess(result.walletPublicKey as string);
      }
    } catch (error) {
      let errorMessage = "Failed to create wallet. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('Authentication')) {
          errorMessage = "Authentication failed. Please log in again.";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('User ID')) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      toast({
        title: "Wallet Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg max-w-sm w-full">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {step === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0"><X className="h-5 w-5" /></Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {step === 'create' 
              ? "This PIN protects your wallet. You'll use it to access your account."
              : "Please enter your PIN again to confirm."
            }
          </p>

          {step === 'create' && (
          <div className="flex items-center justify-between gap-2">
            {digits.map((d, i) => (
              <Input
                key={i}
                  ref={setInputRef(i)}
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck={false}
                name={`pin-${i}`}
                maxLength={1}
                value={d}
                onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-12 h-12 text-center text-lg"
              />
            ))}
          </div>
          )}

          {step === 'confirm' && (
            <>
              <div className="flex items-center justify-between gap-2">
                {confirmDigits.map((d, i) => (
                  <Input
                    key={i}
                    ref={setConfirmInputRef(i)}
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    autoCorrect="off"
                    spellCheck={false}
                    name={`confirm-pin-${i}`}
                    maxLength={1}
                    value={d}
                    onChange={(e) => setConfirmDigit(i, e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => handleConfirmKeyDown(i, e)}
                    className={`w-12 h-12 text-center text-lg ${!pinsMatch && confirmPin.length === 4 ? 'border-red-500' : ''}`}
                  />
                ))}
              </div>
              
              {!pinsMatch && confirmPin.length === 4 && (
                <p className="text-xs text-red-500 text-center">PINs don&apos;t match. Please try again.</p>
              )}
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            {step === 'confirm' && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep('create');
                  setConfirmDigits(["", "", "", ""]);
                  setTimeout(() => inputsRef.current[0]?.focus(), 100);
                }}
              >
                Back
              </Button>
            )}
            
            <Button
              className={step === 'confirm' ? 'flex-1' : 'w-full'}
              disabled={step === 'create' ? disabled : confirmDisabled || !pinsMatch || isLoading}
              onClick={step === 'create' ? handleCreatePin : handleConfirmPin}
            >
              {isLoading
                ? "Creating..." 
                : step === 'create' 
                  ? "Continue" 
                  : "Create Wallet"
              }
          </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


