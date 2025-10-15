// PWBT Simulation Utility
// This file contains simulation logic for PWBT flow when Flutterwave is not available
// To remove simulation: delete this file and revert FundCryptoModal.tsx changes

interface SimulatedBalance {
  usdc: number;
  strk: number;
  timestamp: number;
}

interface SimulatedPwbtData {
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
  };
}

const SIMULATION_KEY = 'sendpay_pwbt_simulation';
const SIMULATION_BALANCE_KEY = 'sendpay_simulated_balance';

// Generate realistic bank details for simulation
export function generateSimulatedPwbtData(amountUSD: number, currency: string = 'NGN'): SimulatedPwbtData {
  const transactionId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fiat_tx_ref = `SP${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  
  // Generate realistic Nigerian bank account number (10 digits)
  const accountNumber = Math.floor(Math.random() * 9000000000) + 1000000000;
  
  const banks = [
    'Access Bank',
    'First Bank of Nigeria',
    'Guaranty Trust Bank',
    'United Bank for Africa',
    'Zenith Bank',
    'Stanbic IBTC Bank',
    'Fidelity Bank',
    'First City Monument Bank'
  ];
  
  const bankName = banks[Math.floor(Math.random() * banks.length)];
  
  // 15 minutes from now
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  
  return {
    transactionId,
    fiat_tx_ref,
    virtualAccount: {
      accountNumber: accountNumber.toString(),
      bankName,
      amount: Math.round(amountUSD * 1500), // Simulate 1500 NGN per USD
      currency,
      expiry,
      reference: fiat_tx_ref,
      narration: `SendPay Payment - ${fiat_tx_ref}`
    }
  };
}

// Add simulated balance to existing balance
export function addSimulatedBalance(token: 'USDC' | 'STRK', amount: number): void {
  const existing = getSimulatedBalance();
  const newBalance: SimulatedBalance = {
    ...existing,
    [token.toLowerCase() as keyof SimulatedBalance]: (existing[token.toLowerCase() as keyof SimulatedBalance] || 0) + amount,
    timestamp: Date.now()
  };
  localStorage.setItem(SIMULATION_BALANCE_KEY, JSON.stringify(newBalance));
  console.log('Added simulated balance:', { token, amount, newBalance });
}

// Get current simulated balance
export function getSimulatedBalance(): SimulatedBalance {
  try {
    const stored = localStorage.getItem(SIMULATION_BALANCE_KEY);
    if (!stored) return { usdc: 0, strk: 0, timestamp: 0 };
    
    const parsed = JSON.parse(stored);
    // Reset if older than 24 hours (simulation should be temporary)
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SIMULATION_BALANCE_KEY);
      return { usdc: 0, strk: 0, timestamp: 0 };
    }
    
    return parsed;
  } catch {
    return { usdc: 0, strk: 0, timestamp: 0 };
  }
}

// Apply simulated balance to existing balance
export function applySimulatedBalance(existingUsdc: string | null, existingStrk: string | null): {
  usdc: string;
  strk: string;
} {
  const simulated = getSimulatedBalance();
  const existingUsdcNum = parseFloat(existingUsdc || '0');
  const existingStrkNum = parseFloat(existingStrk || '0');
  
  const result = {
    usdc: (existingUsdcNum + simulated.usdc).toFixed(6),
    strk: (existingStrkNum + simulated.strk).toFixed(6)
  };
  
  console.log('Applying simulated balance:', { 
    existingUsdc, existingStrk, 
    simulated, 
    result 
  });
  
  return result;
}

// Clear simulation data (for easy removal)
export function clearSimulationData(): void {
  localStorage.removeItem(SIMULATION_KEY);
  localStorage.removeItem(SIMULATION_BALANCE_KEY);
}

// Check if simulation is active
export function isSimulationActive(): boolean {
  return localStorage.getItem(SIMULATION_KEY) === 'true';
}

// Enable/disable simulation
export function setSimulationActive(active: boolean): void {
  if (active) {
    localStorage.setItem(SIMULATION_KEY, 'true');
  } else {
    clearSimulationData();
  }
}
