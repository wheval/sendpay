# Environment Variables Setup

## Required Environment Variables

Create a `.env` file in the backend root directory with the following variables:

### Database Configuration
```bash
MONGODB_URI=mongodb://localhost:27017/sendpay
MONGODB_URI_TEST=mongodb://localhost:27017/sendpay_test
```

### JWT Configuration
```bash
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
```

### Server Configuration
```bash
PORT=5000
NODE_ENV=development
```

### Flutterwave Configuration
```bash
FLUTTERWAVE_CLIENT_ID=your_flutterwave_client_id
FLUTTERWAVE_CLIENT_SECRET=your_flutterwave_client_secret
FLUTTERWAVE_ENCRYPTION_KEY=your_flutterwave_encryption_key
FLUTTERWAVE_CALLBACK_URL=http://localhost:5000/api/flutterwave/webhook
```

### Starknet Configuration
```bash
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
SENDPAY_CONTRACT_ADDRESS=0x05adeea982017c957b9671fe1f0870d83b60868d688dca39681b415493c3ae99
USDC_TESTNET_ADDRESS=0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080
```


### Optional: CoinGecko API
```bash
COINGECKO_API_KEY=your_coingecko_api_key_here
```

## Getting Started

1. Copy the variables above to a `.env` file
2. Replace the placeholder values with your actual credentials
3. For testnet testing, you can use the default values for Starknet configuration
4. Flutterwave credentials can be obtained from your Flutterwave dashboard

## Testing Without Flutterwave

If you don't have Flutterwave credentials yet, the service will automatically fall back to a mock service that returns error messages. This allows the backend to start up and run other functionality while you set up Flutterwave.
