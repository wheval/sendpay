"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.starknetService = void 0;
const starknet_1 = require("starknet");
class StarknetService {
    constructor() {
        this.contract = null;
        this.config = {
            rpcUrl: process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7',
            chainId: process.env.STARKNET_CHAIN_ID || 'SN_SEPOLIA',
            contractAddress: process.env.STARKNET_CONTRACT_ADDRESS || '0x0',
            usdcTokenAddress: process.env.USDC_TOKEN_ADDRESS || '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf56a5fc'
        };
        this.provider = new starknet_1.RpcProvider({
            nodeUrl: this.config.rpcUrl
        });
        this.initializeContract();
    }
    /**
     * Initialize the smart contract instance
     */
    async initializeContract() {
        try {
            if (this.config.contractAddress !== '0x0') {
                // Contract ABI would be imported here
                // For now, we'll create a basic contract instance
                this.contract = new starknet_1.Contract([], // ABI would go here
                this.config.contractAddress, this.provider);
                console.log('✅ Starknet contract initialized');
            }
        }
        catch (error) {
            console.warn('⚠️ Failed to initialize Starknet contract:', error);
        }
    }
    /**
     * Get USDC balance for a wallet address
     */
    async getUSDCBalance(walletAddress) {
        try {
            // USDC contract ABI for balanceOf function
            const usdcContract = new starknet_1.Contract([
                {
                    name: 'balanceOf',
                    type: 'function',
                    inputs: [{ name: 'account', type: 'felt' }],
                    outputs: [{ name: 'balance', type: 'Uint256' }],
                    state_mutability: 'view'
                }
            ], this.config.usdcTokenAddress, this.provider);
            const result = await usdcContract.balanceOf(walletAddress);
            const balance = starknet_1.uint256.uint256ToBN(result.balance);
            // USDC has 6 decimal places
            return Number(balance) / 1e6;
        }
        catch (error) {
            console.error('Error getting USDC balance:', error);
            return 0;
        }
    }
    /**
     * Get ERC-20 token balance for a wallet address
     */
    async getTokenBalance(walletAddress, tokenAddress, decimals = '18') {
        try {
            const tokenContract = new starknet_1.Contract([
                {
                    name: 'balanceOf',
                    type: 'function',
                    inputs: [{ name: 'account', type: 'felt' }],
                    outputs: [{ name: 'balance', type: 'Uint256' }],
                    state_mutability: 'view'
                }
            ], tokenAddress, this.provider);
            const result = await tokenContract.balanceOf(walletAddress);
            const balance = starknet_1.uint256.uint256ToBN(result.balance);
            const dec = Number(decimals || '18');
            return Number(balance) / Math.pow(10, dec);
        }
        catch (error) {
            console.error('Error getting token balance:', error);
            return 0;
        }
    }
    /**
     * Get transaction status
     */
    async getTransactionStatus(txHash) {
        try {
            const tx = await this.provider.getTransactionReceipt(txHash);
            // Handle different transaction receipt types
            let status = 'pending';
            let blockNumber;
            if ('status' in tx) {
                status = tx.status;
            }
            if ('block_number' in tx) {
                blockNumber = tx.block_number;
            }
            return {
                hash: txHash,
                status,
                blockNumber,
                timestamp: Date.now() // Starknet doesn't provide timestamp in receipt
            };
        }
        catch (error) {
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
    async listenForEvents(eventName, callback) {
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
        }
        catch (error) {
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
        }
        catch (error) {
            console.error('Error getting network info:', error);
            return null;
        }
    }
    /**
     * Validate wallet address
     */
    isValidAddress(address) {
        try {
            // Basic Starknet address validation
            return /^0x[0-9a-fA-F]{63}$/.test(address);
        }
        catch {
            return false;
        }
    }
    /**
     * Get contract address
     */
    getContractAddress() {
        return this.config.contractAddress;
    }
    /**
     * Get USDC token address
     */
    getUSDCAddress() {
        return this.config.usdcTokenAddress;
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.initializeContract();
    }
}
exports.starknetService = new StarknetService();
exports.default = exports.starknetService;
//# sourceMappingURL=starknetService.js.map