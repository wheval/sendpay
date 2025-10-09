import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { chipiPayService } from '../services/chipipay.service';

const router = Router();

/**
 * @route   POST /api/chipipay/wallet/sync
 * @desc    Sync ChipiPay wallet information to user profile
 * @access  Private
 */
router.post('/wallet/sync', authenticateToken, async (req, res) => {
  try {
    const { walletAddress, publicKey } = req.body;
    const userId = req.user._id;

    if (!walletAddress || !publicKey) {
      return res.status(400).json({
        success: false,
        message: 'walletAddress and publicKey are required'
      });
    }

    const result = await chipiPayService.syncWallet(userId, walletAddress, publicKey);

    res.json({
      success: true,
      message: 'Wallet synced successfully',
      data: result
    });

  } catch (error: any) {
    console.error('Wallet sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync wallet',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/chipipay/wallet/backup
 * @desc    Get wallet backup (encrypted private key)
 * @access  Private (requires 2FA in production)
 */
router.get('/wallet/backup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    // TODO: Add 2FA verification here in production
    // const twoFactorVerified = await verifyTwoFactor(req.user, req.body.twoFactorCode);
    // if (!twoFactorVerified) {
    //   return res.status(401).json({ success: false, message: '2FA verification required' });
    // }

    const result = await chipiPayService.getWalletBackup(userId);

    res.json({
      success: true,
      message: 'Wallet backup retrieved successfully',
      data: result
    });

  } catch (error: any) {
    console.error('Wallet backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get wallet backup',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/chipipay/balance/:address
 * @desc    Get wallet balance for a specific address
 * @access  Public
 */
router.get('/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { tokenAddress } = req.query;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }

    const result = await chipiPayService.getWalletBalance(address, tokenAddress as string);

    res.json({
      success: true,
      data: {
        address,
        tokenAddress: tokenAddress || 'STRK',
        balance: result.balance,
        formatted: result.formatted
      }
    });

  } catch (error: any) {
    console.error('Balance check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get balance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export { router as chipiPayRoutes };
