import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { flutterwaveService } from '../services/flutterwave.service';
import { starknetService } from '../services/starknet.service';
import { signatureService } from '../services/signature.service';
import { generateReference } from '../utils/helpers';
import { Transaction } from '../models/Transaction';
import { BankAccount } from '../models/BankAccount';
import { exchangeRateService } from '../services/exchange-rate.service';

const router = Router();

/**
 * GET /api/flutterwave/banks
 * Get list of Nigerian banks
 */
router.get('/banks', authenticateToken, async (req: Request, res: Response) => {
  try {
    const banks = await flutterwaveService.getBankList();
    
    res.json({
      success: true,
      message: 'Banks retrieved successfully',
      data: banks
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
 * POST /api/flutterwave/bank/add
 * Add and verify a bank account
 */
router.post('/bank/add', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { accountNumber, bankCode } = req.body;
    const userId = req.user._id;

    if (!accountNumber || !bankCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account number and bank code are required' 
      });
    }

    // Verify account details with Flutterwave
    const verification = await flutterwaveService.verifyBankAccount(bankCode, accountNumber);
    if (!verification.status) {
      return res.status(400).json({ 
        success: false, 
        message: verification.message 
      });
    }

    const { account_name } = verification.data;

    // Get bank name from the bank list
    const banks = await flutterwaveService.getBankList();
    const bank = banks.find((b: any) => b.code === bankCode);
    const bankName = bank ? bank.name : 'Unknown Bank';

    // Save bank account to database
    const bankAccount = new BankAccount({
      userId,
      accountNumber,
      bankCode,
      accountName: account_name,
      bankName,
    });

    await bankAccount.save();

    res.json({ 
      success: true, 
      message: 'Bank account added successfully', 
      data: bankAccount 
    });

  } catch (error: unknown) {
    console.error('Bank account addition error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add bank account',
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
    });
  }
});

/**
 * POST /api/flutterwave/onramp/initiate
 * Initiate hosted payment (on-ramp) and create pending deposit record
 */
router.post('/onramp/initiate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { amountUSD } = req.body;
    const user = req.user;
    if (!amountUSD || Number(amountUSD) <= 0) {
      return res.status(400).json({ success: false, message: 'amountUSD required' });
    }

    // Create fiat_tx_ref and store pending deposit transaction
    const fiat_tx_ref = generateReference();
    const tx = await Transaction.create({
      userId: user._id,
      type: 'deposit',
      status: 'pending',
      amountUSD: Number(amountUSD),
      amountNGN: await exchangeRateService.convertUSDToNGN(Number(amountUSD)),
      description: `On-ramp ${amountUSD} USD`,
      reference: fiat_tx_ref,
      metadata: { fiat_tx_ref }
    });

    // Create real Flutterwave hosted payment link
    const hostedUrl = await flutterwaveService.createHostedPayment({
      amount: tx.amountNGN,
      currency: 'NGN',
      tx_ref: fiat_tx_ref,
      customer: {
        email: req.user.email,
        name: req.user.name
      },
      customizations: {
        title: 'SendPay - Deposit Funds',
        description: `Deposit ${tx.amountNGN} NGN to your SendPay account`
      }
    });

    res.json({ success: true, data: { fiat_tx_ref, hostedUrl, transactionId: tx._id } });
  } catch (error: any) {
    console.error('Onramp initiate error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate on-ramp', error: error.message });
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

    const verification = await flutterwaveService.verifyBankAccount(accountBank, accountNumber);

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

    // Orchestrator Direct Transfer (NGN -> NGN)
    const transfer = await flutterwaveService.createDirectTransfer({
      bankCode: accountBank,
      accountNumber,
      amountNGN: Number(amount),
      reference,
      narration,
      callback_url: process.env.FLUTTERWAVE_CALLBACK_URL || undefined,
      idempotencyKey: reference,
    });

    res.json({
      success: true,
      message: 'Transfer successful!',
      data: {
        transferId: transfer?.data?.id,
        reference: transfer?.data?.reference || reference,
        status: transfer?.data?.status || 'NEW',
        amount: transfer?.data?.amount?.value || Number(amount),
        currency: transfer?.data?.destination_currency || 'NGN',
        narration,
        bankCode: accountBank,
        accountNumber,
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

    // Use Direct Transfers fetch for orchestration transfers
    const transfer = await flutterwaveService.getDirectTransfer(transferId);

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

    // For now, return a mock response since we don't have a list endpoint
    res.json({
      success: true,
      message: 'Transfers retrieved successfully',
      data: [],
      meta: { page: Number(page), total: 0 }
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

    // TODO: Implement real transfer retry endpoint
    throw new Error('Transfer retry endpoint not implemented. This feature requires additional Flutterwave API integration.');
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

    // TODO: Implement real transfer fee calculation
    throw new Error('Transfer fee calculation endpoint not implemented. This feature requires additional Flutterwave API integration.');
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
    // TODO: Implement real balance retrieval
    throw new Error('Balance retrieval endpoint not implemented. This feature requires additional Flutterwave API integration.');
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
    const secret = process.env.FLUTTERWAVE_ENCRYPTION_KEY || process.env.FLUTTERWAVE_SECRET_HASH;
    if (signature && secret) {
      if (signature !== secret) {
        console.warn('Invalid Flutterwave webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    switch (event) {
      case 'transfer.completed':
        await handleTransferCompleted(data);
        // Attempt to complete on-chain withdrawal if we have mapping
        try {
          const reference = data?.reference; // expected wd_<withdrawalId>
          if (reference && typeof reference === 'string' && reference.startsWith('wd_')) {
            const withdrawalId = reference.slice(3);
            // Generate real settlement proof signature
            const settlementData = {
              fiat_tx_hash: String(data?.id || data?.tx_ref || reference),
              settled_amount: String(data?.amount || '0'),
              timestamp: Math.floor(Date.now() / 1000)
            };

            const settlementSignature = await signatureService.signSettlementProof(settlementData);

            const proof = {
              ...settlementData,
              backend_signature: settlementSignature
            };
            await starknetService.completeWithdrawal(withdrawalId, proof);
          }
        } catch (e) {
          console.error('On-chain completion error:', e);
        }
        break;
      case 'charge.completed':
      case 'payment.completed':
      case 'transfer.successful':
        // Handle hosted pay/on-ramp success
        try {
          const fiat_tx_ref = data?.tx_ref || data?.flw_ref || data?.reference;
          const amount = String(data?.amount || '0');
          const metadata = (data?.meta || {}) as any;
          const userAddress = metadata?.userAddress || metadata?.walletAddress;
          if (fiat_tx_ref && userAddress) {
            await starknetService.depositAndCredit(userAddress, amount, String(fiat_tx_ref));
          }
        } catch (e) {
          console.error('On-chain deposit error:', e);
        }
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
