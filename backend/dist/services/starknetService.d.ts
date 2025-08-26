import { IStarknetConfig, IStarknetTransaction } from '../types';
declare class StarknetService {
    private provider;
    private config;
    private contract;
    constructor();
    /**
     * Initialize the smart contract instance
     */
    private initializeContract;
    /**
     * Get USDC balance for a wallet address
     */
    getUSDCBalance(walletAddress: string): Promise<number>;
    /**
     * Get ERC-20 token balance for a wallet address
     */
    getTokenBalance(walletAddress: string, tokenAddress: string, decimals?: string): Promise<number>;
    /**
     * Get transaction status
     */
    getTransactionStatus(txHash: string): Promise<IStarknetTransaction>;
    /**
     * Listen for contract events
     */
    listenForEvents(eventName: string, callback: (event: unknown) => void): Promise<void>;
    /**
     * Get network information
     */
    getNetworkInfo(): Promise<{
        chainId: string;
        blockNumber: number;
        rpcUrl: string;
        contractAddress: string;
        usdcTokenAddress: string;
    } | null>;
    /**
     * Validate wallet address
     */
    isValidAddress(address: string): boolean;
    /**
     * Get contract address
     */
    getContractAddress(): string;
    /**
     * Get USDC token address
     */
    getUSDCAddress(): string;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<IStarknetConfig>): void;
}
export declare const starknetService: StarknetService;
export default starknetService;
//# sourceMappingURL=starknetService.d.ts.map