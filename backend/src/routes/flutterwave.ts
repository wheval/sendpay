import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { flutterwaveService } from '../services/flutterwave.service';
import { starknetService } from '../services/starknet.service';
import { signatureService } from '../services/signature.service';
import { generateReference } from '../utils/helpers';
import { Transaction } from '../models/Transaction';
import { BankAccount } from '../models/BankAccount';
import { exchangeRateService } from '../services/exchange-rate.service';
import crypto from 'crypto';

const router = Router();

/**
 * Verify Flutterwave webhook signature using HMAC-SHA256
 * Following Flutterwave's official documentation
 */
function isValidFlutterwaveWebhook(rawBody: Buffer, signature: string, secretHash: string): boolean {
  if (!signature || !secretHash) {
    return false;
  }
  
  const hash = crypto
    .createHmac('sha256', secretHash)
    .update(rawBody)
    .digest('base64');
    
  return hash === signature;
}

/**
 * Verify transaction details with Flutterwave API (Best Practice)
 * This ensures the webhook data hasn't been compromised
 */
async function verifyTransactionWithFlutterwave(transactionId: string, expectedAmount?: number, expectedCurrency?: string, expectedReference?: string): Promise<boolean> {
  try {
    // Use the Flutterwave service to get transaction details
    const transfer = await flutterwaveService.getDirectTransfer(transactionId);
    
    if (!transfer?.data) {
      console.warn('❌ Transaction verification failed: No data returned');
      return false;
    }
    
    const transaction = transfer.data;
    
    // Verify expected values if provided
    if (expectedAmount && transaction.amount?.value !== expectedAmount) {
      console.warn('❌ Transaction verification failed: Amount mismatch', {
        expected: expectedAmount,
        actual: transaction.amount?.value
      });
      return false;
    }
    
    if (expectedCurrency && transaction.destination_currency !== expectedCurrency) {
      console.warn('❌ Transaction verification failed: Currency mismatch', {
        expected: expectedCurrency,
        actual: transaction.destination_currency
      });
      return false;
    }
    
    if (expectedReference && transaction.reference !== expectedReference) {
      console.warn('❌ Transaction verification failed: Reference mismatch', {
        expected: expectedReference,
        actual: transaction.reference
      });
      return false;
    }
    
    console.log('✅ Transaction verification passed:', {
      id: transactionId,
      status: transaction.status,
      amount: transaction.amount?.value,
      currency: transaction.destination_currency
    });
    
    return true;
  } catch (error) {
    console.error('❌ Transaction verification error:', error);
    return false;
  }
}

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
 * Initiate Pay With Bank Transfer (PWBT) with dynamic virtual account
 */
