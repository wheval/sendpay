import { RpcProvider, Account, Contract, cairo, uint256, CallData } from 'starknet';
import { IStarknetConfig, IStarknetTransaction } from '../types';
import { SENDPAY_ABI } from '../lib/sendpay_abi';

class StarknetService {
  private provider: RpcProvider;
  private config: IStarknetConfig;
  private contract: Contract | null = null;

  constructor() {
    this.config = {
      rpcUrl: process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7',
      chainId: process.env.STARKNET_CHAIN_ID || 'SN_SEPOLIA',
      contractAddress: process.env.SENDPAY_CONTRACT_ADDRESS || '0x05adeea982017c957b9671fe1f0870d83b60868d688dca39681b415493c3ae99',
      usdcTokenAddress: process.env.USDC_TOKEN_ADDRESS || '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf56a5fc'
    };

    this.provider = new RpcProvider({
      nodeUrl: this.config.rpcUrl
    });

    this.initializeContract();
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
   * Fallback ERC20 balance call using RPC directly.
   */
  public async getErc20Balance(accountAddress: string, tokenAddress: string, decimals: string | number = 18): Promise<{ balance: string; formatted: string }> {
    const addr = accountAddress.toLowerCase()
    const token = tokenAddress.toLowerCase()
    const dec = Number(decimals || 18)

    const calldata = [addr]
    const res = await this.provider.callContract({
      contractAddress: token,
      entrypoint: 'balanceOf',
      calldata
    })

    // Expect Uint256 { low, high } — support both return shapes (array or { result })
    const resultArray = Array.isArray(res) ? res : (res as any).result
    const [lowStr = '0x0', highStr = '0x0'] = (resultArray as string[]) || []
    const low = BigInt(lowStr)
    const high = BigInt(highStr)
    const value = (high << 128n) + low
    const denom = BigInt(10) ** BigInt(dec)
    const formatted = Number(value) / Number(denom)

    return { balance: value.toString(), formatted: formatted.toString() }
  }

  /**
   * Get USDC balance for a wallet address
   */
  async getUSDCBalance(walletAddress: string): Promise<number> {
    try {
      const tokenAddress = this.config.usdcTokenAddress
      const { formatted } = await this.getErc20Balance(walletAddress, tokenAddress, 6)
      return Number(formatted || '0') || 0
    } catch (error) {
      console.warn('Error getting USDC balance:', (error as any)?.message || error)
      return 0;
    }
  }

  /**
   * Get ERC-20 token balance for a wallet address
   */
  async getTokenBalance(walletAddress: string, tokenAddress: string, decimals: string = '18'): Promise<number> {
    try {
      const { formatted } = await this.getErc20Balance(walletAddress, tokenAddress, decimals)
      return Number(formatted || '0') || 0
    } catch (error) {
      console.warn('Error getting token balance:', (error as any)?.message || error)
      return 0;
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
   * Listen for contract events
   */
  async listenForEvents(eventName: string, callback: (event: unknown) => void) {
    try {
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }

      // This would be implemented based on the actual contract ABI
      // For now, we'll simulate event listening
      console.log(`Listening for ${eventName} events...`);
      
      // In a real implementation, you would:
      // 1. Subscribe to contract events
      // 2. Handle incoming events
      // 3. Call the callback function
      
    } catch (error) {
      console.error('Error listening for events:', error);
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
      return /^0x[0-9a-fA-F]{63}$/.test(address);
    } catch {
      return false;
    }
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
   * Update configuration
   */
  updateConfig(newConfig: Partial<IStarknetConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.initializeContract();
  }
}

export const starknetService = new StarknetService();
export default starknetService;
