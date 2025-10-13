"use server";

import { chipiServerClient } from "@/lib/chipi-server-client";

export async function createWalletAction(encryptKey: string, externalUserId: string) {
  return chipiServerClient.createWallet({
    params: { encryptKey, externalUserId },
  });
}


