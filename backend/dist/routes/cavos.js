"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cavosRoutes = void 0;
const express_1 = __importDefault(require("express"));
const cavosService_1 = require("../services/cavosService");
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const auth_2 = require("../middleware/auth");
const router = express_1.default.Router();
exports.cavosRoutes = router;
// POST /api/cavos/signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        const result = await cavosService_1.cavosService.signUp(email, password);
        // Upsert local user and issue our JWT
        const walletAddress = result.wallet?.address || '';
        let user = await User_1.User.findOne({ email: email.toLowerCase() });
        if (!user) {
            user = new User_1.User({
                email: email.toLowerCase(),
                name: email.split('@')[0],
                cavosWalletAddress: walletAddress,
                bankDetails: { bankName: 'Not Set', accountNumber: 'Not Set', accountName: 'Not Set' },
                balanceUSD: 0,
                balanceNGN: 0
            });
            await user.save();
        }
        else if (!user.cavosWalletAddress && walletAddress) {
            user.cavosWalletAddress = walletAddress;
            await user.save();
        }
        const token = (0, auth_2.generateToken)(user._id?.toString() || '');
        res.json({ success: true, data: result, token, user: {
                id: user._id,
                email: user.email,
                name: user.name,
                cavosWalletAddress: user.cavosWalletAddress,
                balanceUSD: user.balanceUSD,
                balanceNGN: user.balanceNGN
            } });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message: 'Signup failed', error: message });
    }
});
// POST /api/cavos/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        const result = await cavosService_1.cavosService.signIn(email, password);
        // Upsert local user and issue our JWT
        const walletAddress = result.wallet?.address || '';
        let user = await User_1.User.findOne({ email: email.toLowerCase() });
        if (!user) {
            user = new User_1.User({
                email: email.toLowerCase(),
                name: email.split('@')[0],
                cavosWalletAddress: walletAddress,
                bankDetails: { bankName: 'Not Set', accountNumber: 'Not Set', accountName: 'Not Set' },
                balanceUSD: 0,
                balanceNGN: 0
            });
            await user.save();
        }
        else if (!user.cavosWalletAddress && walletAddress) {
            user.cavosWalletAddress = walletAddress;
            await user.save();
        }
        const token = (0, auth_2.generateToken)(user._id?.toString() || '');
        res.json({ success: true, data: result, token, user: {
                id: user._id,
                email: user.email,
                name: user.name,
                cavosWalletAddress: user.cavosWalletAddress,
                balanceUSD: user.balanceUSD,
                balanceNGN: user.balanceNGN
            } });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message: 'Login failed', error: message });
    }
});
// POST /api/cavos/refresh
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, message: 'refreshToken is required' });
        }
        const result = await cavosService_1.cavosService.refreshToken(refreshToken);
        res.json({ success: true, data: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message: 'Token refresh failed', error: message });
    }
});
// GET /api/cavos/balance/:address?tokenAddress=...&decimals=18
router.get('/balance/:address', auth_1.authenticateToken, async (req, res) => {
    try {
        const { address } = req.params;
        const { tokenAddress, decimals = '18' } = req.query;
        if (!tokenAddress) {
            return res.status(400).json({ success: false, message: 'tokenAddress is required' });
        }
        const result = await cavosService_1.cavosService.getBalance(address, tokenAddress, decimals);
        res.json({ success: true, data: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message: 'Balance check failed', error: message });
    }
});
// POST /api/cavos/execute
router.post('/execute', auth_1.authenticateToken, async (req, res) => {
    try {
        const { address, calls, accessToken } = req.body;
        if (!address || !Array.isArray(calls) || !accessToken) {
            return res.status(400).json({ success: false, message: 'address, calls, accessToken are required' });
        }
        const result = await cavosService_1.cavosService.execute(address, calls, accessToken);
        res.json({ success: true, data: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message: 'Execute failed', error: message });
    }
});
//# sourceMappingURL=cavos.js.map