"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionRoutes = void 0;
const express_1 = require("express");
const Transaction_1 = require("../models/Transaction");
const auth_1 = require("../middleware/auth");
const exchangeRateService_1 = require("../services/exchangeRateService");
const router = (0, express_1.Router)();
exports.transactionRoutes = router;
/**
 * GET /api/transaction/history
 * Get user's transaction history
 */
router.get('/history', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;
        const { type, status, startDate, endDate, limit = 20, page = 1, search } = req.query;
        // Build query
        const query = { userId };
        if (type && ['received', 'withdrawn'].includes(type)) {
            query.type = type;
        }
        if (status && ['pending', 'completed', 'failed'].includes(status)) {
            query.status = status;
        }
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }
        if (search) {
            query.$or = [
                { description: { $regex: search, $options: 'i' } },
                { reference: { $regex: search, $options: 'i' } }
            ];
        }
        const skip = (Number(page) - 1) * Number(limit);
        const transactions = await Transaction_1.Transaction.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const total = await Transaction_1.Transaction.countDocuments(query);
        // Get current exchange rate for summary
        const exchangeRate = await exchangeRateService_1.exchangeRateService.getUSDToNGNRate();
        // Calculate summary statistics
        const summary = {
            totalReceivedUSD: 0,
            totalReceivedNGN: 0,
            totalWithdrawnUSD: 0,
            totalWithdrawnNGN: 0,
            pendingTransactions: 0,
            completedTransactions: 0,
            failedTransactions: 0
        };
        transactions.forEach(tx => {
            if (tx.type === 'received') {
                summary.totalReceivedUSD += tx.amountUSD;
                summary.totalReceivedNGN += tx.amountNGN;
            }
            else {
                summary.totalWithdrawnUSD += tx.amountUSD;
                summary.totalWithdrawnNGN += tx.amountNGN;
            }
            if (tx.status === 'pending')
                summary.pendingTransactions++;
            else if (tx.status === 'completed')
                summary.completedTransactions++;
            else if (tx.status === 'failed')
                summary.failedTransactions++;
        });
        res.json({
            success: true,
            message: 'Transaction history retrieved successfully',
            data: {
                transactions: transactions.map(tx => {
                    // Calculate age manually since virtual might not be available
                    const age = tx.createdAt ? (() => {
                        const now = new Date();
                        const created = tx.createdAt;
                        const diffInHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
                        if (diffInHours < 1)
                            return 'Just now';
                        if (diffInHours < 24)
                            return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
                        const diffInDays = Math.floor(diffInHours / 24);
                        if (diffInDays < 7)
                            return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
                        const diffInWeeks = Math.floor(diffInDays / 7);
                        if (diffInWeeks < 4)
                            return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
                        const diffInMonths = Math.floor(diffInDays / 30);
                        return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
                    })() : 'Unknown';
                    return {
                        id: tx._id,
                        type: tx.type,
                        amountUSD: tx.amountUSD,
                        amountNGN: tx.amountNGN,
                        status: tx.status,
                        description: tx.description,
                        reference: tx.reference,
                        starknetTxHash: tx.starknetTxHash,
                        bankDetails: tx.bankDetails,
                        createdAt: tx.createdAt,
                        age,
                        formattedAmountUSD: tx.amountUSD.toFixed(2),
                        formattedAmountNGN: tx.amountNGN.toLocaleString()
                    };
                }),
                summary: {
                    ...summary,
                    currentExchangeRate: exchangeRate,
                    netBalanceUSD: summary.totalReceivedUSD - summary.totalWithdrawnUSD,
                    netBalanceNGN: summary.totalReceivedNGN - summary.totalWithdrawnNGN
                },
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
        console.error('Transaction history retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve transaction history',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});
/**
 * GET /api/transaction/:id
 * Get specific transaction details
 */
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const transaction = await Transaction_1.Transaction.findOne({ _id: id, userId });
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }
        // Calculate age manually
        const age = transaction.createdAt ? (() => {
            const now = new Date();
            const created = transaction.createdAt;
            const diffInHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
            if (diffInHours < 1)
                return 'Just now';
            if (diffInHours < 24)
                return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
            const diffInDays = Math.floor(diffInHours / 24);
            if (diffInDays < 7)
                return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
            const diffInWeeks = Math.floor(diffInDays / 7);
            if (diffInWeeks < 4)
                return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
            const diffInMonths = Math.floor(diffInDays / 30);
            return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
        })() : 'Unknown';
        res.json({
            success: true,
            message: 'Transaction details retrieved successfully',
            data: {
                id: transaction._id,
                type: transaction.type,
                amountUSD: transaction.amountUSD,
                amountNGN: transaction.amountNGN,
                status: transaction.status,
                description: transaction.description,
                reference: transaction.reference,
                starknetTxHash: transaction.starknetTxHash,
                bankDetails: transaction.bankDetails,
                createdAt: transaction.createdAt,
                updatedAt: transaction.updatedAt,
                age,
                formattedAmountUSD: transaction.amountUSD.toFixed(2),
                formattedAmountNGN: transaction.amountNGN.toLocaleString()
            }
        });
    }
    catch (error) {
        console.error('Transaction details retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve transaction details',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});