router.post('/onramp/initiate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { amountUSD, expiryMinutes = 60 } = req.body;
    const user = req.user;
    
    if (!amountUSD || Number(amountUSD) <= 0) {
      return res.status(400).json({ success: false, message: 'amountUSD required' });
    }

    // Validate expiry time (max 365 days, min 1 minute)
    const maxExpiryMinutes = 365 * 24 * 60; // 365 days in minutes
    const minExpiryMinutes = 1;
    const validatedExpiry = Math.max(minExpiryMinutes, Math.min(maxExpiryMinutes, Number(expiryMinutes) || 60));

    // Create fiat_tx_ref and store pending deposit transaction
    const fiat_tx_ref = generateReference();
    const amountNGN = await exchangeRateService.convertUSDToNGN(Number(amountUSD));
    
    const tx = await Transaction.create({
      userId: user._id,
      flow: 'onramp',
      status: 'created',
      amountUSD: Number(amountUSD),
      amountNGN: amountNGN,
      description: `On-ramp ${amountUSD} USD`,
      reference: fiat_tx_ref,
      metadata: { 
        fiat_tx_ref,
        amountUSD: Number(amountUSD),
        amountNGN: amountNGN,
        expiryMinutes: validatedExpiry
      }
    });

    // Create Flutterwave customer
    const [firstName, ...lastNameParts] = (user.name || 'User').split(' ');
    const lastName = lastNameParts.join(' ') || 'User';
    
    const customer = await flutterwaveService.createCustomer({
      firstName,
      lastName,
      email: user.email
    });

    // Create dynamic virtual account
    const virtualAccount = await flutterwaveService.createDynamicVirtualAccount({
      reference: fiat_tx_ref,
      customerId: customer.data.id,
      amount: Math.round(amountNGN), // Flutterwave expects whole numbers
      currency: 'NGN',
      narration: `${user.name} - SendPay Deposit`,
      expiryMinutes: validatedExpiry
    });

    // Update transaction with virtual account details
    await Transaction.findByIdAndUpdate(tx._id, {
      status: 'credit_pending',
      metadata: {
        ...tx.metadata,
        flutterwave_customer_id: customer.data.id,
        flutterwave_virtual_account_id: virtualAccount.data.id,
        virtual_account_number: virtualAccount.data.account_number,
        bank_name: virtualAccount.data.account_bank_name,
        expiry_datetime: virtualAccount.data.account_expiration_datetime,
        virtual_account_created_at: new Date()
      }
    });

    res.json({ 
      success: true, 
      data: { 
        transactionId: tx._id,
        fiat_tx_ref,
        virtualAccount: {
          accountNumber: virtualAccount.data.account_number,
          bankName: virtualAccount.data.account_bank_name,
          amount: amountNGN,
          currency: 'NGN',
          expiry: virtualAccount.data.account_expiration_datetime,
          reference: fiat_tx_ref,
          narration: virtualAccount.data.note
        }
      } 
    });
  } catch (error: any) {
    console.error('PWBT onramp initiate error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to initiate PWBT on-ramp', 
      error: error.message 
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
 * GET /api/flutterwave/virtual-account/:id/status
 * Get virtual account status and charges
 */
router.get('/virtual-account/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page = 1 } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Virtual account ID is required'
      });
    }

    // Get charges for the virtual account
    const charges = await flutterwaveService.getChargesForVirtualAccount(id, Number(page));

    res.json({
      success: true,
      message: 'Virtual account status retrieved successfully',
      data: {
        virtualAccountId: id,
        charges: charges.data || [],
        meta: charges.meta || {}
      }
    });
  } catch (error: unknown) {
    console.error('Virtual account status retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve virtual account status',
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
    // Basic security: Verify the request is from Flutterwave
    const userAgent = req.headers['user-agent'];
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIp = req.headers['x-real-ip'];
    
    console.log('📡 Flutterwave Webhook Received:', {
      method: req.method,
      userAgent,
      ip: forwardedFor || realIp || req.connection.remoteAddress,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });

    // Get raw body and signature for verification
    const rawBody = req.body as Buffer;
    const signature = req.headers['flutterwave-signature'] as string;
    const secretHash = process.env.FLUTTERWAVE_SECRET_HASH;

    // Verify webhook signature using HMAC-SHA256 (as per Flutterwave docs)
    if (signature && secretHash) {
      const isValid = isValidFlutterwaveWebhook(rawBody, signature, secretHash);
      if (!isValid) {
        console.warn('❌ Invalid Flutterwave webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      console.log('✅ Webhook signature verified');
    } else {
      console.warn('⚠️ No signature or secret hash configured - webhook verification disabled');
    }

    // Parse the JSON body manually since we're using raw body
    let webhookData;
    try {
      webhookData = JSON.parse(rawBody.toString());
    } catch (error) {
      console.error('❌ Failed to parse webhook JSON:', error);
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const { event, data } = webhookData;

    switch (event) {
      case 'transfer.disburse':
      case 'transfer.completed': // Backward compatibility
        await handleTransferCompleted(data);
        // Attempt to complete on-chain withdrawal if we have mapping
        try {
          const reference = data?.reference; // expected sendpay_<withdrawalId>
          if (reference && typeof reference === 'string' && reference.startsWith('sendpay_')) {
            const withdrawalId = reference.slice(9);
            // Generate real settlement proof signature using official webhook structure
            const settlementData = {
              fiat_tx_hash: String(data?.id || reference), // Use transfer ID from webhook
              settled_amount: String(data?.debit_information?.actual_debit_amount || data?.amount || '0'),
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
        // Handle PWBT (Pay With Bank Transfer) success
        await handlePWBTCompleted(data);
        break;
      case 'payment.completed':
      case 'transfer.successful':
        // Handle other payment methods success
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
      // Verify transaction with Flutterwave API (Best Practice)
      const transactionId = data.id || data.transfer_id;
      if (transactionId) {
        const isValid = await verifyTransactionWithFlutterwave(
          transactionId,
          (transaction.metadata as any)?.ngnAmount,
          'NGN',
          data.reference
        );
        
        if (!isValid) {
          console.error('❌ Transaction verification failed - not updating status');
          return;
        }
      }
      
      // Update transaction status - Flutterwave payment completed
      await Transaction.findByIdAndUpdate(transaction._id, {
        status: 'payout_completed',
        metadata: {
          ...transaction.metadata,
          flutterwave_status: 'completed',
          flutterwave_completed_at: new Date(),
          webhookProcessed: true,
          processedAt: new Date(),
          payoutCompletedBy: 'webhook',
          transactionVerified: true
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
      // Update transaction status with deduplication marker
      await Transaction.findByIdAndUpdate(transaction._id, {
        status: 'payout_failed',
        metadata: {
          ...transaction.metadata,
          flutterwave_status: 'failed',
          flutterwave_failed_at: new Date(),
          flutterwave_error: data.message || 'Transfer failed',
          webhookProcessed: true,
          processedAt: new Date(),
          failedBy: 'webhook'
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

async function handlePWBTCompleted(data: any) {
  try {
    console.log('💰 PWBT charge completed:', data.reference);
    
    // Find transaction by reference (fiat_tx_ref)
    const transaction = await Transaction.findOne({
      'metadata.fiat_tx_ref': data.reference
    });
    
    if (!transaction) {
      console.log('⚠️ No transaction found for PWBT reference:', data.reference);
      return;
    }

    // Verify transaction with Flutterwave API (Best Practice)
    const chargeId = data.id;
    if (chargeId) {
      const verification = await flutterwaveService.verifyCharge(chargeId);
      
      if (!verification?.data) {
        console.error('❌ PWBT verification failed - no data returned');
        return;
      }
      
      const charge = verification.data;
      
      // Verify expected values
      if (charge.status !== 'succeeded') {
        console.error('❌ PWBT verification failed - status not succeeded:', charge.status);
        return;
      }
      
      if (charge.amount !== (transaction.metadata as any)?.amountNGN) {
        console.error('❌ PWBT verification failed - amount mismatch:', {
          expected: (transaction.metadata as any)?.amountNGN,
          actual: charge.amount
        });
        return;
      }
      
      if (charge.currency !== 'NGN') {
        console.error('❌ PWBT verification failed - currency mismatch:', charge.currency);
        return;
      }
      
      console.log('✅ PWBT transaction verification passed');
    }
    
    // Update transaction status - PWBT payment completed
    await Transaction.findByIdAndUpdate(transaction._id, {
      status: 'credited',
      metadata: {
        ...transaction.metadata,
        flutterwave_charge_id: chargeId,
        flutterwave_status: 'succeeded',
        pwbt_completed_at: new Date(),
        webhookProcessed: true,
        processedAt: new Date(),
        pwbtCompletedBy: 'webhook',
        transactionVerified: true,
        pwbt_amount: data.amount,
        pwbt_currency: data.currency
      }
    });
    
    // Trigger on-chain deposit and credit
    try {
      const user = await transaction.populate('userId');
      if (user && (user as any).userId?.walletAddress) {
        const walletAddress = (user as any).userId.walletAddress;
        const amount = String(data.amount);
        const fiat_tx_ref = data.reference;
        
        await starknetService.depositAndCredit(walletAddress, amount, fiat_tx_ref);
        console.log('✅ On-chain deposit initiated for PWBT:', fiat_tx_ref);
      } else {
        console.log('⚠️ No wallet address found for user in PWBT transaction');
      }
    } catch (e) {
      console.error('❌ On-chain deposit error for PWBT:', e);
    }
    
    console.log('✅ PWBT transaction updated successfully:', transaction.reference);
  } catch (error) {
    console.error('❌ Error updating PWBT completion:', error);
  }
}

export { router as flutterwaveRoutes };
