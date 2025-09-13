# Apibara Starknet Indexer Integration

This document describes the integration of Apibara Starknet Indexer into the SendPay backend for efficient blockchain data indexing and event tracking.

## Overview

Apibara provides a powerful indexing solution for Starknet that allows us to:
- Track contract events in real-time
- Monitor USDC transfers
- Get transaction history
- Check token balances
- Monitor gas prices
- Track SendPay contract events

## Features Implemented

### 1. ApibaraService (`src/services/apibaraService.ts`)

Core service that handles all Apibara API interactions:

- **Event Tracking**: Get events from specific contracts
- **Transaction Monitoring**: Track wallet and contract transactions
- **USDC Transfer Tracking**: Monitor USDC transfers for specific addresses
- **SendPay Events**: Track SendPay contract events
- **Block Information**: Get latest blocks and block details
- **Transaction Details**: Get detailed transaction information
- **Token Balances**: Get real-time token balances
- **Gas Price Monitoring**: Get current gas prices
- **Transaction Status**: Check if transactions are confirmed

### 2. API Routes (`src/routes/apibara.ts`)

RESTful API endpoints for frontend integration:

```
GET /api/apibara/events                    # Get contract events
GET /api/apibara/transactions              # Get transactions
GET /api/apibara/usdc-transfers/:address   # Get USDC transfers
GET /api/apibara/sendpay-events            # Get SendPay events
GET /api/apibara/latest-block              # Get latest block
GET /api/apibara/block/:blockNumber        # Get block info
GET /api/apibara/transaction/:hash         # Get transaction details
GET /api/apibara/balance/:address/:token   # Get token balance
GET /api/apibara/wallet-history/:address   # Get wallet history
GET /api/apibara/transaction-status/:hash  # Check transaction status
GET /api/apibara/gas-price                 # Get gas price
```

### 3. Event Monitoring

Apibara provides efficient event monitoring with:
- Real-time event tracking
- Efficient block processing
- Better error handling
- Duplicate event prevention

### 4. Improved Balance Checking

Cavos service now uses Apibara for:
- Faster balance queries
- More accurate balance data
- Fallback to Starknet RPC if needed

## Environment Variables

Add these to your `.env` file:

```bash
# Apibara Configuration
APIBARA_API_KEY=your_apibara_api_key
APIBARA_BASE_URL=https://api.apibara.com
STARKNET_NETWORK=sepolia  # or mainnet

# Contract Addresses
SENDPAY_CONTRACT_ADDRESS=your_deployed_contract_address
USDC_TESTNET_ADDRESS=your_usdc_contract_address
```

## Usage Examples

### Get SendPay Contract Events

```typescript
import { apibaraService } from './services/apibaraService';

// Get all SendPay events from the last 100 blocks
const events = await apibaraService.getSendPayEvents(
  undefined, // all events
  latestBlock - 100,
  latestBlock
);
```

### Monitor USDC Transfers

```typescript
// Get USDC transfers for a specific address
const transfers = await apibaraService.getUSDCTransfers(
  '0x123...',
  fromBlock,
  toBlock
);
```

### Check Transaction Status

```typescript
// Check if a transaction is confirmed
const isConfirmed = await apibaraService.isTransactionConfirmed(
  '0xabc...'
);
```

### Get Real-time Balance

```typescript
// Get USDC balance for an address
const balance = await apibaraService.getTokenBalance(
  '0x123...',
  '0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080'
);
```

## API Response Format

### Events Response

```json
{
  "success": true,
  "data": [
    {
      "id": "event_id",
      "transaction_hash": "0x...",
      "block_number": 12345,
      "block_timestamp": 1234567890,
      "contract_address": "0x...",
      "event_name": "PaymentReceived",
      "event_data": {
        "from": "0x...",
        "amount": "1000000",
        "reference": "ref_123"
      },
      "log_index": 0
    }
  ]
}
```

### Transaction Response

```json
{
  "success": true,
  "data": [
    {
      "id": "tx_id",
      "transaction_hash": "0x...",
      "block_number": 12345,
      "block_timestamp": 1234567890,
      "status": "ACCEPTED",
      "gas_consumed": 100000,
      "gas_price": 1000000000,
      "sender_address": "0x..."
    }
  ]
}
```

## Benefits

1. **Performance**: Faster queries compared to direct RPC calls
2. **Reliability**: Built-in retry mechanisms and error handling
3. **Real-time**: Efficient event monitoring and updates
4. **Scalability**: Handles high-volume blockchain data
5. **Cost-effective**: Reduces RPC call costs
6. **Developer-friendly**: Simple API with comprehensive documentation

## Error Handling

The service includes comprehensive error handling:

- **API Key Missing**: Graceful degradation with warnings
- **Network Errors**: Automatic retries with exponential backoff
- **Rate Limiting**: Respects API limits with proper delays
- **Fallback Mechanisms**: Falls back to Starknet RPC when needed

## Monitoring

The service logs important events:

- Event processing status
- Transaction confirmations
- Balance updates
- Error conditions
- Performance metrics

## Future Enhancements

1. **WebSocket Support**: Real-time event streaming
2. **Caching Layer**: Redis integration for frequently accessed data
3. **Analytics Dashboard**: Transaction and event analytics
4. **Alert System**: Notifications for important events
5. **Multi-chain Support**: Extend to other networks

## Troubleshooting

### Common Issues

1. **API Key Not Found**
   - Check environment variables
   - Verify API key is valid

2. **Network Errors**
   - Check internet connection
   - Verify Apibara service status

3. **Rate Limiting**
   - Implement proper delays between requests
   - Use batch requests when possible

### Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
```

This will show detailed error messages and API responses.

