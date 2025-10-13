import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { BankAccount } from '../models/BankAccount';
import { authenticateToken } from '../middleware/auth';
import { validateNigerianAccountNumber } from '../utils/helpers';

const router = Router();

/**
 * GET /api/user/profile
 * Get authenticated user profile
 */
router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    const freshUser = await User.findById(userId).lean();
    if (!freshUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      user: {
        id: freshUser._id,
        email: freshUser.email,
        name: freshUser.name,
        chipiWalletAddress: freshUser.chipiWalletAddress,
        balanceUSD: freshUser.balanceUSD,
        balanceNGN: freshUser.balanceNGN,
        hasBankDetails: Boolean(
          freshUser.bankDetails &&
          freshUser.bankDetails.bankName && freshUser.bankDetails.bankName !== 'Not Set' &&
          freshUser.bankDetails.accountName && freshUser.bankDetails.accountName !== 'Not Set' &&
          freshUser.bankDetails.accountNumber && freshUser.bankDetails.accountNumber !== '0000000000'
        ),
        bankDetails: freshUser.bankDetails
      }
    });

  } catch (error: any) {
    console.error('Profile retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/user/wallet-sync
 * Set user's wallet address if currently not set (legacy endpoint)
 */
router.post('/wallet-sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.body as { walletAddress?: string };
    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim() === '') {
      return res.status(400).json({ success: false, message: 'walletAddress is required' });
    }

    const user = req.user;
    // Only update if wallet address is not already set
    if (!user.chipiWalletAddress) {
      user.chipiWalletAddress = walletAddress;
      await user.save();
    }

    res.json({
      success: true,
      message: 'Wallet synced',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        chipiWalletAddress: user.chipiWalletAddress,
        balanceUSD: user.balanceUSD,
        balanceNGN: user.balanceNGN,
        hasBankDetails: Boolean(
          user.bankDetails &&
          user.bankDetails.bankName && user.bankDetails.bankName !== 'Not Set' &&
          user.bankDetails.accountName && user.bankDetails.accountName !== 'Not Set' &&
          user.bankDetails.accountNumber && user.bankDetails.accountNumber !== '0000000000'
        ),
        bankDetails: user.bankDetails
      }
    });
  } catch (error: any) {
    console.error('Wallet sync error:', error);
    res.status(500).json({ success: false, message: 'Failed to sync wallet' });
  }
});

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { name, bankDetails } = req.body;
    const user = req.user;

    if (name) {
      user.name = name;
    }

    if (bankDetails) {
      if (bankDetails.bankName && bankDetails.accountNumber && bankDetails.accountName) {
        // Validate account number
        if (!validateNigerianAccountNumber(bankDetails.accountNumber)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid account number format'
          });
        }

        user.bankDetails = {
          bankName: bankDetails.bankName,
          accountNumber: bankDetails.accountNumber,
          accountName: bankDetails.accountName
        };
      }
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        chipiWalletAddress: user.chipiWalletAddress,
        balanceUSD: user.balanceUSD,
        balanceNGN: user.balanceNGN,
        bankDetails: user.bankDetails
      }
    });

  } catch (error: any) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/user/balance
 * Get user balance
 */