/**
 * GET /api/transaction/summary
 * Get transaction summary and statistics
 */
router.get('/summary', auth_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user._id;
        const { period = '30d' } = req.query;
        // Calculate date range based on period
        let startDate = new Date();
        switch (period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                startDate.setDate(startDate.getDate() - 30);
        }
        // Get transactions in date range
        const transactions = await Transaction_1.Transaction.find({
            userId,
            createdAt: { $gte: startDate }
        });
        // Calculate statistics
        const stats = {
            totalTransactions: transactions.length,
            totalReceivedUSD: 0,
            totalReceivedNGN: 0,
            totalWithdrawnUSD: 0,
            totalWithdrawnNGN: 0,
            pendingCount: 0,
            completedCount: 0,
            failedCount: 0,
            averageTransactionUSD: 0,
            averageTransactionNGN: 0
        };
        transactions.forEach(tx => {
            if (tx.type === 'received') {
                stats.totalReceivedUSD += tx.amountUSD;
                stats.totalReceivedNGN += tx.amountNGN;
            }
            else {
                stats.totalWithdrawnUSD += tx.amountUSD;
                stats.totalWithdrawnNGN += tx.amountNGN;
            }
            if (tx.status === 'pending')
                stats.pendingCount++;
            else if (tx.status === 'completed')
                stats.completedCount++;
            else if (tx.status === 'failed')
                stats.failedCount++;
        });
        // Calculate averages
        if (stats.totalTransactions > 0) {
            stats.averageTransactionUSD = (stats.totalReceivedUSD + stats.totalWithdrawnUSD) / stats.totalTransactions;
            stats.averageTransactionNGN = (stats.totalReceivedNGN + stats.totalWithdrawnNGN) / stats.totalTransactions;
        }
        // Get current exchange rate
        const exchangeRate = await exchangeRateService_1.exchangeRateService.getUSDToNGNRate();
        res.json({
            success: true,
            message: 'Transaction summary retrieved successfully',
            data: {
                period,
                startDate,
                endDate: new Date(),
                statistics: stats,
                exchangeRate,
                netFlow: {
                    USD: stats.totalReceivedUSD - stats.totalWithdrawnUSD,
                    NGN: stats.totalReceivedNGN - stats.totalWithdrawnNGN
                }
            }
        });
    }
    catch (error) {
        console.error('Transaction summary retrieval error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve transaction summary',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});
/**
 * POST /api/transaction/:id/cancel
 * Cancel a pending transaction
 */
router.post('/:id/cancel', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const transaction = await Transaction_1.Transaction.findOne({ _id: id, userId });
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }
        if (transaction.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Only pending transactions can be cancelled'
            });
        }
        // Update transaction status
        transaction.status = 'failed';
        await transaction.save();
        res.json({
            success: true,
            message: 'Transaction cancelled successfully',
            data: {
                id: transaction._id,
                status: transaction.status,
                cancelledAt: new Date()
            }
        });
    }
    catch (error) {
        console.error('Transaction cancellation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel transaction',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});
//# sourceMappingURL=transaction.js.map