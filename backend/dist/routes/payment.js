"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRoutes = void 0;
const express_1 = require("express");
const Transaction_1 = require("../models/Transaction");
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../utils/helpers");
const exchangeRateService_1 = require("../services/exchangeRateService");
const router = (0, express_1.Router)();
exports.paymentRoutes = router;
/**
 * POST /api/payment/receive
 * Create a payment request (receive money)
 */
router.post('/receive', auth_1.authenticateToken, async (req, res) => {
    try {
        const { amount, currency, description } = req.body;
        const userId = req.user._id;
        if (!amount || !currency) {
            return res.status(400).json({
                success: false,
                message: 'Amount and currency are required'
            });
        }
        if (!['USD', 'NGN'].includes(currency)) {
            return res.status(400).json({
                success: false,
                message: 'Currency must be USD or NGN'
            });
        }
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0'
            });
        }
        // Generate unique reference
        const reference = (0, helpers_1.generateReference)();
        const transactionHash = (0, helpers_1.generateTransactionHash)();
        // Convert amount to both currencies for display
        let amountUSD = 0;
        let amountNGN = 0;
        if (currency === 'USD') {
            amountUSD = amount;
            amountNGN = await exchangeRateService_1.exchangeRateService.convertUSDToNGN(amount);
        }
        else {
            amountNGN = amount;
            amountUSD = await exchangeRateService_1.exchangeRateService.convertNGNToUSD(amount);
        }
        // Create transaction record
        const transaction = new Transaction_1.Transaction({
            userId,
            type: 'received',
            amountUSD,
            amountNGN,
            status: 'pending',
            description: description || `Payment request for ${amount} ${currency}`,
            reference,
            starknetTxHash: transactionHash
        });
        await transaction.save();
        // Generate payment link and QR code data
        const paymentLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pay/${reference}`;
        const qrCodeData = JSON.stringify({
            reference,
            amount,
            currency,
            description: description || `Payment request for ${amount} ${currency}`
        });
        res.json({
            success: true,
            message: 'Payment request created successfully',
            data: {
                reference,
                amountUSD,
                amountNGN,
                currency,
                description: transaction.description,
                paymentLink,
                qrCodeData,
                transactionId: transaction._id,
                status: transaction.status,
                createdAt: transaction.createdAt
            }
        });
    }
    catch (error) {
        console.error('Payment request creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment request',
            error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
        });
    }
});
/**
 * GET /api/payment/:reference
 * Get payment request details by reference
 */
router.get('/:reference', auth_1.optionalAuth, async (req, res) => {
    try {
        const { reference } = req.params;
        const transaction = await Transaction_1.Transaction.findOne({ reference }).populate('userId', 'name email');
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Payment request not found'
            });
        }
        // Check if payment is still pending
        if (transaction.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Payment request is no longer active',
                status: transaction.status
            });
        }
        // Handle populated userId field
        const recipientName = typeof transaction.userId === 'string' ? 'Unknown' :
            transaction.userId?.name || 'Unknown';
        const recipientEmail = typeof transaction.userId === 'string' ? 'Unknown' :
            transaction.userId?.email || 'Unknown';
        res.json({
            success: true,
            message: 'Payment request retrieved successfully',
            data: {
                reference: transaction.reference,
                amountUSD: transaction.amountUSD,
                amountNGN: transaction.amountNGN,
                description: transaction.description,
                recipientName,
                recipientEmail,
                status: transaction.status,
                createdAt: transaction.createdAt,
                expiresAt: new Date(transaction.createdAt.getTime() + 24 * 60 * 60 * 1000) // 24 hours
            }
        });
    }
    catch (error) {
        console.error('Payment request retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve payment request',
            error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
        });
    }
});
/**
 * POST /api/payment/:reference/process
 * Process a payment (simulate payment completion)
 */
router.post('/:reference/process', async (req, res) => {
    try {
        const { reference } = req.params;
        const { payerEmail, payerName } = req.body;
        if (!payerEmail || !payerName) {
            return res.status(400).json({
                success: false,
                message: 'Payer email and name are required'
            });
        }
        const transaction = await Transaction_1.Transaction.findOne({ reference }).populate('userId');
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Payment request not found'
            });
        }
        if (transaction.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Payment request is no longer active'
            });
        }
        // Simulate payment processing
        // In production, this would involve:
        // 1. Verifying payment on Starknet
        // 2. Updating user balances
        // 3. Recording the transaction
        // Update transaction status
        transaction.status = 'completed';
        await transaction.save();
        // Update recipient balance
        if (typeof transaction.userId !== 'string') {
            const recipient = transaction.userId;
            recipient.balanceUSD += transaction.amountUSD;
            recipient.balanceNGN += transaction.amountNGN;
            await recipient.save();
        }
        // In production, you would also:
        // 1. Listen for Starknet contract events
        // 2. Verify the actual USDC transfer
        // 3. Handle gas fees and processing fees
        res.json({
            success: true,
            message: 'Payment processed successfully',
            data: {
                reference: transaction.reference,
                amountUSD: transaction.amountUSD,
                amountNGN: transaction.amountNGN,
                status: transaction.status,
                processedAt: new Date(),
                transactionId: transaction._id
            }
        });
    }
    catch (error) {
        console.error('Payment processing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process payment',
            error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
        });
    }
});
/**
 * GET /api/payment/requests
 * Get user's payment requests
 */
router.get('/requests', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;
        const { status, limit = 10, page = 1 } = req.query;
        const query = { userId, type: 'received' };
        const statusStr = typeof status === 'string' ? status : undefined;
        if (statusStr && ['pending', 'completed', 'failed'].includes(statusStr)) {
            query.status = statusStr;
        }
        const skip = (Number(page) - 1) * Number(limit);
        const transactions = await Transaction_1.Transaction.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const total = await Transaction_1.Transaction.countDocuments(query);
        res.json({
            success: true,
            message: 'Payment requests retrieved successfully',
            data: {
                transactions: transactions.map(tx => ({
                    id: tx._id,
                    reference: tx.reference,
                    amountUSD: tx.amountUSD,
                    amountNGN: tx.amountNGN,
                    description: tx.description,
                    status: tx.status,
                    createdAt: tx.createdAt,
                    paymentLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pay/${tx.reference}`
                })),
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit))
                }
            }
        });
    }
    catch (error) {
        console.error('Payment requests retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve payment requests',
            error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : 'Internal server error'
        });
    }
});
//# sourceMappingURL=payment.js.map