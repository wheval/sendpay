import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { Transaction } from '../models/Transaction';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { generateReference, generateTransactionHash } from '../utils/helpers';
import { exchangeRateService } from '../services/exchange-rate.service';
import { starknetService } from '../services/starknet.service';
import { IUserDocument } from '../types';

const router = Router();

/**
 * POST /api/payment/receive
 * Create a payment request (receive money)
 */
router.post('/receive', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { amount, currency, description } = req.body;
    const userId = req.user._id;

    if (!amount || !currency) {
      return res.status(400).json({
        success: false,
        message: 'Amount and currency are required'
      });
    }

    if (!['USD', 'NGN'].includes(currency)) {
      return res.status(400).json({
        success: false,
        message: 'Currency must be USD or NGN'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    // Generate unique reference
    const reference = generateReference();
    const transactionHash = generateTransactionHash();

    // Convert amount to both currencies for display
    let amountUSD = 0;
    let amountNGN = 0;

    if (currency === 'USD') {
      amountUSD = amount;
      amountNGN = await exchangeRateService.convertUSDToNGN(amount);
    } else {
      amountNGN = amount;
      amountUSD = await exchangeRateService.convertNGNToUSD(amount);
    }

    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: 'received',
      amountUSD,
      amountNGN,
      status: 'pending',
      description: description || `Payment request for ${amount} ${currency}`,
      reference,
      starknetTxHash: transactionHash
    });

    await transaction.save();

    // Generate payment link and QR code data
    const paymentLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pay/${reference}`;
    const qrCodeData = JSON.stringify({
      reference,
      amount,
      currency,
      description: description || `Payment request for ${amount} ${currency}`
    });

    res.json({
      success: true,
      message: 'Payment request created successfully',
      data: {
        reference,
        amountUSD,
        amountNGN,
        currency,
        description: transaction.description,
        paymentLink,
        qrCodeData,
        transactionId: transaction._id,
        status: transaction.status,
        createdAt: transaction.createdAt
      }
    });

  } catch (error: unknown) {
    console.error('Payment request creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment request',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * GET /api/payment/:reference
 * Get payment request details by reference
 */
router.get('/:reference', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;

    const transaction = await Transaction.findOne({ reference }).populate('userId', 'name email');
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    // Check if payment is still pending
    if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment request is no longer active',
        status: transaction.status
      });
    }

    // Handle populated userId field
    const recipientName = typeof transaction.userId === 'string' ? 'Unknown' : 
      (transaction.userId as unknown as IUserDocument)?.name || 'Unknown';
    const recipientEmail = typeof transaction.userId === 'string' ? 'Unknown' : 
      (transaction.userId as unknown as IUserDocument)?.email || 'Unknown';

    res.json({
      success: true,
      message: 'Payment request retrieved successfully',
      data: {
        reference: transaction.reference,
        amountUSD: transaction.amountUSD,
        amountNGN: transaction.amountNGN,
        description: transaction.description,
        recipientName,
        recipientEmail,
        status: transaction.status,
        createdAt: transaction.createdAt,
        expiresAt: new Date(transaction.createdAt!.getTime() + 24 * 60 * 60 * 1000) // 24 hours
      }
    });

  } catch (error: unknown) {
    console.error('Payment request retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment request',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * POST /api/payment/:reference/process
 * Process a payment (simulate payment completion)
 */
router.post('/:reference/process', async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const { payerEmail, payerName } = req.body;

    if (!payerEmail || !payerName) {
      return res.status(400).json({
        success: false,
        message: 'Payer email and name are required'
      });
    }

    const transaction = await Transaction.findOne({ reference }).populate('userId');
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Payment request not found'
      });
    }

    if (transaction.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment request is no longer active'
      });
    }

    // Simulate payment processing
    // In production, this would involve:
    // 1. Verifying payment on Starknet
    // 2. Updating user balances
    // 3. Recording the transaction

    // Update transaction status
    transaction.status = 'completed';
    await transaction.save();

    // Update recipient balance
    if (typeof transaction.userId !== 'string') {
      const recipient = transaction.userId as unknown as IUserDocument;
      recipient.balanceUSD += transaction.amountUSD;
      recipient.balanceNGN += transaction.amountNGN;
      await recipient.save();
    }

    // In production, you would also:
    // 1. Listen for Starknet contract events
    // 2. Verify the actual USDC transfer
    // 3. Handle gas fees and processing fees

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        reference: transaction.reference,
        amountUSD: transaction.amountUSD,
        amountNGN: transaction.amountNGN,
        status: transaction.status,
        processedAt: new Date(),
        transactionId: transaction._id
      }
    });

  } catch (error: unknown) {
    console.error('Payment processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * GET /api/payment/requests
 * Get user's payment requests
 */
router.get('/requests', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    const { status, limit = 10, page = 1 } = req.query;

    const query: Record<string, unknown> = { userId, type: 'received' };
    const statusStr = typeof status === 'string' ? status : undefined;
    if (statusStr && ['pending', 'completed', 'failed'].includes(statusStr)) {
      query.status = statusStr;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      message: 'Payment requests retrieved successfully',
      data: {
        transactions: transactions.map(tx => ({
          id: tx._id,
          reference: tx.reference,
          amountUSD: tx.amountUSD,
          amountNGN: tx.amountNGN,
          description: tx.description,
          status: tx.status,
          createdAt: tx.createdAt,
          paymentLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pay/${tx.reference}`
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error: unknown) {
    console.error('Payment requests retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment requests',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

export { router as paymentRoutes };
