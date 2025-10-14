import { RpcProvider, Account, Contract, cairo, uint256, CallData } from 'starknet';
import { IStarknetConfig, IStarknetTransaction } from '../types';
import { SENDPAY_ABI } from '../lib/sendpay_abi';
import { signatureService } from './signature.service';
import { getTokenConfig, STARKNET_NETWORK } from '../lib/constants';

class StarknetService {
  private provider: RpcProvider;
  private config: IStarknetConfig;
  private contract: Contract | null = null;
  private adminAccount: Account | null = null;

  constructor() {
    // Get token configs based on current network
    const usdcConfig = getTokenConfig('USDC');
    const strkConfig = getTokenConfig('STRK');
    
    this.config = {
      rpcUrl: process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7',
      chainId: process.env.STARKNET_CHAIN_ID || (STARKNET_NETWORK === 'mainnet' ? 'SN_MAIN' : 'SN_SEPOLIA'),
      contractAddress: process.env.SENDPAY_CONTRACT_ADDRESS || '0x0444d5c9b2a6375bdce805338cdf6340439be92aec2e854704e77bedcdfd929a',
      // Use constants for token addresses based on network
      usdcTokenAddress: process.env.USDC_TOKEN_ADDRESS || usdcConfig.address,
      strkTokenAddress: process.env.STRK_TOKEN_ADDRESS || strkConfig.address
    };

    this.provider = new RpcProvider({
      nodeUrl: this.config.rpcUrl
    });

    this.initializeContract();

    // Initialize admin signer (requires both address and private key)
    const adminAddress = process.env.SENDPAY_BACKEND_ADMIN_ADDRESS;
    const adminPrivateKey = process.env.SENDPAY_BACKEND_ADMIN_PRIVATE_KEY;
    if (adminAddress && adminPrivateKey) {
      try {
        this.adminAccount = new Account(this.provider, adminAddress, adminPrivateKey);
        console.log('🔐 Admin account initialized');
      } catch (err) {
        console.warn('⚠️ Failed to initialize admin account:', err);
      }
    } else {
      console.warn('⚠️ SENDPAY_BACKEND_ADMIN_ADDRESS or SENDPAY_BACKEND_ADMIN_PRIVATE_KEY not set; admin calls will fail with configuration errors.');
    }
  }

  /**
   * Initialize the smart contract instance
   */
  private async initializeContract() {
    try {
      if (this.config.contractAddress !== '0x0') {
        this.contract = new Contract(
          SENDPAY_ABI,
          this.config.contractAddress,
          this.provider
        );
        console.log('✅ Starknet contract initialized');
      }
    } catch (error) {
      console.warn('⚠️ Failed to initialize Starknet contract:', error);
    }
  }

  /**
   * ERC20 balance call using RPC directly.
   */
  public async getErc20Balance(accountAddress: string, tokenAddress: string, decimals: string | number = 18): Promise<{ balance: string; formatted: string }> {
    const addr = this.normalizeHex(accountAddress)
    const token = this.normalizeHex(tokenAddress)
    const dec = Number(decimals || 18)

    const calldata = [addr]
    const res = await this.provider.callContract({
      contractAddress: token,
      entrypoint: 'balanceOf',
      calldata
    }, 'latest' as any)

    // Expect Uint256 { low, high } — support both return shapes (array or { result })
    const resultArray = Array.isArray(res) ? res : (res as any)?.result
    const [lowStr = '0x0', highStr = '0x0'] = (resultArray as string[]) || []
    const low = BigInt(lowStr)
    const high = BigInt(highStr)
    const value = (high << 128n) + low
    const denom = BigInt(10) ** BigInt(dec)
    
    // Format as decimal string to avoid scientific notation
    const formatted = this.formatTokenAmount(value, dec)

    return { balance: value.toString(), formatted }
  }

  /**
   * Format token amount as decimal string to avoid scientific notation
   */
  private formatTokenAmount(amount: bigint, decimals: number): string {
    const divisor = BigInt(10) ** BigInt(decimals)
    const quotient = amount / divisor
    const remainder = amount % divisor
    
    if (remainder === 0n) {
      return quotient.toString()
    }
    
    // Convert remainder to decimal string with proper padding
    const remainderStr = remainder.toString().padStart(decimals, '0')
    const trimmedRemainder = remainderStr.replace(/0+$/, '') // Remove trailing zeros
    
    if (trimmedRemainder === '') {
      return quotient.toString()
    }
    
    return `${quotient}.${trimmedRemainder}`
  }

