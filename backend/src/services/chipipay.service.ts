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
        const balance = await starknetService.getTokenBalance(walletAddress, tokenAddress);
        return { success: true, balance: String(balance), formatted: String(balance), tokenAddress };
      }
      const usdcAddress = starknetService.getUSDCAddress();
      const balance = await starknetService.getTokenBalance(walletAddress, usdcAddress, '6');
      return { success: true, balance: String(balance), formatted: String(balance), tokenAddress: usdcAddress };
    } catch (error: any) {
      console.error('ChipiPay balance error:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  // No server-side derivation or key handling
}

export const chipiPayService = new ChipiPayService();
