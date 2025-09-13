import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { apibaraService } from '../services/apibara.service';

const router = Router();

/**
 * @route   GET /api/apibara/events
 * @desc    Get events from a specific contract
 * @access  Private
 */
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const { contractAddress, eventName, fromBlock, toBlock } = req.query;

    if (!contractAddress) {
      return res.status(400).json({
        success: false,
        message: 'Contract address is required'
      });
    }

    const events = await apibaraService.getEvents({
      contractAddress: contractAddress as string,
      eventName: eventName as string,
      fromBlock: fromBlock ? parseInt(fromBlock as string) : undefined,
      toBlock: toBlock ? parseInt(toBlock as string) : undefined
    });

    res.json({
      success: true,
      data: events
    });

  } catch (error: any) {
    console.error('Apibara events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/apibara/transactions
 * @desc    Get transactions for a wallet or contract
 * @access  Private
 */
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { walletAddress, contractAddress, fromBlock, toBlock, status } = req.query;

    const transactions = await apibaraService.getTransactions({
      walletAddress: walletAddress as string,
      contractAddress: contractAddress as string,
      fromBlock: fromBlock ? parseInt(fromBlock as string) : undefined,
      toBlock: toBlock ? parseInt(toBlock as string) : undefined,
      status: status as 'ACCEPTED' | 'REJECTED' | 'PENDING'
    });

    res.json({
      success: true,
      data: transactions
    });

  } catch (error: any) {
    console.error('Apibara transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/apibara/usdc-transfers/:address
 * @desc    Get USDC transfers for a specific address
 * @access  Private
 */
router.get('/usdc-transfers/:address', authenticateToken, async (req, res) => {
  try {
    const { address } = req.params;
    const { fromBlock, toBlock } = req.query;

    const transfers = await apibaraService.getUSDCTransfers(
      address,
      fromBlock ? parseInt(fromBlock as string) : undefined,
      toBlock ? parseInt(toBlock as string) : undefined
    );

    res.json({
      success: true,
      data: transfers
    });

  } catch (error: any) {
    console.error('Apibara USDC transfers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch USDC transfers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/apibara/sendpay-events
 * @desc    Get SendPay contract events
 * @access  Private
 */
router.get('/sendpay-events', authenticateToken, async (req, res) => {
  try {
    const { eventName, fromBlock, toBlock } = req.query;

    const events = await apibaraService.getSendPayEvents(
      eventName as string,
      fromBlock ? parseInt(fromBlock as string) : undefined,
      toBlock ? parseInt(toBlock as string) : undefined
    );

    res.json({
      success: true,
      data: events
    });

  } catch (error: any) {
    console.error('Apibara SendPay events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SendPay events',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/apibara/latest-block
 * @desc    Get latest block number
 * @access  Private
 */
router.get('/latest-block', authenticateToken, async (req, res) => {
  try {
    const blockNumber = await apibaraService.getLatestBlock();

    res.json({
      success: true,
      data: { blockNumber }
    });

  } catch (error: any) {
    console.error('Apibara latest block error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get latest block',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/apibara/block/:blockNumber
 * @desc    Get block information
 * @access  Private
 */
router.get('/block/:blockNumber', authenticateToken, async (req, res) => {
  try {
    const { blockNumber } = req.params;
    const block = await apibaraService.getBlock(parseInt(blockNumber));

    res.json({
      success: true,
      data: block
    });

  } catch (error: any) {
    console.error('Apibara block error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get block information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/apibara/transaction/:hash
 * @desc    Get transaction details
 * @access  Private
 */
router.get('/transaction/:hash', authenticateToken, async (req, res) => {
  try {
    const { hash } = req.params;
    const transaction = await apibaraService.getTransaction(hash);

    res.json({
      success: true,
      data: transaction
    });

  } catch (error: any) {
    console.error('Apibara transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get transaction details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/apibara/balance/:address/:tokenAddress
 * @desc    Get token balance for a specific address
 * @access  Private
 */
router.get('/balance/:address/:tokenAddress', authenticateToken, async (req, res) => {
  try {
    const { address, tokenAddress } = req.params;
    const balance = await apibaraService.getTokenBalance(address, tokenAddress);

    res.json({
      success: true,
      data: { address, tokenAddress, balance }
    });

  } catch (error: any) {
    console.error('Apibara balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get token balance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/apibara/wallet-history/:address
 * @desc    Get transaction history for a wallet
 * @access  Private
 */
router.get('/wallet-history/:address', authenticateToken, async (req, res) => {
  try {
    const { address } = req.params;
    const { limit } = req.query;

    const transactions = await apibaraService.getWalletHistory(
      address,
      limit ? parseInt(limit as string) : 50
    );

    res.json({
      success: true,
      data: transactions
    });

  } catch (error: any) {
    console.error('Apibara wallet history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get wallet history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/apibara/transaction-status/:hash
 * @desc    Check if a transaction is confirmed
 * @access  Private
 */
router.get('/transaction-status/:hash', authenticateToken, async (req, res) => {
  try {
    const { hash } = req.params;
    const isConfirmed = await apibaraService.isTransactionConfirmed(hash);

    res.json({
      success: true,
      data: { transactionHash: hash, isConfirmed }
    });

  } catch (error: any) {
    console.error('Apibara transaction status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check transaction status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/apibara/gas-price
 * @desc    Get gas price estimate
 * @access  Private
 */
router.get('/gas-price', authenticateToken, async (req, res) => {
  try {
    const gasPrice = await apibaraService.getGasPrice();

    res.json({
      success: true,
      data: { gasPrice }
    });

  } catch (error: any) {
    console.error('Apibara gas price error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get gas price',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

export { router as apibaraRoutes };

