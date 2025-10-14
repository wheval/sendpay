import { ec } from 'elliptic';
import { hash } from 'starknet';
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
  private elliptic: ec;
  private privateKey: string;
  private publicKey: string;

  constructor() {
    this.elliptic = new ec('secp256k1');
    
    // Get private key from environment
    this.privateKey = process.env.SENDPAY_BACKEND_PRIVATE_KEY || '';
    this.publicKey = process.env.SENDPAY_BACKEND_PUBLIC_KEY || '';
    
    if (!this.privateKey) {
      throw new Error('SENDPAY_BACKEND_PRIVATE_KEY not configured');
    }
  }

  /**
   * Generate ECDSA signature for withdrawal request
   */
  async signWithdrawalRequest(request: WithdrawalRequest): Promise<WithdrawalSignature> {
    try {
      // Convert request to the format expected by the contract
      const messageHash = this.hashWithdrawalRequest(request);
      
      // Create key pair from private key
      const keyPair = this.elliptic.keyFromPrivate(this.privateKey, 'hex');
      
      // Sign the message hash
      const signature = keyPair.sign(messageHash);
      
      return {
        r: signature.r.toString('hex'),
        s: signature.s.toString('hex')
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
      const timestampFelt = this.toFelt252(request.timestamp.toString());

      // Use Poseidon hash (same as contract)
      const messageHash = hash.computePoseidonHashOnElements([
        userFelt,
        amountFelt,
        tokenFelt,
        txRefFelt,
        nonceFelt,
        timestampFelt
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
    if (typeof value === 'number') {
      return '0x' + value.toString(16);
    }
    
    // If it's already a hex string, return as is
    if (value.startsWith('0x')) {
      return value;
    }
    
    // Convert string to hex
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
      const keyPair = this.elliptic.keyFromPrivate(this.privateKey, 'hex');
      
      return keyPair.verify(messageHash, {
        r: signature.r,
        s: signature.s
      });
    } catch (error: any) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Get public key for contract setup
   */
  getPublicKey(): string {
    return this.publicKey;
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
      // Create message hash from settlement data
      const messageData = `${settlementData.fiat_tx_hash}-${settlementData.settled_amount}-${settlementData.timestamp}`;
      const messageHash = crypto.createHash('sha256').update(messageData).digest('hex');
      
      // Create key pair from private key
      const keyPair = this.elliptic.keyFromPrivate(this.privateKey, 'hex');
      
      // Sign the message hash
      const signature = keyPair.sign(messageHash);
      
      // Return signature as hex string
      return `${signature.r.toString('hex')}${signature.s.toString('hex')}`;
    } catch (error: any) {
      console.error('Settlement proof signature error:', error);
      throw new Error(`Failed to sign settlement proof: ${error.message}`);
    }
  }
}

export const signatureService = new SignatureService();
