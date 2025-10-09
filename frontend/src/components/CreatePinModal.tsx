"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CryptoJS from "crypto-js";
import { Account, CallData, ec, hash, num, RpcProvider, stark, CairoCustomEnum, CairoOption, CairoOptionVariant, TypedData } from "starknet";
import { cookies } from "@/lib/cookies";
import { api } from "@/lib/api";
import { prepareCreation, createWallet as chipiCreateWallet } from "@/lib/chipipayClient";

interface CreatePinModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export function CreatePinModal({ open, onClose, userId }: CreatePinModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);

  const setInputRef = (index: number) => (el: HTMLInputElement | null): void => {
    inputsRef.current[index] = el;
  };

  useEffect(() => {
    if (open) {
      setDigits(["", "", "", ""]);
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg max-w-sm w-full">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Create your PIN</h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">×</Button>
          </div>

          <p className="text-xs text-muted-foreground">This PIN protects your wallet. You&apos;ll use it to access your account.</p>

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
                className="w-12 h-12 text-center text-lg"
              />
            ))}
          </div>

          <Button
            className="w-full"
            disabled={disabled}
            onClick={async () => {
              const bearerToken = cookies.get("jwt");
              if (!bearerToken) return;
              try {
                setIsLoading(true);
                const nodeUrl = process.env.NEXT_PUBLIC_STARKNET_NODE_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';

                // 1) Generate wallet keys (Argent X v0.4.0 compatible)
                const provider = new RpcProvider({ nodeUrl });
                const privateKeyAX = stark.randomAddress();
                const starkKeyPubAX = ec.starkCurve.getStarkKey(privateKeyAX);
                const accountClassHash = '0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f';
                const axSigner = new CairoCustomEnum({ Starknet: { pubkey: starkKeyPubAX } });
                const axGuardian = new CairoOption(CairoOptionVariant.None);
                const AXConstructorCallData = CallData.compile({ owner: axSigner, guardian: axGuardian });
                const publicKey = hash.calculateContractAddressFromHash(
                  starkKeyPubAX,
                  accountClassHash,
                  AXConstructorCallData,
                  0
                );
                const account = new Account(provider, publicKey, privateKeyAX);

                // 2) Prepare creation
                const { typeData, accountClassHash: accountClassHashResponse } = await prepareCreation(publicKey, bearerToken);

                // 3) Sign typed data
                const userSignature = await account.signMessage(typeData);

                // 4) Build deployment data
                const deploymentData = {
                  class_hash: accountClassHashResponse,
                  salt: starkKeyPubAX,
                  unique: `${num.toHex(0)}`,
                  calldata: AXConstructorCallData.map((v: any) => num.toHex(v)),
                };

                // 5) Encrypt private key with PIN
                const encryptedPrivateKey = CryptoJS.AES.encrypt(privateKeyAX, pin).toString();

                // 6) Finalize creation
                const exec = await chipiCreateWallet({
                  publicKey,
                  userSignature: {
                    r: (userSignature as any).r?.toString?.() || String((userSignature as any).r),
                    s: (userSignature as any).s?.toString?.() || String((userSignature as any).s),
                    recovery: (userSignature as any).recovery,
                  },
                  typeData,
                  encryptedPrivateKey,
                  deploymentData: {
                    ...deploymentData,
                    salt: `${deploymentData.salt}`,
                    calldata: deploymentData.calldata.map((d: any) => `${d}`),
                  },
                }, bearerToken);
                if (!exec.success) throw new Error('Wallet creation unsuccessful');

                // 7) Sync to backend profile (store only public info)
                await api.chipipay.walletSync(publicKey, publicKey, bearerToken);
                onClose();
                setDigits(["", "", "", ""]);
                window.location.reload();
              } catch {}
              finally { setIsLoading(false); }
            }}
          >
            {isLoading ? "Creating..." : "Create Wallet"}
          </Button>
        </div>
      </div>
    </div>
  );
}