router.get('/balance', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = req.user;

    res.json({
      success: true,
      message: 'Balance retrieved successfully',
      balance: {
        USD: user.balanceUSD,
        NGN: user.balanceNGN
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
 * POST /api/user/bank-accounts
 * Add a new bank account
 */
router.post('/bank-accounts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { bankName, accountNumber, accountName, isDefault = false } = req.body;
    const userId = req.user._id;

    if (!bankName || !accountNumber || !accountName) {
      return res.status(400).json({
        success: false,
        message: 'Bank name, account number, and account name are required'
      });
    }

    if (!validateNigerianAccountNumber(accountNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account number format'
      });
    }

    // Check if account number already exists for this user
    const existingAccount = await BankAccount.findOne({
      userId,
      accountNumber
    });

    if (existingAccount) {
      return res.status(400).json({
        success: false,
        message: 'Bank account already exists'
      });
    }

    const bankAccount = new BankAccount({
      userId,
      bankName,
      accountNumber,
      accountName,
      isDefault
    });

    await bankAccount.save();

    // Get the masked account number from the virtual
    const maskedAccountNumber = bankAccount.accountNumber.length <= 4 
      ? bankAccount.accountNumber 
      : `${bankAccount.accountNumber.slice(0, 4)}****${bankAccount.accountNumber.slice(-4)}`;

    res.json({
      success: true,
      message: 'Bank account added successfully',
      bankAccount: {
        id: bankAccount._id,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        isDefault: bankAccount.isDefault,
        maskedAccountNumber
      }
    });

  } catch (error: any) {
    console.error('Bank account creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add bank account',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/user/bank-accounts
 * Get user's bank accounts
 */
router.get('/bank-accounts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    const bankAccounts = await BankAccount.find({ userId }).sort({ isDefault: -1, createdAt: -1 });

    // Fallback: use embedded user.bankDetails when no separate bank accounts exist
    if (!bankAccounts.length && req.user.bankDetails &&
        req.user.bankDetails.bankName && req.user.bankDetails.accountNumber && req.user.bankDetails.accountName &&
        req.user.bankDetails.bankName !== 'Not Set' && req.user.bankDetails.accountNumber !== 'Not Set' && req.user.bankDetails.accountName !== 'Not Set') {
      const bd = req.user.bankDetails;
      const maskedAccountNumber = bd.accountNumber.length <= 4 
        ? bd.accountNumber 
        : `${bd.accountNumber.slice(0, 4)}****${bd.accountNumber.slice(-4)}`;

      return res.json({
        success: true,
        message: 'Bank accounts retrieved successfully',
        bankAccounts: [
          {
            id: req.user._id, // virtual id to satisfy frontend
            bankName: bd.bankName,
            accountNumber: bd.accountNumber,
            accountName: bd.accountName,
            isDefault: true,
            maskedAccountNumber
          }
        ]
      });
    }

    res.json({
      success: true,
      message: 'Bank accounts retrieved successfully',
      bankAccounts: bankAccounts.map(account => {
        const maskedAccountNumber = account.accountNumber.length <= 4 
          ? account.accountNumber 
          : `${account.accountNumber.slice(0, 4)}****${account.accountNumber.slice(-4)}`;

        return {
          id: account._id,
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          accountName: account.accountName,
          isDefault: account.isDefault,
          maskedAccountNumber
        };
      })
    });

  } catch (error: any) {
    console.error('Bank accounts retrieval error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve bank accounts',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * PUT /api/user/bank-accounts/:id
 * Update bank account
 */
router.put('/bank-accounts/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { bankName, accountNumber, accountName, isDefault } = req.body;
    const userId = req.user._id;

    const bankAccount = await BankAccount.findOne({ _id: id, userId });
    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    if (bankName) bankAccount.bankName = bankName;
    if (accountNumber) {
      if (!validateNigerianAccountNumber(accountNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid account number format'
        });
      }
      bankAccount.accountNumber = accountNumber;
    }
    if (accountName) bankAccount.accountName = accountName;
    if (typeof isDefault === 'boolean') bankAccount.isDefault = isDefault;

    await bankAccount.save();

    // Get the masked account number from the virtual
    const maskedAccountNumber = bankAccount.accountNumber.length <= 4 
      ? bankAccount.accountNumber 
      : `${bankAccount.accountNumber.slice(0, 4)}****${bankAccount.accountNumber.slice(-4)}`;

    res.json({
      success: true,
      message: 'Bank account updated successfully',
      bankAccount: {
        id: bankAccount._id,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        isDefault: bankAccount.isDefault,
        maskedAccountNumber
      }
    });

  } catch (error: any) {
    console.error('Bank account update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bank account',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * DELETE /api/user/bank-accounts/:id
 * Delete bank account
 */
router.delete('/bank-accounts/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const bankAccount = await BankAccount.findOne({ _id: id, userId });
    if (!bankAccount) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found'
      });
    }

    await BankAccount.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Bank account deleted successfully'
    });

  } catch (error: any) {
    console.error('Bank account deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete bank account',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export { router as userRoutes };
