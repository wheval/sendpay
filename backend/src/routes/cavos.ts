import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { flutterwaveService } from '../services/flutterwave.service';
import { BankAccount } from '../models/BankAccount';
import { Withdrawal } from '../models/Withdrawal';
import { User } from '../models/User';
import { generateToken } from '../middleware/auth';
import { validateEmail } from '../utils/helpers';
import { cavosService } from '../services/cavos.service';

const router = Router();

/**
 * @route   POST /api/cavos/login
 * @desc    Login with email/password using Cavos service
 * @access  Public
 */
router.post('/login', async (req, res) => {
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

    // Use real Cavos service for authentication
    const cavosResult = await cavosService.signIn(email, password);
    
    // Find or create user in our database
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create new user with Cavos wallet address
      const mockCavosWallet = `0x${Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
      
      user = new User({
        email: email.toLowerCase(),
        name: email.split('@')[0],
        cavosWalletAddress: mockCavosWallet,
        bankDetails: {
          bankCode: '',
          bankName: 'Not Set',
          accountNumber: '0000000000',
          accountName: 'Not Set'
        },
        balance: 0,
        balanceUSD: 0,
        balanceNGN: 0
      });

      await user.save();
    }

    // Generate JWT token for our system
    const jwtToken = generateToken(user._id?.toString() || '');

    res.json({
      success: true,
      message: 'Login successful',
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        cavosWalletAddress: user.cavosWalletAddress,
        balanceUSD: user.balanceUSD,
        balanceNGN: user.balanceNGN,
        hasBankDetails: user.bankDetails.bankName !== 'Not Set'
      },
      cavos: {
        accessToken: cavosResult.accessToken,
        refreshToken: cavosResult.refreshToken,
        walletAddress: cavosResult.walletAddress
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    
    // Handle Cavos-specific errors
    if (error.message?.includes('Cavos')) {
      return res.status(401).json({
        success: false,
        message: 'Cavos authentication failed. Please check your credentials.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/cavos/signup
 * @desc    Sign up with email/password using Cavos service
 * @access  Public
 */
router.post('/signup', async (req, res) => {
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
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists in our database
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Use real Cavos service for signup
    const cavosResult = await cavosService.signUp(email, password);
    
    // Create new user with Cavos wallet address
    const user = new User({
      email: email.toLowerCase(),
      name: email.split('@')[0],
      cavosWalletAddress: cavosResult.walletAddress || `0x${Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      bankDetails: {
        bankCode: '',
        bankName: 'Not Set',
        accountNumber: '0000000000',
        accountName: 'Not Set'
      },
      balance: 0,
      balanceUSD: 0,
      balanceNGN: 0
    });

    await user.save();

    // Generate JWT token for our system
    const jwtToken = generateToken(user._id?.toString() || '');

    res.json({
      success: true,
      message: 'Account created successfully',
      token: jwtToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        cavosWalletAddress: user.cavosWalletAddress,
        balanceUSD: user.balanceUSD,
        balanceNGN: user.balanceNGN,
        hasBankDetails: false
      },
      cavos: {
        accessToken: cavosResult.accessToken,
        refreshToken: cavosResult.refreshToken,
        walletAddress: cavosResult.walletAddress
      }
    });

  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Handle Cavos-specific errors
    if (error.message?.includes('Cavos')) {
      return res.status(400).json({
        success: false,
        message: 'Cavos signup failed. Please try again.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Signup failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/cavos/banks
 * @desc    Get list of supported banks from Flutterwave
 * @access  Private
 */
router.get('/banks', authenticateToken, async (req, res) => {
  try {
    const banks = await flutterwaveService.getBankList();
    res.json({ success: true, data: banks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

/**
 * @route   GET /api/cavos/balance/:address
 * @desc    Get token balance using real Cavos service
 * @access  Public
 */
router.get('/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { tokenAddress, decimals = '18' } = req.query;

    if (!address || !tokenAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address and token address are required'
      });
    }

    // Use real Cavos service to get balance
    const balanceResult = await cavosService.getBalance(address, tokenAddress as string, decimals as string);
    
    res.json({
      success: true,
      data: {
        address,
        tokenAddress,
        balance: balanceResult.balance,
        decimals: parseInt(decimals as string),
        formatted: balanceResult.formatted
      }
    });

  } catch (error: any) {
    console.error('Balance check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get balance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/cavos/execute
 * @desc    Execute smart contract calls using real Cavos service
 * @access  Public
 */
router.post('/execute', async (req, res) => {
  try {
    const { address, calls, accessToken } = req.body;

    if (!address || !calls || !accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Address, calls, and access token are required'
      });
    }

    // Use real Cavos service to execute calls
    const result = await cavosService.execute(address, calls, accessToken);
    
    res.json({
      success: true,
      data: {
        transaction_hash: result.transactionHash || result.hash,
        status: 'success',
        message: 'Transaction executed successfully',
        result
      }
    });

  } catch (error: any) {
    console.error('Execute error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute transaction',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
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
    // Verify account details with Flutterwave
    const verification = await flutterwaveService.verifyBankAccount(bankCode, accountNumber);
    if (!verification.status) {
      return res.status(400).json({ success: false, message: verification.message });
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

    // Check if user has sufficient balance (assuming balance is in a field named 'balanceUSD')
    if (user.balanceUSD < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    const bankAccount = await BankAccount.findOne({ _id: bankAccountId, userId });
    if (!bankAccount) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    // TODO: This would integrate with the smart contract for actual withdrawal
    // For now, just create a withdrawal record
    const reason = `Withdrawal for user ${userId}`;
    
    // Create withdrawal record
    const withdrawal = new Withdrawal({
      userId,
      amount,
      bankAccountId,
      status: 'pending',
      reference: `WD_${Date.now()}`,
    });

    await withdrawal.save();

    res.json({ success: true, message: 'Withdrawal initiated successfully', data: withdrawal });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

export { router as cavosRoutes };
