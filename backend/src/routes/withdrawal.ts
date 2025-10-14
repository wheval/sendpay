import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { starknetService } from '../services/starknet.service';
import { flutterwaveService } from '../services/flutterwave.service';
import { signatureService } from '../services/signature.service';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { BankAccount } from '../models/BankAccount';
import { generateReference } from '../utils/helpers';
import { getTokenConfig } from '../lib/constants';
import { exchangeRateService } from '../services/exchange-rate.service';

const router = Router();

/**
 * @route   POST /api/withdrawal/signature
 * @desc    Get signature for withdrawal request (step 1 of signature-based flow)
 * @access  Private
 */
router.post('/signature', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { amount, tokenAddress, bankAccountId, token } = req.body;
    console.log('[withdrawal.signature] payload', { amount, tokenAddress, bankAccountId, token });
    const userId = req.user._id;

    // Validate required fields
    if (!amount || !tokenAddress || !bankAccountId) {
      return res.status(400).json({
        success: false,
        message: 'Amount, token address, and bank account ID are required'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Get user's wallet address
    const userWalletAddress = req.user.chipiWalletAddress;
    console.log('[withdrawal.signature] user', { userId, userWalletAddress });
    if (!userWalletAddress) {
      return res.status(400).json({
        success: false,
        message: 'User wallet not configured'
      });
    }

    // Get bank account details
    const bankAccount = await BankAccount.findOne({
      _id: bankAccountId,
      userId: userId
    });

    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    // Check user balance (respect correct decimals for token)
    const decimals = (() => {
      try {
        if (token === 'USDC') return '6';
        if (token === 'STRK') return '18';
        // Fallback: derive from constants if address matches
        const usdcCfg = getTokenConfig('USDC');
        const strkCfg = getTokenConfig('STRK');
        const addr = String(tokenAddress || '').toLowerCase();
        if (addr === usdcCfg.address.toLowerCase()) return String(usdcCfg.decimals);
        if (addr === strkCfg.address.toLowerCase()) return String(strkCfg.decimals);
      } catch {}
      return '18';
    })();
    const balanceResult = await starknetService.getTokenBalance(userWalletAddress, tokenAddress, decimals);
    const currentBalance = Number(balanceResult || 0);
    console.log('[withdrawal.signature] balance check', { decimals, balanceResult, currentBalance, requestedAmount: amount });

    if (currentBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Create withdrawal signature (amount must be in smallest units - u256)
    const decimalsNum = parseInt(decimals, 10) || 18;
    const amountUint = Math.round(Number(amount) * Math.pow(10, decimalsNum)).toString();
    console.log('[withdrawal.signature] amount uint conversion', { decimalsNum, amount, amountUint });
    const withdrawalData = await starknetService.createWithdrawalSignature(
      userWalletAddress,
      amountUint,
      tokenAddress,
      {
        accountNumber: bankAccount.accountNumber,
        bankCode: bankAccount.bankCode,
        accountName: bankAccount.accountName
      }
    );

    // FX rate snapshot (optional; used for display/audit)
    let fxRateUsed: number = 0;
    try {
      const fx = await exchangeRateService.getExchangeRateInfo();
      fxRateUsed = Number(fx?.rate) || 0; // same source used by frontend summary
    } catch {}

    // Create transaction record
    const transaction = new Transaction({
      userId,
      flow: 'offramp',
      status: 'signed',
      amountUSD: parseFloat(amount),
      amountNGN: 0, // Will be calculated when processing
      description: `Withdrawal created for ${amount} tokens`,
      reference: generateReference(),
      starknetTxHash: null, // Will be set when executed
      metadata: {
        tokenAddress,
        bankAccountId,
        request: withdrawalData.request,
        signature: withdrawalData.signature,
        nonce: withdrawalData.nonce,
        txRef: withdrawalData.request.tx_ref,
        signatureStatus: 'signature_created',
        tokenSymbol: token,
        userWalletAddress,
        decimals: String(decimalsNum),
        amountUint,
        fxRateUsed
      }
    });

    await transaction.save();

    res.json({
      success: true,
      message: 'Withdrawal signature created successfully',
      data: {
        transactionId: transaction._id,
        request: withdrawalData.request,
        signature: withdrawalData.signature,
        nonce: withdrawalData.nonce,
        amountUint,
        decimals: String(decimalsNum),
        bankAccount: {
          accountNumber: bankAccount.accountNumber,
          bankName: bankAccount.bankName,
          accountName: bankAccount.accountName
        },
        amount,
        tokenAddress,
        tokenSymbol: token,
        fxRateUsed,
        instructions: {
          step1: 'Call withdraw_with_signature on the contract with the provided request and signature',
          step2: 'Wait for WithdrawalCreated event',
          step3: 'Backend will automatically process fiat payout via Flutterwave'
        }
      }
    });

  } catch (error: any) {
    console.error('Withdrawal signature creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create withdrawal signature',
      error: process.env.NODE_ENV !== 'production' ? (error?.message || String(error)) : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/withdrawal/execute
 * @desc    Execute withdrawal on contract (step 2 - frontend calls this after getting signature)
 * @access  Private
 */
router.post('/execute', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { transactionId, request, signature } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!transactionId || !request || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID, request, and signature are required'
      });
    }

    // Get transaction record
    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: userId,
      flow: 'offramp'
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.metadata?.signatureStatus !== 'signature_created') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is not in the correct state for execution'
      });
    }

    // Update transaction status
    transaction.metadata = {
      ...transaction.metadata,
      signatureStatus: 'contract_executed'
    };
    transaction.status = 'submitted_onchain';
    transaction.starknetTxHash = 'pending'; // Will be updated when we get the actual hash
    await transaction.save();

    res.json({
      success: true,
      message: 'Withdrawal execution initiated',
      data: {
        transactionId: transaction._id,
        status: 'contract_executed',
        nextStep: 'Wait for WithdrawalCreated event and automatic fiat processing'
      }
    });

  } catch (error: any) {
    console.error('Withdrawal execution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute withdrawal',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/withdrawal/status/:transactionId
 * @desc    Get withdrawal status
 * @access  Private
 */
router.get('/status/:transactionId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      userId: userId
    }).populate('userId');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: {
        transactionId: transaction._id,
        status: transaction.status,
        amountUSD: transaction.amountUSD,
        amountNGN: transaction.amountNGN,
        description: transaction.description,
        reference: transaction.reference,
        starknetTxHash: transaction.starknetTxHash,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        metadata: transaction.metadata
      }
    });

  } catch (error: any) {
    console.error('Withdrawal status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get withdrawal status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/withdrawal/history
 * @desc    Get user's withdrawal history
 * @access  Private
 */
router.get('/history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const transactions = await Transaction.find({
      userId: userId,
      flow: 'offramp'
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit as string) * 1)
    .skip((parseInt(page as string) - 1) * parseInt(limit as string))
    .select('-metadata'); // Exclude large metadata field for list view

    const total = await Transaction.countDocuments({
      userId: userId,
      flow: 'offramp'
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          current: parseInt(page as string),
          pages: Math.ceil(total / parseInt(limit as string)),
          total
        }
      }
    });

  } catch (error: any) {
    console.error('Withdrawal history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get withdrawal history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/withdrawal/complete
 * @desc    Complete withdrawal with settlement proof (admin function - called by event handler)
 * @access  Private (admin only)
 */
router.post('/complete', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { withdrawalId, fiatTxHash, settledAmount } = req.body;

    // This endpoint should only be called by internal services (webhook handlers)
    // NOT by frontend users - it's for completing withdrawals after Flutterwave confirms payment
    // The backend admin is configured via ADMIN_ACCOUNT_ADDRESS env var for contract calls

    if (!withdrawalId || !fiatTxHash || !settledAmount) {
      return res.status(400).json({
        success: false,
        message: 'Withdrawal ID, fiat transaction hash, and settled amount are required'
      });
    }

    // Generate settlement proof with real signature
    const settlementData = {
      fiat_tx_hash: fiatTxHash,
      settled_amount: settledAmount,
      timestamp: Math.floor(Date.now() / 1000)
    };

    const settlementSignature = await signatureService.signSettlementProof(settlementData);

    const settlementProof = {
      ...settlementData,
      backend_signature: settlementSignature
    };

    // Complete withdrawal on contract
    const result = await starknetService.completeWithdrawal(withdrawalId, settlementProof);

    // Update transaction record
    const existingTransaction = await Transaction.findOne({ 
      'metadata.withdrawalId': withdrawalId
    });

    if (!existingTransaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    const updatedTransaction = await Transaction.findByIdAndUpdate(
      existingTransaction._id,
      {
        status: 'completed',
        starknetTxHash: result.hash,
        metadata: {
          ...existingTransaction.metadata,
          settlementProof,
          completedAt: new Date()
        }
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Withdrawal completed successfully',
      data: {
        withdrawalId,
        settlementProof,
        contractTxHash: result.hash,
        transactionId: updatedTransaction?._id
      }
    });

  } catch (error: any) {
    console.error('Withdrawal completion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete withdrawal',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export { router as withdrawalRoutes };
