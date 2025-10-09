import { TypedData } from 'starknet';

export interface PrepareCreationResponse {
  typeData: TypedData;
  accountClassHash: string;
}

export interface UserSignature {
  r: string;
  s: string;
  recovery?: number;
}

export interface DeploymentData {
  class_hash: string;
  salt: string;
  unique: string;
  calldata: string[];
}

const getApiBase = (): string =>
  process.env.NEXT_PUBLIC_CHIPI_API_BASE || 'https://api.chipipay.com';

const getApiKey = (): string => process.env.NEXT_PUBLIC_CHIPI_API_KEY || '';

export async function prepareCreation(publicKey: string, bearerToken: string): Promise<PrepareCreationResponse> {
  const res = await fetch(`${getApiBase()}/v1/chipi-wallets/prepare-creation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bearerToken}`,
      'x-api-key': getApiKey(),
    },
    body: JSON.stringify({ publicKey }),
  });
  if (!res.ok) throw new Error('Failed to prepare wallet creation');
  return res.json();
}

export async function createWallet(
  params: {
    publicKey: string;
    userSignature: UserSignature;
    typeData: TypedData;
    encryptedPrivateKey: string;
    deploymentData: DeploymentData;
  },
  bearerToken: string
) {
  const res = await fetch(`${getApiBase()}/v1/chipi-wallets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bearerToken}`,
      'x-api-key': getApiKey(),
    },
    body: JSON.stringify({
      apiPublicKey: getApiKey(),
      ...params,
    }),
  });
  if (!res.ok) throw new Error('Failed to create wallet');
  return res.json();
}


