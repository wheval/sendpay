import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import flutterwaveService from '../services/flutterwaveService';
import { generateReference } from '../utils/helpers';
import { Transaction } from '../models/Transaction';

const router = Router();

/**
 * GET /api/flutterwave/banks
 * Get list of Nigerian banks
 */
router.get('/banks', authenticateToken, async (req: Request, res: Response) => {
  try {
    const banks = await flutterwaveService().getBankList();
    
    res.json({
      success: true,
      message: 'Banks retrieved successfully',
      data: banks.data
    });
  } catch (error: unknown) {
    console.error('Bank list retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve banks',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * POST /api/flutterwave/verify-account
 * Verify bank account number
 */
router.post('/verify-account', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { accountNumber, accountBank } = req.body;

    if (!accountNumber || !accountBank) {
      return res.status(400).json({
        success: false,
        message: 'Account number and bank code are required'
      });
    }

    const verification = await flutterwaveService().verifyAccountNumber(accountNumber, accountBank);

    res.json({
      success: true,
      message: 'Account verified successfully',
      data: verification.data
    });
  } catch (error: unknown) {
    console.error('Account verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify account',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * POST /api/flutterwave/transfer
 * Initiate a single transfer
 */
router.post('/transfer', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { accountBank, accountNumber, amount, narration, currency = 'NGN', beneficiaryName } = req.body;

    if (!accountBank || !accountNumber || !amount || !narration) {
      return res.status(400).json({
        success: false,
        message: 'Bank code, account number, amount, and narration are required'
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

    const transfer = await flutterwaveService().initiateTransfer({
      account_bank: accountBank,
      account_number: accountNumber,
      amount,
      narration,
      currency,
      reference,
      beneficiary_name: beneficiaryName,
      callback_url: process.env.FLUTTERWAVE_CALLBACK_URL || ''
    });

    res.json({
      success: true,
      message: 'Transfer initiated successfully',
      data: {
        transferId: transfer.data.id,
        reference: transfer.data.reference,
        status: transfer.data.status,
        amount: transfer.data.amount,
        currency: transfer.data.currency,
        narration: transfer.data.narration,
        bankName: transfer.data.bank_name,
        accountNumber: transfer.data.account_number,
        createdAt: transfer.data.created_at
      }
    });
  } catch (error: unknown) {
    console.error('Transfer initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate transfer',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * POST /api/flutterwave/transfer/bulk
 * Initiate bulk transfers
 */
router.post('/transfer/bulk', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { title, transfers } = req.body;

    if (!title || !transfers || !Array.isArray(transfers) || transfers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title and transfers array are required'
      });
    }

    // Validate each transfer object
    for (const transfer of transfers) {
      if (!transfer.accountBank || !transfer.accountNumber || !transfer.amount || !transfer.narration) {
        return res.status(400).json({
          success: false,
          message: 'Each transfer must have accountBank, accountNumber, amount, and narration'
        });
      }
    }

    const bulkTransferData = {
      title,
      bulk_data: transfers.map(transfer => ({
        bank_code: transfer.accountBank,
        account_number: transfer.accountNumber,
        amount: transfer.amount,
        currency: transfer.currency || 'NGN',
        narration: transfer.narration,
        reference: transfer.reference || generateReference(),
        beneficiary_name: transfer.beneficiaryName
      }))
    };

    const result = await flutterwaveService().bulkTransfer(bulkTransferData);

    res.json({
      success: true,
      message: 'Bulk transfer initiated successfully',
      data: {
        bulkTransferId: result.data.id,
        title: result.data.title,
        status: result.data.status,
        totalAmount: result.data.total_amount,
        totalFee: result.data.total_fee,
        currency: result.data.currency,
        createdAt: result.data.created_at,
        transfers: result.data.transfers
      }
    });
  } catch (error: unknown) {
    console.error('Bulk transfer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate bulk transfer',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * GET /api/flutterwave/transfer/:id
 * Get transfer status by ID
 */
router.get('/transfer/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transferId = id;

    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: 'Transfer ID is required'
      });
    }

    const transfer = await flutterwaveService().getTransferStatus(transferId);

    res.json({
      success: true,
      message: 'Transfer status retrieved successfully',
      data: transfer.data
    });
  } catch (error: unknown) {
    console.error('Transfer status retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transfer status',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * GET /api/flutterwave/transfers
 * Get all transfers with optional filtering
 */
router.get('/transfers', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { page = 1, status, from, to } = req.query;

    const transfers = await flutterwaveService().getAllTransfers(
      Number(page),
      status as string,
      from as string,
      to as string
    );

    res.json({
      success: true,
      message: 'Transfers retrieved successfully',
      data: transfers.data,
      meta: transfers.meta
    });
  } catch (error: unknown) {
    console.error('Transfers retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transfers',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * POST /api/flutterwave/transfer/:id/retry
 * Retry a failed transfer
 */
router.post('/transfer/:id/retry', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transferId = id;

    if (!transferId) {
      return res.status(400).json({
        success: false,
        message: 'Transfer ID is required'
      });
    }

    const result = await flutterwaveService().retryTransfer(transferId);

    res.json({
      success: true,
      message: 'Transfer retry initiated successfully',
      data: result.data
    });
  } catch (error: unknown) {
    console.error('Transfer retry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry transfer',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * GET /api/flutterwave/transfer-fee
 * Get transfer fee for a specific amount
 */
router.get('/transfer-fee', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'NGN' } = req.query;

    if (!amount || isNaN(Number(amount))) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const fee = await flutterwaveService().getTransferFee(Number(amount), currency as string);

    res.json({
      success: true,
      message: 'Transfer fee retrieved successfully',
      data: fee.data
    });
  } catch (error: unknown) {
    console.error('Transfer fee retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve transfer fee',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * GET /api/flutterwave/balance
 * Get available balance
 */
router.get('/balance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const balance = await flutterwaveService().getBalance();

    res.json({
      success: true,
      message: 'Balance retrieved successfully',
      data: balance.data
    });
  } catch (error: unknown) {
    console.error('Balance retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve balance',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * POST /api/flutterwave/webhook
 * Handle Flutterwave webhook notifications
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;
    
    console.log('📡 Flutterwave Webhook Received:', { event, data });

    // Verify webhook signature (recommended for production)
    const signature = req.headers['verif-hash'];
    if (process.env.NODE_ENV === 'production' && signature) {
      // TODO: Implement signature verification
      // const isValid = verifyWebhookSignature(req.body, signature, process.env.FLUTTERWAVE_SECRET_HASH);
      // if (!isValid) return res.status(401).json({ error: 'Invalid signature' });
    }

    switch (event) {
      case 'transfer.completed':
        await handleTransferCompleted(data);
        break;
      
      case 'transfer.failed':
        await handleTransferFailed(data);
        break;
      
      case 'transfer.reversed':
        await handleTransferReversed(data);
        break;
      
      default:
        console.log('⚠️ Unhandled webhook event:', event);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ status: 'success', message: 'Webhook processed' });

  } catch (error: unknown) {
    console.error('❌ Webhook processing error:', error);
    // Still return 200 to prevent Flutterwave from retrying
    res.status(200).json({ status: 'error', message: 'Webhook processed with errors' });
  }
});

// Webhook event handlers
async function handleTransferCompleted(data: any) {
  try {
    console.log('✅ Transfer completed:', data.reference);
    
    // Find transaction by Flutterwave reference
    const transaction = await Transaction.findOne({
      'metadata.flutterwave_reference': data.reference
    });
    
    if (transaction) {
      // Update transaction status
      await Transaction.findByIdAndUpdate(transaction._id, {
        status: 'completed',
        metadata: {
          ...transaction.metadata,
          flutterwave_status: 'completed',
          flutterwave_completed_at: new Date(),
          webhookProcessed: true,
          processedAt: new Date()
        }
      });
      
      console.log('✅ Transaction updated successfully:', transaction.reference);
    } else {
      console.log('⚠️ No transaction found for Flutterwave reference:', data.reference);
    }
  } catch (error) {
    console.error('❌ Error updating transfer completion:', error);
  }
 }

async function handleTransferFailed(data: any) {
  try {
    console.log('❌ Transfer failed:', data.reference);
    
    // Find transaction by Flutterwave reference
    const transaction = await Transaction.findOne({
      'metadata.flutterwave_reference': data.reference
    });
    
    if (transaction) {
      // Update transaction status
      await Transaction.findByIdAndUpdate(transaction._id, {
        status: 'failed',
        metadata: {
          ...transaction.metadata,
          flutterwave_status: 'failed',
          flutterwave_failed_at: new Date(),
          flutterwave_error: data.message || 'Transfer failed',
          webhookProcessed: true,
          processedAt: new Date()
        }
      });
      
      console.log('✅ Failed transaction updated successfully:', transaction.reference);
    } else {
      console.log('⚠️ No transaction found for Flutterwave reference:', data.reference);
    }
  } catch (error) {
    console.error('❌ Error updating transfer failure:', error);
  }
}

async function handleTransferReversed(data: any) {
  try {
    console.log('🔄 Transfer reversed:', data.reference);
    
    // Update transaction status in database
    await Transaction.findOneAndUpdate(
      { reference: data.reference },
      { 
        status: 'reversed',
        metadata: {
          ...data,
          webhookProcessed: true,
          processedAt: new Date()
        }
      }
    );
    
    console.log('✅ Reversed transaction updated successfully');
  } catch (error) {
    console.error('❌ Error updating transfer reversal:', error);
  }
}

export { router as flutterwaveRoutes };
