import express, { Request, Response } from 'express';
import { cavosService } from '../services/cavosService';
import { authenticateToken } from '../middleware/auth';
import { User } from '../models/User';
import { generateToken } from '../middleware/auth';
import { starknetService } from '../services/starknetService';

const router = express.Router();

// POST /api/cavos/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const result = await cavosService.signUp(email, password);

    // Upsert local user and issue our JWT
    const walletAddress = result.wallet?.address || '';
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = new User({
        email: email.toLowerCase(),
        name: email.split('@')[0],
        cavosWalletAddress: walletAddress || undefined, // Only set if available
        bankDetails: { bankName: 'Not Set', accountNumber: 'Not Set', accountName: 'Not Set' },
        balanceUSD: 0,
        balanceNGN: 0
      });
      await user.save();
    } else {
      if (!user.cavosWalletAddress && walletAddress) {
        user.cavosWalletAddress = walletAddress;
        await user.save();
      }
    }

    const token = generateToken((user._id as unknown as { toString: () => string })?.toString() || '');

    const hasBankDetails = !!(user.bankDetails && user.bankDetails.bankName !== 'Not Set' && user.bankDetails.accountNumber !== 'Not Set' && user.bankDetails.accountName !== 'Not Set');
    const hasWallet = !!user.cavosWalletAddress;

    res.json({ success: true, data: result, token, user: {
      id: user._id,
      email: user.email,
      name: user.name,
      cavosWalletAddress: user.cavosWalletAddress,
      balanceUSD: user.balanceUSD,
      balanceNGN: user.balanceNGN,
      hasBankDetails,
      hasWallet
    }});
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message: 'Signup failed', error: message });
  }
});

// POST /api/cavos/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const result = await cavosService.signIn(email, password);

    // Upsert local user and issue our JWT
    const walletAddress = result.wallet?.address || '';
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = new User({
        email: email.toLowerCase(),
        name: email.split('@')[0],
        cavosWalletAddress: walletAddress || undefined, // Only set if available
        bankDetails: { bankName: 'Not Set', accountNumber: 'Not Set', accountName: 'Not Set' },
        balanceUSD: 0,
        balanceNGN: 0
      });
      await user.save();
    } else {
      if (!user.cavosWalletAddress && walletAddress) {
        user.cavosWalletAddress = walletAddress;
        await user.save();
      }
    }
    const token = generateToken((user._id as unknown as { toString: () => string })?.toString() || '');

    const hasBankDetails = !!(user.bankDetails && user.bankDetails.bankName !== 'Not Set' && user.bankDetails.accountNumber !== 'Not Set' && user.bankDetails.accountName !== 'Not Set');
    const hasWallet = !!user.cavosWalletAddress;

    res.json({ success: true, data: result, token, user: {
      id: user._id,
      email: user.email,
      name: user.name,
      cavosWalletAddress: user.cavosWalletAddress,
      balanceUSD: user.balanceUSD,
      balanceNGN: user.balanceNGN,
      hasBankDetails,
      hasWallet
    }});
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message: 'Login failed', error: message });
  }
});

// POST /api/cavos/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'refreshToken is required' });
    }
    const result = await cavosService.refreshToken(refreshToken);
    res.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message: 'Token refresh failed', error: message });
  }
});

// GET /api/cavos/balance/:address?tokenAddress=...&decimals=18
router.get('/balance/:address', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { tokenAddress, decimals = '18' } = req.query as { tokenAddress: string; decimals?: string };
    if (!tokenAddress) {
      return res.status(400).json({ success: false, message: 'tokenAddress is required' });
    }
    const result = await cavosService.getBalance(address, tokenAddress, decimals);

    // Persist wallet address if user record is missing it
    if (req.user && !req.user.cavosWalletAddress && address) {
      const u = await User.findById(req.user._id);
      if (u && !u.cavosWalletAddress) {
        u.cavosWalletAddress = address.toLowerCase();
        await u.save();
      }
    }

    // RPC fallback for any token if Cavos returns 0
    let data = result
    const zeroLike = (!result?.balance && !Number(result?.formatted)) || (String(result?.formatted) === '0')
    if (zeroLike) {
      try {
        const fallback = await starknetService.getErc20Balance(address, tokenAddress, String(decimals || '18'))
        data = { balance: Number(fallback.balance) || 0, formatted: fallback.formatted }
      } catch {}
    }

    res.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message: 'Balance check failed', error: message });
  }
});

// POST /api/cavos/execute
router.post('/execute', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { address, calls, accessToken } = req.body as { address: string; calls: unknown[]; accessToken: string };
    if (!address || !Array.isArray(calls) || !accessToken) {
      return res.status(400).json({ success: false, message: 'address, calls, accessToken are required' });
    }
    const result = await cavosService.execute(address, calls, accessToken);

    // Persist wallet address if user record is missing it
    if (req.user && !req.user.cavosWalletAddress && address) {
      const u = await User.findById(req.user._id);
      if (u && !u.cavosWalletAddress) {
        u.cavosWalletAddress = address;
        await u.save();
      }
    }

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, message: 'Execute failed', error: message });
  }
});

export { router as cavosRoutes };


