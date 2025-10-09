import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { generateToken } from '../middleware/auth';
import { validateEmail } from '../utils/helpers';
import { BankAccount } from '../models/BankAccount';

const router = Router();

/**
 * POST /api/auth/login
 * Login with Google/Apple or email/password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, provider, token } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // For MVP, we'll simulate social login
    // In production, you would verify the token with Google/Apple
    if (provider === 'google' || provider === 'apple') {
      if (!token) {
        return res.status(400).json({
          success: false,
          message: `${provider} token is required`
        });
      }
    }

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = new User({
        email: email.toLowerCase(),
        name: email.split('@')[0], // Use email prefix as name
        bankDetails: {
          bankName: 'Not Set',
          accountNumber: '0000000000',
          accountName: 'Not Set'
        },
        balanceUSD: 0,
        balanceNGN: 0
      });

      await user.save();
    }

    // Generate JWT token
    const jwtToken = generateToken(user._id?.toString() || '');

    res.json({
      success: true,
      message: 'Login successful',
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        chipiWalletAddress: user.chipiWalletAddress,
        balanceUSD: user.balanceUSD,
        balanceNGN: user.balanceNGN,
        hasBankDetails: user.bankDetails.bankName !== 'Not Set'
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/onboarding
 * Complete user onboarding with bank details
 */
router.post('/onboarding', async (req: Request, res: Response) => {
  try {
    // Test: Check if request body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty'
      });
    }

    const { email, name, phone, bankDetails } = req.body;

    // Test: Check individual fields
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (!bankDetails) {
      return res.status(400).json({ success: false, message: 'Bank details are required' });
    }
    if (!bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.accountName) {
      return res.status(400).json({ success: false, message: 'Bank name, account number, and account name are required' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update user with onboarding information
    user.name = name;
    if (phone) user.phone = phone;
    user.bankDetails = {
      bankName: bankDetails.bankName,
      accountNumber: bankDetails.accountNumber,
      accountName: bankDetails.accountName
    };

    await user.save();

    // Upsert a BankAccount document from the bankDetails
    try {
      const existing = await BankAccount.findOne({ userId: user._id, accountNumber: bankDetails.accountNumber });
      const isDefault = !(await BankAccount.exists({ userId: user._id }));
      if (existing) {
        existing.bankName = bankDetails.bankName;
        existing.accountName = bankDetails.accountName;
        if (isDefault) existing.isDefault = true;
        await existing.save();
      } else {
        await new BankAccount({
          userId: user._id,
          bankName: bankDetails.bankName,
          accountNumber: bankDetails.accountNumber,
          accountName: bankDetails.accountName,
          isDefault
        }).save();
      }
    } catch {}

    // Generate new token
    const jwtToken = generateToken(user._id?.toString() || '');

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      token: jwtToken,
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
    res.status(500).json({
      success: false,
      message: 'Onboarding failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/profile
 */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

export { router as authRoutes };