  /**
   * Get STRK balance for a wallet address
   */
  async getSTRKBalance(walletAddress: string): Promise<string> {
    try {
      const tokenAddress = this.config.strkTokenAddress;
      const { formatted } = await this.getErc20Balance(walletAddress, tokenAddress, 18);
      return formatted || '0';
    } catch (error) {
      console.warn('Error getting STRK balance:', (error as any)?.message || error);
      return '0';
    }
  }

  /**
   * Get USDC balance for a wallet address
   */
  async getUSDCBalance(walletAddress: string): Promise<string> {
    try {
      const tokenAddress = this.config.usdcTokenAddress;
      const { formatted } = await this.getErc20Balance(walletAddress, tokenAddress, 6);
      return formatted || '0';
    } catch (error) {
      console.warn('Error getting USDC balance:', (error as any)?.message || error);
      return '0';
    }
  }

  /**
   * Get ERC-20 token balance for a wallet address
   */
  async getTokenBalance(walletAddress: string, tokenAddress: string, decimals: string = '18'): Promise<string> {
    try {
      const { formatted } = await this.getErc20Balance(walletAddress, tokenAddress, decimals);
      return formatted || '0';
    } catch (error) {
      console.warn('Error getting token balance:', (error as any)?.message || error);
      return '0';
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<IStarknetTransaction> {
    try {
      const tx = await this.provider.getTransactionReceipt(txHash);
      
      // Handle different transaction receipt types
      let status: 'pending' | 'accepted' | 'rejected' = 'pending';
      let blockNumber: number | undefined;

      if ('status' in tx) {
        status = tx.status as 'pending' | 'accepted' | 'rejected';
      }
      
      if ('block_number' in tx && typeof (tx as any).block_number === 'number') {
        blockNumber = (tx as any).block_number as number;
      }

      return {
        hash: txHash,
        status,
        blockNumber,
        timestamp: Date.now() // Starknet doesn't provide timestamp in receipt
      };
    } catch (error) {
      console.error('Error getting transaction status:', error);
      return {
        hash: txHash,
        status: 'rejected'
      };
    }
  }


  /**
   * Get network information
   */
  async getNetworkInfo() {
    try {
      const chainId = await this.provider.getChainId();
      const blockNumber = await this.provider.getBlockNumber();
      
      return {
        chainId: chainId.toString(),
        blockNumber,
        rpcUrl: this.config.rpcUrl,
        contractAddress: this.config.contractAddress,
        usdcTokenAddress: this.config.usdcTokenAddress
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      return null;
    }
  }

  /**
   * Validate wallet address
   */
  isValidAddress(address: string): boolean {
    try {
      // Basic Starknet address validation
      return /^0x[0-9a-fA-F]{64}$/.test(address);
    } catch {
      return false;
    }
  }

  /**
   * Normalize to 0x + 64 lowercase hex
   */
  private normalizeHex(addr: string): string {
    if (!addr) return '0x0'.padEnd(66, '0')
    let clean = addr.toLowerCase().replace(/^0x/, '').replace(/[^0-9a-f]/g, '')
    if (clean.length > 64) clean = clean.slice(-64)
    if (clean.length < 64) clean = clean.padStart(64, '0')
    return '0x' + clean
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return this.config.contractAddress;
  }

  /**
   * Get USDC token address
   */
  getUSDCAddress(): string {
    return this.config.usdcTokenAddress;
  }

  /**
   * Get STRK token address
   */
  getSTRKAddress(): string {
    return this.config.strkTokenAddress;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IStarknetConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.initializeContract();
  }

  /**
   * Get user's current nonce from contract
   */
  public async getUserNonce(userAddress: string): Promise<string> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      const result = await this.contract.call('get_user_nonce', [userAddress]);
      return result.toString();
    } catch (error: any) {
      console.error('Error getting user nonce:', error);
      throw new Error(`Failed to get user nonce: ${error.message}`);
    }
  }

  /**
   * Create signature-based withdrawal request
   */
  public async createWithdrawalSignature(
    userAddress: string,
    amount: string,
    tokenAddress: string,
    bankDetails: {
      accountNumber: string;
      bankCode: string;
      accountName: string;
    }
  ): Promise<{
    request: any;
    signature: { r: string; s: string };
    nonce: string;
  }> {
    try {
      // Get user's current nonce
      const nonce = await this.getUserNonce(userAddress);
      
      // Generate transaction reference
      const txRef = signatureService.generateTransactionReference(bankDetails);
      
      // Create withdrawal request
      const request = {
        user: userAddress,
        amount: amount,
        token: tokenAddress,
        tx_ref: txRef,
        nonce: nonce,
        timestamp: Math.floor(Date.now() / 1000)
      };

      // Generate signature
      const signature = await signatureService.signWithdrawalRequest(request);

      return {
        request,
        signature,
        nonce
      };
    } catch (error: any) {
      console.error('Error creating withdrawal signature:', error);
      throw new Error(`Failed to create withdrawal signature: ${error.message}`);
    }
  }

  /**
   * Execute signature-based withdrawal (requires user to call from frontend)
   */
  public async executeWithdrawalWithSignature(
    userAccount: Account,
    request: any,
    signature: { r: string; s: string }
  ): Promise<IStarknetTransaction> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      // Prepare call data
      const callData = CallData.compile([
        request,
        signature.r,
        signature.s
      ]);

      // Execute withdrawal
      const result = await userAccount.execute({
        contractAddress: this.config.contractAddress,
        entrypoint: 'withdraw_with_signature',
        calldata: callData
      });

      return {
        hash: result.transaction_hash,
        status: 'pending'
      };
    } catch (error: any) {
      console.error('Error executing withdrawal:', error);
      throw new Error(`Failed to execute withdrawal: ${error.message}`);
    }
  }

  /**
   * Complete withdrawal with settlement proof (admin function)
   */
  public async completeWithdrawal(
    withdrawalId: string,
    settlementProof: {
      fiat_tx_hash: string;
      settled_amount: string;
      timestamp: number;
      backend_signature: string;
    }
  ): Promise<IStarknetTransaction> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }
      if (!this.adminAccount) {
        throw new Error('Admin account not configured. Set SENDPAY_BACKEND_ADMIN_ADDRESS and SENDPAY_BACKEND_ADMIN_PRIVATE_KEY environment variables.');
      }

      // Connect contract with admin signer
      const adminContract = new Contract(SENDPAY_ABI, this.config.contractAddress, this.adminAccount);

      // Call admin function (assuming fn exists in ABI)
      const call = await adminContract.complete_withdrawal_with_proof(
        cairo.uint256(withdrawalId),
        {
          fiat_tx_hash: settlementProof.fiat_tx_hash,
          settled_amount: cairo.uint256(settlementProof.settled_amount),
          timestamp: settlementProof.timestamp,
          backend_signature: settlementProof.backend_signature,
        }
      );

      return { hash: (call as any).transaction_hash || (call as any).hash || '0x0', status: 'pending' };
    } catch (error: any) {
      console.error('Error completing withdrawal:', error);
      throw new Error(`Failed to complete withdrawal: ${error.message}`);
    }
  }

  /**
   * Deposit and credit user (admin function)
   */
  public async depositAndCredit(
    userAddress: string,
    amount: string,
    fiatTxRef: string
  ): Promise<IStarknetTransaction> {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }
      if (!this.adminAccount) {
        throw new Error('Admin account not configured. Set SENDPAY_BACKEND_ADMIN_ADDRESS and SENDPAY_BACKEND_ADMIN_PRIVATE_KEY environment variables.');
      }

      const adminContract = new Contract(SENDPAY_ABI, this.config.contractAddress, this.adminAccount);
      const call = await adminContract.deposit_and_credit(
        userAddress,
        cairo.uint256(amount),
        fiatTxRef
      );

      return { hash: (call as any).transaction_hash || (call as any).hash || '0x0', status: 'pending' };
    } catch (error: any) {
      console.error('Error deposit and credit:', error);
      throw new Error(`Failed to deposit and credit: ${error.message}`);
    }
  }
}

export const starknetService = new StarknetService();
export default starknetService;
