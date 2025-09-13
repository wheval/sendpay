import axios, { AxiosInstance } from 'axios';
import { STARKNET_RPC_URL } from '../lib/constants';

export interface ApibaraConfig {
  apiKey?: string;
  baseUrl?: string;
  network: 'sepolia' | 'mainnet';
}

export interface EventFilter {
  contractAddress: string;
  eventName?: string;
  fromBlock?: number;
  toBlock?: number;
}

export interface TransactionFilter {
  walletAddress?: string;
  contractAddress?: string;
  fromBlock?: number;
  toBlock?: number;
  status?: 'ACCEPTED' | 'REJECTED' | 'PENDING';
}

export interface IndexedEvent {
  id: string;
  transaction_hash: string;
  block_number: number;
  block_timestamp: number;
  contract_address: string;
  event_name: string;
  event_data: Record<string, any>;
  log_index: number;
}

export interface IndexedTransaction {
  id: string;
  transaction_hash: string;
  block_number: number;
  block_timestamp: number;
  contract_address?: string;
  entry_point_selector?: string;
  calldata?: string[];
  status: string;
  gas_consumed?: number;
  gas_price?: number;
  max_fee?: number;
  nonce?: number;
  sender_address?: string;
  class_hash?: string;
  version?: string;
}

class ApibaraService {
  private client: AxiosInstance;
  private config: ApibaraConfig;
  private initialized = false;

  constructor() {
    this.config = {
      apiKey: process.env.APIBARA_API_KEY,
      baseUrl: process.env.APIBARA_BASE_URL || 'https://api.apibara.com',
      network: (process.env.STARKNET_NETWORK as 'sepolia' | 'mainnet') || 'sepolia'
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
      },
      timeout: 30000
    });
  }

  private initialize() {
    if (this.initialized) return;

    if (!this.config.apiKey) {
      console.warn('⚠️  Apibara API key not found. Some features may be limited.');
    }

    this.initialized = true;
  }

  /**
   * Get events from a specific contract
   */
  async getEvents(filter: EventFilter): Promise<IndexedEvent[]> {
    this.initialize();

    try {
      const response = await this.client.post('/v1/starknet/events', {
        network: this.config.network,
        filter: {
          contract_address: filter.contractAddress,
          event_name: filter.eventName,
          from_block: filter.fromBlock,
          to_block: filter.toBlock
        }
      });

      return response.data.events || [];
    } catch (error: any) {
      console.error('Apibara getEvents error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch events: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get transactions for a wallet or contract
   */
  async getTransactions(filter: TransactionFilter): Promise<IndexedTransaction[]> {
    this.initialize();

    try {
      const response = await this.client.post('/v1/starknet/transactions', {
        network: this.config.network,
        filter: {
          wallet_address: filter.walletAddress,
          contract_address: filter.contractAddress,
          from_block: filter.fromBlock,
          to_block: filter.toBlock,
          status: filter.status
        }
      });

      return response.data.transactions || [];
    } catch (error: any) {
      console.error('Apibara getTransactions error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch transactions: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get USDC transfers for a specific address
   */
  async getUSDCTransfers(address: string, fromBlock?: number, toBlock?: number): Promise<IndexedEvent[]> {
    const USDC_CONTRACT = process.env.USDC_TESTNET_ADDRESS || '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080';
    
    return this.getEvents({
      contractAddress: USDC_CONTRACT,
      eventName: 'Transfer',
      fromBlock,
      toBlock
    });
  }

  /**
   * Get SendPay contract events
   */
  async getSendPayEvents(eventName?: string, fromBlock?: number, toBlock?: number): Promise<IndexedEvent[]> {
    const SENDPAY_CONTRACT = process.env.SENDPAY_CONTRACT_ADDRESS || '0x05adeea982017c957b9671fe1f0870d83b60868d688dca39681b415493c3ae99';
    
    return this.getEvents({
      contractAddress: SENDPAY_CONTRACT,
      eventName,
      fromBlock,
      toBlock
    });
  }

  /**
   * Get latest block number
   */
  async getLatestBlock(): Promise<number> {
    this.initialize();

    try {
      const response = await this.client.get(`/v1/starknet/${this.config.network}/blocks/latest`);
      return response.data.block_number;
    } catch (error: any) {
      console.error('Apibara getLatestBlock error:', error.response?.data || error.message);
      throw new Error(`Failed to get latest block: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get block information
   */
  async getBlock(blockNumber: number): Promise<any> {
    this.initialize();

    try {
      const response = await this.client.get(`/v1/starknet/${this.config.network}/blocks/${blockNumber}`);
      return response.data;
    } catch (error: any) {
      console.error('Apibara getBlock error:', error.response?.data || error.message);
      throw new Error(`Failed to get block: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(transactionHash: string): Promise<any> {
    this.initialize();

    try {
      const response = await this.client.get(`/v1/starknet/${this.config.network}/transactions/${transactionHash}`);
      return response.data;
    } catch (error: any) {
      console.error('Apibara getTransaction error:', error.response?.data || error.message);
      throw new Error(`Failed to get transaction: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get token balance for a specific address
   */
  async getTokenBalance(address: string, tokenAddress: string): Promise<string> {
    this.initialize();

    try {
      const response = await this.client.get(`/v1/starknet/${this.config.network}/tokens/${tokenAddress}/balance/${address}`);
      return response.data.balance;
    } catch (error: any) {
      console.error('Apibara getTokenBalance error:', error.response?.data || error.message);
      throw new Error(`Failed to get token balance: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Subscribe to real-time events (WebSocket)
   */
  async subscribeToEvents(filter: EventFilter, callback: (event: IndexedEvent) => void): Promise<void> {
    this.initialize();

    // Note: This would require WebSocket implementation
    // For now, we'll use polling as a fallback
    console.log('Apibara real-time subscription not implemented yet. Using polling fallback.');
    
    // Poll for new events every 10 seconds
    setInterval(async () => {
      try {
        const latestBlock = await this.getLatestBlock();
        const events = await this.getEvents({
          ...filter,
          fromBlock: latestBlock - 1,
          toBlock: latestBlock
        });
        
        events.forEach(callback);
      } catch (error) {
        console.error('Error polling for events:', error);
      }
    }, 10000);
  }

  /**
   * Get transaction history for a wallet
   */
  async getWalletHistory(walletAddress: string, limit = 50): Promise<IndexedTransaction[]> {
    return this.getTransactions({
      walletAddress,
      fromBlock: undefined,
      toBlock: undefined
    });
  }

  /**
   * Check if a transaction is confirmed
   */
  async isTransactionConfirmed(transactionHash: string): Promise<boolean> {
    try {
      const transaction = await this.getTransaction(transactionHash);
      return transaction.status === 'ACCEPTED';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get gas price estimate
   */
  async getGasPrice(): Promise<number> {
    this.initialize();

    try {
      const response = await this.client.get(`/v1/starknet/${this.config.network}/gas-price`);
      return response.data.gas_price;
    } catch (error: any) {
      console.error('Apibara getGasPrice error:', error.response?.data || error.message);
      // Return a fallback gas price
      return 1000000000; // 1 gwei
    }
  }
}

export const apibaraService = new ApibaraService();

