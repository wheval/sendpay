import { hash, ec } from 'starknet';
import crypto from 'crypto';

interface WithdrawalRequest {
  user: string;
  amount: string;
  token: string;
  tx_ref: string;
  nonce: string;
  timestamp: number;
}

interface WithdrawalSignature {
  r: string;
  s: string;
}

export class SignatureService {
  private starkPrivateKey: string;
  private starkPublicKey: string;
  private domainVersion: string;
  private domainPurpose: string;
  private contractAddressFelt: string;
  private chainIdFelt: string;

  constructor() {
    // Stark curve private key (hex string, without 0x or with 0x accepted)
    const pk = (process.env.SENDPAY_BACKEND_PRIVATE_KEY || '').replace(/^0x/, '');
    if (!pk) throw new Error('SENDPAY_BACKEND_PRIVATE_KEY not configured');
    this.starkPrivateKey = pk;
    // Derive public key felt for contract set_backend_public_key
    this.starkPublicKey = '0x' + ec.starkCurve.getStarkKey(this.starkPrivateKey);

    // Domain selectors must match contract
    this.domainVersion = hash.getSelectorFromName('SENDPAY_V1');
    this.domainPurpose = hash.getSelectorFromName('WITHDRAWAL_REQUEST');

    // Contract address and chain id for hashing
    const contractAddr = (process.env.SENDPAY_CONTRACT_ADDRESS || '0x0').toLowerCase();
    this.contractAddressFelt = this.toFelt252(contractAddr);

    // Chain id felt matching contract storage
    const envChain = (process.env.STARKNET_CHAIN_ID || 'SN_SEPOLIA').toUpperCase();
    // SN_MAIN = 0x534e5f4d41494e, SN_SEPOLIA = 0x534e5f5345504f4c4941
    this.chainIdFelt = envChain.includes('MAIN') ? '0x534e5f4d41494e' : '0x534e5f5345504f4c4941';
  }

  /**
   * Generate ECDSA signature for withdrawal request
   */
  async signWithdrawalRequest(request: WithdrawalRequest): Promise<WithdrawalSignature> {
    try {
      const messageHash = this.hashWithdrawalRequest(request);
      const sig = ec.starkCurve.sign(messageHash, this.starkPrivateKey);
      return {
        r: '0x' + sig.r.toString(16),
        s: '0x' + sig.s.toString(16)
      };
    } catch (error: any) {
      console.error('Signature generation error:', error);
      throw new Error(`Failed to generate signature: ${error.message}`);
    }
  }

  /**
   * Hash withdrawal request using Poseidon (matching contract implementation)
   */
  private hashWithdrawalRequest(request: WithdrawalRequest): string {
    try {
      // Convert all values to felt252 format (hex strings)
      const userFelt = this.toFelt252(request.user);
      const amountFelt = this.toFelt252(request.amount);
      const tokenFelt = this.toFelt252(request.token);
      const txRefFelt = this.toFelt252(request.tx_ref);
      const nonceFelt = this.toFelt252(request.nonce);

      // Hash with domain separation and without timestamp (matches contract)
      const messageHash = hash.computePoseidonHashOnElements([
        this.domainVersion,
        this.domainPurpose,
        this.contractAddressFelt,
        this.chainIdFelt,
        userFelt,
        amountFelt,
        tokenFelt,
        txRefFelt,
        nonceFelt
      ]);

      return messageHash;
    } catch (error: any) {
      console.error('Hash generation error:', error);
      throw new Error(`Failed to hash withdrawal request: ${error.message}`);
    }
  }

  /**
   * Convert value to felt252 format (hex string)
   */
  private toFelt252(value: string | number): string {
    // Numeric input
    if (typeof value === 'number') {
      return '0x' + value.toString(16);
    }

    // Hex string passthrough
    if (value.startsWith('0x')) return value;

    // Decimal numeric string → numeric hex
    if (/^\d+$/.test(value)) {
      const n = BigInt(value);
      return '0x' + n.toString(16);
    }

    // Fallback: UTF-8 string to hex
    return '0x' + Buffer.from(value).toString('hex');
  }

  /**
   * Verify signature (for testing)
   */
  async verifySignature(
    request: WithdrawalRequest, 
    signature: WithdrawalSignature
  ): Promise<boolean> {
    try {
      const messageHash = this.hashWithdrawalRequest(request);
      const r = BigInt(signature.r);
      const s = BigInt(signature.s);
      const sigHex = '0x' + r.toString(16).padStart(64, '0') + s.toString(16).padStart(64, '0');
      return ec.starkCurve.verify(sigHex, messageHash, this.starkPublicKey);
    } catch (error: any) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Get public key for contract setup
   */
  getPublicKey(): string {
    return this.starkPublicKey;
  }

  /**
   * Generate transaction reference from bank details
   */
  generateTransactionReference(bankDetails: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  }): string {
    try {
      // Create a unique reference from bank details
      const data = `${bankDetails.accountNumber}-${bankDetails.bankCode}-${bankDetails.accountName}`;
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      return '0x' + hash;
    } catch (error: any) {
      console.error('Transaction reference generation error:', error);
      throw new Error(`Failed to generate transaction reference: ${error.message}`);
    }
  }

  /**
   * Sign settlement proof for withdrawal completion
   */
  async signSettlementProof(settlementData: {
    fiat_tx_hash: string;
    settled_amount: string;
    timestamp: number;
  }): Promise<string> {
    try {
      // Basic proof: return a deterministic hash as felt (no on-chain verify yet)
      const messageData = `${settlementData.fiat_tx_hash}-${settlementData.settled_amount}-${settlementData.timestamp}`;
      const messageHash = crypto.createHash('sha256').update(messageData).digest('hex');
      return '0x' + messageHash;
    } catch (error: any) {
      console.error('Settlement proof signature error:', error);
      throw new Error(`Failed to sign settlement proof: ${error.message}`);
    }
  }
}

export const signatureService = new SignatureService();
