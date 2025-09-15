import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { starknetService } from '../services/starknet.service';
import { exchangeRateService } from '../services/exchange-rate.service';

const router = Router();

/**
 * GET /api/starknet/network-info
 * Get Starknet network information
 */
router.get('/network-info', async (req: Request, res: Response) => {
  try {
    const networkInfo = await starknetService.getNetworkInfo();
    
    if (!networkInfo) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get network information'
      });
    }

    res.json({
      success: true,
      message: 'Network information retrieved successfully',
      data: networkInfo
    });

  } catch (error: any) {
    console.error('Network info retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get network information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/starknet/balance/:address
 * Get USDC balance for a wallet address
 */
router.get('/balance/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!starknetService.isValidAddress(address)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Starknet address format'
      });
    }

    const balance = await starknetService.getUSDCBalance(address);
    const exchangeRate = await exchangeRateService.getUSDToNGNRate();
    const balanceNGN = await exchangeRateService.convertUSDToNGN(balance);

    res.json({
      success: true,
      message: 'Balance retrieved successfully',
      data: {
        address,
        balanceUSD: balance,
        balanceNGN,
        exchangeRate,
        tokenAddress: starknetService.getUSDCAddress()
      }
    });

  } catch (error: any) {
    console.error('Balance retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve balance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/starknet/transaction/:hash
 * Get transaction status by hash
 */
router.get('/transaction/:hash', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;

    if (!hash || hash.length !== 64) {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction hash format'
      });
    }

    const transaction = await starknetService.getTransactionStatus(hash);

    res.json({
      success: true,
      message: 'Transaction status retrieved successfully',
      data: transaction
    });

  } catch (error: any) {
    console.error('Transaction status retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transaction status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/starknet/withdraw
 * Initiate withdrawal to bank account (protected route)
 */
router.post('/withdraw', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { amount, bankAccountId, description } = req.body;
    const userId = req.user._id;

    if (!amount || !bankAccountId) {
      return res.status(400).json({
        success: false,
        message: 'Amount and bank account ID are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Check user balance
    if (req.user.balanceUSD < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Get exchange rate and convert to NGN
    const exchangeRate = await exchangeRateService.getUSDToNGNRate();
    const amountNGN = await exchangeRateService.convertUSDToNGN(amount);

    // In production, this would:
    // 1. Call the smart contract to initiate withdrawal
    // 2. Update user balance
    // 3. Create transaction record
    // 4. Integrate with Paystack/Flutterwave for fiat off-ramp

    // For MVP, we'll simulate the process
    const mockStarknetTxHash = `0x${Math.random().toString(16).substring(2, 34)}`;

    res.json({
      success: true,
      message: 'Withdrawal initiated successfully',
      data: {
        amountUSD: amount,
        amountNGN,
        exchangeRate,
        starknetTxHash: mockStarknetTxHash,
        estimatedArrival: '2-3 business days',
        status: 'pending'
      }
    });

  } catch (error: any) {
    console.error('Withdrawal initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate withdrawal',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/starknet/exchange-rate
 * Get current USD to NGN exchange rate
 */
router.get('/exchange-rate', async (req: Request, res: Response) => {
  try {
    const exchangeRate = await exchangeRateService.getExchangeRateInfo();

    res.json({
      success: true,
      message: 'Exchange rate retrieved successfully',
      data: exchangeRate
    });

  } catch (error: any) {
    console.error('Exchange rate retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve exchange rate',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/starknet/update-exchange-rate
 * Update exchange rate manually (admin function)
 */
router.post('/update-exchange-rate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rate } = req.body;

    if (!rate || rate <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid exchange rate is required'
      });
    }

    // In production, this would be an admin-only function
    // For MVP, we'll allow any authenticated user
    exchangeRateService.updateExchangeRate(rate);

    res.json({
      success: true,
      message: 'Exchange rate updated successfully',
      data: {
        newRate: rate,
        updatedAt: new Date()
      }
    });

  } catch (error: any) {
    console.error('Exchange rate update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update exchange rate',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/starknet/contract-address
 * Get deployed contract address
 */
router.get('/contract-address', async (req: Request, res: Response) => {
  try {
    const contractAddress = starknetService.getContractAddress();
    const usdcAddress = starknetService.getUSDCAddress();

    res.json({
      success: true,
      message: 'Contract addresses retrieved successfully',
      data: {
        mainContract: contractAddress,
        usdcToken: usdcAddress,
        network: 'Starknet Mainnet'
      }
    });

  } catch (error: any) {
    console.error('Contract address retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contract addresses',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export { router as starknetRoutes };
