import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { generateToken } from '../middleware/auth';
import { validateEmail } from '../utils/helpers';
import { BankAccount } from '../models/BankAccount';

const router = Router();

/**
 * POST /api/auth/signup
 * Create new user account
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      name: email.split('@')[0], // Use email prefix as default name
      bankDetails: {
        bankName: 'Not Set',
        bankCode: '000',
        accountNumber: '0000000000',
        accountName: 'Not Set'
      },
      balanceUSD: 0,
      balanceNGN: 0
    });

    await user.save();

    // Generate JWT token
    const jwtToken = generateToken(user._id?.toString() || '');

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        chipiWalletAddress: user.chipiWalletAddress,
        balanceUSD: user.balanceUSD,
        balanceNGN: user.balanceNGN,
        hasBankDetails: user.bankDetails.bankName !== 'Not Set' && 
                        user.bankDetails.accountName !== 'Not Set' && 
                        user.bankDetails.accountNumber !== '0000000000' &&
                        user.bankDetails.bankCode && 
                        user.name && 
                        user.name !== user.email.split('@')[0]
      }
    });

  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

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

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Handle social login (Google/Apple)
    if (provider === 'google' || provider === 'apple') {
      if (!token) {
        return res.status(400).json({
          success: false,
          message: `${provider} token is required`
        });
      }
      // In production, verify the token with Google/Apple
      // For now, we'll just proceed if user exists
    } else {
      // Handle email/password login
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required for email login'
        });
      }

      // Verify password - handle both hashed and plain text passwords (for migration)
      console.log('[DEBUG] Login attempt for user:', email);
      console.log('[DEBUG] User found:', !!user);
      console.log('[DEBUG] User has password:', !!user.password);
      console.log('[DEBUG] Password type:', user.password ? (user.password.startsWith('$2b$') ? 'hashed' : 'plain text') : 'none');
      
      let isPasswordValid = false;
      
      if (!user.password) {
        console.log('[DEBUG] No password found for user - this might be a social login account or missing password field');
        
        // Check if this is a social login account or if password field is missing
        // For now, we'll allow setting a password for existing users without one
        if (password) {
          console.log('[DEBUG] Setting password for existing user without password');
          const saltRounds = 12;
          const hashedPassword = await bcrypt.hash(password, saltRounds);
          await User.findByIdAndUpdate(user._id, { password: hashedPassword });
          console.log('[DEBUG] Password set successfully for user:', user.email);
          isPasswordValid = true; // Password was just set, so it's valid
        } else {
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
          });
        }
      } else {
        // Check if password is hashed (starts with $2b$) or plain text
        if (user.password.startsWith('$2b$')) {
          // Password is hashed, use bcrypt.compare
          console.log('[DEBUG] Comparing hashed password');
          isPasswordValid = await bcrypt.compare(password, user.password);
          console.log('[DEBUG] Hashed password comparison result:', isPasswordValid);
        } else {
          // Password is plain text (legacy), do direct comparison
          console.log('[DEBUG] Comparing plain text password');
          console.log('[DEBUG] Stored password:', user.password);
          console.log('[DEBUG] Input password:', password);
          isPasswordValid = user.password === password;
          console.log('[DEBUG] Plain text password comparison result:', isPasswordValid);
          
          // If plain text password is valid, hash it for future use
          if (isPasswordValid) {
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            await User.findByIdAndUpdate(user._id, { password: hashedPassword });
            console.log('[DEBUG] Password migrated to hashed format for user:', user.email);
          }
        }
      }

      if (!isPasswordValid) {
        console.log('[DEBUG] Password validation failed');
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }
      
      console.log('[DEBUG] Password validation successful');
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
        hasBankDetails: user.bankDetails.bankName !== 'Not Set' && 
                        user.bankDetails.accountName !== 'Not Set' && 
                        user.bankDetails.accountNumber !== '0000000000' &&
                        user.bankDetails.bankCode && 
                        user.name && 
                        user.name !== user.email.split('@')[0]
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
    if (!bankDetails.bankName || !bankDetails.bankCode || !bankDetails.accountNumber || !bankDetails.accountName) {
      return res.status(400).json({ success: false, message: 'Bank name, bank code, account number, and account name are required' });
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
      bankCode: bankDetails.bankCode,
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
        existing.bankCode = bankDetails.bankCode;
        existing.accountName = bankDetails.accountName;
        if (isDefault) existing.isDefault = true;
        await existing.save();
      } else {
        await new BankAccount({
          userId: user._id,
          bankName: bankDetails.bankName,
          bankCode: bankDetails.bankCode,
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
        hasBankDetails: true,
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
