import { chipiServerClient } from "@/lib/chipi-server-client";

export async function getWalletAction(externalUserId: string) {
  return chipiServerClient.getWallet({
    externalUserId,
  });
}
