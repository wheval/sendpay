"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const BankAccount_1 = require("../models/BankAccount");
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const router = (0, express_1.Router)();
exports.userRoutes = router;
/**
 * GET /api/user/profile
 * Get authenticated user profile
 */
router.get('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const user = req.user;
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
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        const { name, bankDetails } = req.body;
        const user = req.user;
        if (name) {
            user.name = name;
        }
        if (bankDetails) {
            if (bankDetails.bankName && bankDetails.accountNumber && bankDetails.accountName) {
                // Validate account number
                if (!(0, helpers_1.validateNigerianAccountNumber)(bankDetails.accountNumber)) {
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
                cavosWalletAddress: user.cavosWalletAddress,
                balanceUSD: user.balanceUSD,
                balanceNGN: user.balanceNGN,
                bankDetails: user.bankDetails
            }
        });
    }
    catch (error) {
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
router.get('/balance', auth_1.authenticateToken, async (req, res) => {
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
    }
    catch (error) {
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
router.post('/bank-accounts', auth_1.authenticateToken, async (req, res) => {
    try {
        const { bankName, accountNumber, accountName, isDefault = false } = req.body;
        const userId = req.user._id;
        if (!bankName || !accountNumber || !accountName) {
            return res.status(400).json({
                success: false,
                message: 'Bank name, account number, and account name are required'
            });
        }
        if (!(0, helpers_1.validateNigerianAccountNumber)(accountNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid account number format'
            });
        }
        // Check if account number already exists for this user
        const existingAccount = await BankAccount_1.BankAccount.findOne({
            userId,
            accountNumber
        });
        if (existingAccount) {
            return res.status(400).json({
                success: false,
                message: 'Bank account already exists'
            });
        }
        const bankAccount = new BankAccount_1.BankAccount({
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
    }
    catch (error) {
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
router.get('/bank-accounts', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;
        const bankAccounts = await BankAccount_1.BankAccount.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
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
    }
    catch (error) {
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
router.put('/bank-accounts/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { bankName, accountNumber, accountName, isDefault } = req.body;
        const userId = req.user._id;
        const bankAccount = await BankAccount_1.BankAccount.findOne({ _id: id, userId });
        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: 'Bank account not found'
            });
        }
        if (bankName)
            bankAccount.bankName = bankName;
        if (accountNumber) {
            if (!(0, helpers_1.validateNigerianAccountNumber)(accountNumber)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid account number format'
                });
            }
            bankAccount.accountNumber = accountNumber;
        }
        if (accountName)
            bankAccount.accountName = accountName;
        if (typeof isDefault === 'boolean')
            bankAccount.isDefault = isDefault;
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
    }
    catch (error) {
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
router.delete('/bank-accounts/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const bankAccount = await BankAccount_1.BankAccount.findOne({ _id: id, userId });
        if (!bankAccount) {
            return res.status(404).json({
                success: false,
                message: 'Bank account not found'
            });
        }
        await BankAccount_1.BankAccount.findByIdAndDelete(id);
        res.json({
            success: true,
            message: 'Bank account deleted successfully'
        });
    }
    catch (error) {
        console.error('Bank account deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete bank account',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});
//# sourceMappingURL=user.js.map