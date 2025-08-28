import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import paystackService from '../services/paystackService';
import { BankAccount } from '../models/BankAccount';
import { Withdrawal } from '../models/Withdrawal';
import { User } from '../models/User';

const router = Router();

/**
 * @route   GET /api/cavos/banks
 * @desc    Get list of supported banks from Paystack
 * @access  Private
 */
router.get('/banks', authenticateToken, async (req, res) => {
  try {
    const banks = await paystackService.getBankList();
    res.json({ success: true, data: banks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

/**
 * @route   POST /api/cavos/bank/add
 * @desc    Add and verify a bank account
 * @access  Private
 */
router.post('/bank/add', authenticateToken, async (req, res) => {
  const { accountNumber, bankCode } = req.body;
  const userId = req.user._id;

  if (!accountNumber || !bankCode) {
    return res.status(400).json({ success: false, message: 'Account number and bank code are required' });
  }

  try {
    // Verify account details with Paystack
    const verification = await paystackService.verifyAccountNumber(accountNumber, bankCode);
    if (!verification.status) {
      return res.status(400).json({ success: false, message: verification.message });
    }

    const { account_name } = verification.data;

    // Get bank name from the bank list
    const banks = await paystackService.getBankList();
    const bank = banks.find(b => b.code === bankCode);
    const bankName = bank ? bank.name : 'Unknown Bank';

    // Create transfer recipient on Paystack
    const recipient = await paystackService.createTransferRecipient(account_name, accountNumber, bankCode);
    if (!recipient.status) {
      return res.status(400).json({ success: false, message: recipient.message });
    }

    // Save bank account to database
    const bankAccount = new BankAccount({
      userId,
      accountNumber,
      bankCode,
      accountName: account_name,
      bankName,
      recipientCode: recipient.data.recipient_code,
    });

    await bankAccount.save();

    res.json({ success: true, message: 'Bank account added successfully', data: bankAccount });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

/**
 * @route   POST /api/cavos/withdraw
 * @desc    Initiate a withdrawal to a bank account
 * @access  Private
 */
router.post('/withdraw', authenticateToken, async (req, res) => {
  const { amount, bankAccountId } = req.body;
  const userId = req.user._id;

  if (!amount || !bankAccountId) {
    return res.status(400).json({ success: false, message: 'Amount and bank account ID are required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if user has sufficient balance (assuming balance is in a field named 'balance')
    if (user.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const bankAccount = await BankAccount.findOne({ _id: bankAccountId, userId });
    if (!bankAccount) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    // Initiate transfer with Paystack
    const reason = `Withdrawal for user ${userId}`;
    const transfer = await paystackService.initiateTransfer(bankAccount.recipientCode, amount, reason);

    if (!transfer.status) {
      return res.status(400).json({ success: false, message: transfer.message });
    }

    // Deduct amount from user balance
    user.balance -= amount;
    await user.save();

    // Create withdrawal record
    const withdrawal = new Withdrawal({
      userId,
      amount,
      bankAccountId,
      status: 'processing',
      reference: transfer.data.transfer_code,
    });

    await withdrawal.save();

    res.json({ success: true, message: 'Withdrawal initiated successfully', data: withdrawal });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

export { router as cavosRoutes };