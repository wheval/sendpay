export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001/api';

type Json = Record<string, unknown>;

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`

  const requestOptions: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  }

  if (options.body && (options.method === 'POST' || options.method === 'PUT')) {
    requestOptions.body = options.body
  }

  const res = await fetch(url, requestOptions);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // ChipiPay endpoints
  chipipay: {
    balance: (address: string, tokenAddress: string, token?: string) =>
      request(`/chipipay/balance/${address}?tokenAddress=${encodeURIComponent(tokenAddress)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    walletSync: (walletAddress: string, publicKey: string, token?: string) =>
      request('/chipipay/wallet/sync', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({ walletAddress, publicKey })
      }),
    walletBackup: async () => {
      throw new Error('Use client-side Chipi SDK for wallet backup.');
    }
  },
  
  // Auth endpoints
  auth: {
    login: (email: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    signup: (email: string, password: string) =>
      request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
    profile: (token?: string) =>
      request('/auth/profile', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    onboarding: (data: Json, token?: string) =>
      request('/auth/onboarding', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify(data)
      })
  },
  
  // User endpoints
  user: {
    profile: (token?: string) =>
      request('/user/profile', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    balance: (token?: string) =>
      request('/user/balance', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    bankAccounts: (token?: string) =>
      request('/user/bank-accounts', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    walletSync: (walletAddress: string, token?: string) =>
      request('/user/wallet-sync', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify({ walletAddress })
      })
  },
  
  // Payment endpoints
  payment: {
    receive: (data: Json, token?: string) =>
      request('/payment/receive', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify(data)
      }),
    requests: (token?: string) =>
      request('/payment/requests', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
  },
  
  // Transaction endpoints
  transaction: {
    history: (token?: string) =>
      request('/transaction/history', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    summary: (token?: string) =>
      request('/transaction/summary', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
  },

  // Flutterwave endpoints
  flutterwave: {
    banks: (token?: string) =>
      request('/flutterwave/banks', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }),
    addBank: (data: Json, token?: string) =>
      request('/flutterwave/bank/add', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify(data)
      }),
    verifyAccount: (data: Json, token?: string) =>
      request('/flutterwave/verify-account', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify(data)
      }),
    transfer: (data: Json, token?: string) =>
      request('/flutterwave/transfer', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify(data)
      })
  },
  
  // Starknet endpoints
  starknet: {
    withdraw: (data: Json, token?: string) =>
      request('/starknet/withdraw', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: JSON.stringify(data)
      })
  }
};


