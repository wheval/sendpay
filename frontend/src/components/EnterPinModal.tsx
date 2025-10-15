"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface EnterPinModalProps {
  open: boolean;
  onClose: () => void;
  onPinEntered: (pin: string) => void;
  title?: string;
  description?: string;
}

export function EnterPinModal({ 
  open, 
  onClose, 
  onPinEntered,
  title = "Enter your PIN",
  description = "Please enter your PIN to authorize this transaction."
}: EnterPinModalProps) {
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

  const handleEnterPin = () => {
    if (pin.length !== 4) return;

    // Simply return the PIN to the parent component
    onPinEntered(pin);
    onClose();
    setDigits(["", "", "", ""]);
    setError("");
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
      <div className="bg-background rounded-lg max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
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
            disabled={pin.length !== 4}
            onClick={handleEnterPin}
          >
            Enter PIN
          </Button>
        </div>
      </div>
    </div>
  );
}
