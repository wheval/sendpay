"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
exports.authRoutes = router;
/**
 * POST /api/auth/login
 * Login with Google/Apple or email/password
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password, provider, token } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }
        if (!(0, helpers_1.validateEmail)(email)) {
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
            // Simulate token verification
            // In production: verify token with Google/Apple APIs
            console.log(`Verifying ${provider} token:`, token);
        }
        // Find or create user
        let user = await User_1.User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // For MVP, create a mock user with a generated Cavos wallet
            // In production, this would be handled by Cavos SDK
            const mockCavosWallet = `0x${Math.random().toString(16).substring(2, 34)}`;
            user = new User_1.User({
                email: email.toLowerCase(),
                name: email.split('@')[0], // Use email prefix as name
                cavosWalletAddress: mockCavosWallet,
                bankDetails: {
                    bankName: 'Not Set',
                    accountNumber: '0000000000',
                    accountName: 'Not Set'
                },
                balanceUSD: 0,
                balanceNGN: 0
            });
            await user.save();
            console.log('✅ New user created with mock Cavos wallet');
        }
        // Generate JWT token
        const jwtToken = (0, auth_1.generateToken)(user._id?.toString() || '');
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
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
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
router.post('/onboarding', async (req, res) => {
    try {
        const { email, name, bankDetails } = req.body;
        if (!email || !name || !bankDetails) {
            return res.status(400).json({
                success: false,
                message: 'Email, name, and bank details are required'
            });
        }
        if (!(0, helpers_1.validateEmail)(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }
        // Find user
        const user = await User_1.User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        // Update user with onboarding information
        user.name = name;
        user.bankDetails = {
            bankName: bankDetails.bankName,
            accountNumber: bankDetails.accountNumber,
            accountName: bankDetails.accountName
        };
        await user.save();
        // Generate new token
        const jwtToken = (0, auth_1.generateToken)(user._id?.toString() || '');
        res.json({
            success: true,
            message: 'Onboarding completed successfully',
            token: jwtToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                cavosWalletAddress: user.cavosWalletAddress,
                balanceUSD: user.balanceUSD,
                balanceNGN: user.balanceNGN,
                bankDetails: user.bankDetails
            }
        });
    }
    catch (error) {
        console.error('Onboarding error:', error);
        res.status(500).json({
            success: false,
            message: 'Onboarding failed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});
/**
 * GET /api/auth/profile
 * Get user profile (protected route)
 */
router.get('/profile', async (req, res) => {
    try {
        // This route would be protected by auth middleware in production
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }
        const user = await User_1.User.findOne({ email: email.toString().toLowerCase() });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.json({
            success: true,
            message: 'Profile retrieved successfully',
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                cavosWalletAddress: user.cavosWalletAddress,
                balanceUSD: user.balanceUSD,
                balanceNGN: user.balanceNGN,
                bankDetails: user.bankDetails
            }
        });
    }
    catch (error) {
        console.error('Profile retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve profile',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});
/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', (req, res) => {
    // In a stateless JWT system, logout is handled client-side
    // by removing the token from storage
    res.json({
        success: true,
        message: 'Logout successful'
    });
});
//# sourceMappingURL=auth.js.map