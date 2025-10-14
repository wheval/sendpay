"use server";

import { chipiServerClient } from "@/lib/chipi-server-client";
import type { WalletData } from "@chipi-stack/types";
import { Call } from 'starknet';

export async function callAnyContractAction(args: {
  encryptKey: string;
  wallet: WalletData;
  contractAddress: string;
  calls: Call[];
}) {
  const { encryptKey, wallet, contractAddress, calls } = args;

  const result = await chipiServerClient.callAnyContract({
    params: {
      encryptKey,
      wallet,
      contractAddress,
      calls,
    },
  });

  return result;
}


