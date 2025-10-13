import { User } from '../models/User';
import starknetService from './starknet.service';

export class ChipiPayService {
  /**
   * Sync wallet information to user profile (public data only)
   */
  async syncWallet(userId: string, walletAddress: string, publicKey: string) {
    try {
      const updateData: any = {
        chipiWalletAddress: walletAddress,
        chipiPublicKey: publicKey
      };

      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      return {
        success: true,
        walletAddress: user.chipiWalletAddress,
        publicKey: user.chipiPublicKey
      };
    } catch (error: any) {
      console.error('ChipiPay sync error:', error);
      throw new Error(`Failed to sync wallet: ${error.message}`);
    }
  }

  /**
   * Get wallet backup is not supported on server. Use client-side Chipi SDK.
   */
  async getWalletBackup(userId: string) {
    try {
      throw new Error('Server-side wallet backup is not supported.');
    } catch (error: any) {
      console.error('ChipiPay backup error:', error);
      throw new Error(`Failed to get wallet backup: ${error.message}`);
    }
  }

  /**
   * Get wallet balance using Starknet service
   */
  async getWalletBalance(walletAddress: string, tokenAddress?: string) {
    try {
      if (tokenAddress) {
        // Handle STRK (native token) differently
        if (tokenAddress === '0x0' || tokenAddress === 'STRK') {
          const strkAddress = starknetService.getSTRKAddress();
          const { balance, formatted } = await starknetService.getErc20Balance(walletAddress, strkAddress, 18);
          return { success: true, balance, formatted, tokenAddress: 'STRK' };
        }
        
        // Handle other ERC-20 tokens - determine decimals based on token
        let decimals = 18; // Default to 18 decimals
        
        // Check if it's USDC by comparing with known USDC address
        const usdcAddress = starknetService.getUSDCAddress();
        if (tokenAddress.toLowerCase() === usdcAddress.toLowerCase()) {
          decimals = 6;
        }
        
        const { balance, formatted } = await starknetService.getErc20Balance(walletAddress, tokenAddress, decimals);
        return { success: true, balance, formatted, tokenAddress };
      }
      
      // Default to USDC if no token specified
      const usdcAddress = starknetService.getUSDCAddress();
      const { balance, formatted } = await starknetService.getErc20Balance(walletAddress, usdcAddress, 6);
      return { success: true, balance, formatted, tokenAddress: usdcAddress };
    } catch (error: any) {
      console.error('ChipiPay balance error:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  // No server-side derivation or key handling
}

export const chipiPayService = new ChipiPayService();
