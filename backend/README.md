# SendPay Backend API

A Node.js/Express backend API for the SendPay fintech application, providing Starknet blockchain integration, payment processing, and user management.

> Note: This README is the single source of truth for backend documentation. All backend docs have been consolidated here.

## 🚀 Features

- **Authentication & Authorization**: JWT-based authentication with middleware protection
- **User Management**: User profiles, bank account management, and onboarding
- **Payment Processing**: Create payment requests, QR codes, and payment links
- **Transaction Management**: Complete transaction history with filtering and search
- **Starknet Integration**: USDC balance checking, transaction status, and network info
- **Exchange Rate Service**: Real-time USD/NGN conversion with caching
- **Bank Account Management**: Multiple bank accounts with validation
- **RESTful API**: Clean, documented endpoints with proper error handling

## 🛠️ Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Blockchain**: Starknet integration with starknet.js
- **Validation**: Built-in validation with helper functions
- **Environment**: Configurable with dotenv

## 📁 Project Structure

```
src/
├── controllers/          # Route controllers (to be implemented)
├── middleware/           # Authentication and validation middleware
├── models/              # MongoDB schemas and models
├── routes/              # API route definitions
├── services/            # Business logic services
├── types/               # TypeScript type definitions
├── utils/               # Utility functions and helpers
└── index.ts             # Main application entry point
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sendpay/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   PORT=3001
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/sendpay
   JWT_SECRET=your_jwt_secret_here
   STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
   SENDPAY_CONTRACT_ADDRESS=0x0444d5c9b2a6375bdce805338cdf6340439be92aec2e854704e77bedcdfd929a
   USDC_TESTNET_ADDRESS=0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080
   
   # Apibara (DNA) — required to run the indexer
   DNA_TOKEN=your_apibara_api_key
   # Optional overrides (used by presets if provided)
   APIBARA_STREAM_URL=https://mainnet.starknet.a5a.ch
   APIBARA_STREAM_URL_SEPOLIA=https://sepolia.starknet.a5a.ch
   # Optional
   COINGECKO_API_KEY=your_coingecko_api_key_here
   FLUTTERWAVE_CLIENT_ID=your_flutterwave_client_id
   FLUTTERWAVE_CLIENT_SECRET=your_flutterwave_client_secret
   FLUTTERWAVE_ENCRYPTION_KEY=your_flutterwave_encryption_key
   FLUTTERWAVE_CALLBACK_URL=http://localhost:3001/api/flutterwave/webhook
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - User login (Google/Apple or email)
- `POST /api/auth/onboarding` - Complete user onboarding
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/logout` - User logout

### User Management
- `GET /api/user/profile` - Get authenticated user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/balance` - Get user balance
- `POST /api/user/bank-accounts` - Add bank account
- `GET /api/user/bank-accounts` - Get user's bank accounts
- `PUT /api/user/bank-accounts/:id` - Update bank account
- `DELETE /api/user/bank-accounts/:id` - Delete bank account

### Payment Processing
- `POST /api/payment/receive` - Create payment request
- `GET /api/payment/:reference` - Get payment request details
- `POST /api/payment/:reference/process` - Process payment
- `GET /api/payment/requests` - Get user's payment requests

### Transaction Management
- `GET /api/transaction/history` - Get transaction history
- `GET /api/transaction/:id` - Get transaction details
- `GET /api/transaction/summary` - Get transaction summary
- `POST /api/transaction/:id/cancel` - Cancel pending transaction

### Starknet Integration
- `GET /api/starknet/network-info` - Get network information
- `GET /api/starknet/balance/:address` - Get USDC balance
- `GET /api/starknet/transaction/:hash` - Get transaction status
- `POST /api/starknet/withdraw` - Initiate withdrawal
- `GET /api/starknet/exchange-rate` - Get exchange rate
- `GET /api/starknet/contract-address` - Get contract addresses

Note: Apibara indexers run out-of-process and do not expose HTTP routes.

## 🔧 Development

### Available Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests (to be implemented)
- `npm run apibara:dev` - Run indexers in dev mode (hot reload)
- `npm run apibara:dev:sepolia` - Dev mode using the `sepolia` preset
- `npm run apibara:build` - Build indexers for production
- `npm run apibara:start` - Start a single built indexer (add `-- --preset=sepolia` if needed)

Indexer entry: `backend/indexers/sendpay.indexer.ts`
Config: `backend/apibara.config.ts` (single `sendpay` key with `presets`)

### Code Style

- Use TypeScript for type safety
- Follow Express.js best practices
- Implement proper error handling
- Use async/await for asynchronous operations
- Validate all input data
- Implement proper logging

### Database Models

- **User**: User profiles, balances, and bank details
- **Transaction**: Payment and withdrawal records
- **BankAccount**: User's bank account information

## 🔐 Security Features

- JWT-based authentication
- Password hashing (to be implemented)
- Input validation and sanitization
- CORS configuration
- Environment variable protection
- Rate limiting (to be implemented)

## 🌐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment mode | development |
| `MONGODB_URI` | MongoDB connection string | localhost:27017/sendpay |
| `JWT_SECRET` | JWT signing secret | required |
| `STARKNET_RPC_URL` | Starknet RPC endpoint | sepolia public RPC |
| `USDC_TESTNET_ADDRESS` | USDC contract address (Sepolia) | provided above |

## 🔄 Integration Points

### Frontend
- RESTful API endpoints for all operations
- JWT token authentication
- Real-time balance updates
- Payment request creation and management

### Blockchain
- Starknet (Sepolia/Mainnet) integration
- USDC token balance checking
- Transaction status monitoring
- Apibara indexer streams contract events to MongoDB

### External Services
- Exchange rate APIs (CurrencyLayer, etc.)
- Payment gateways (Paystack, Flutterwave)
- Authentication providers (Google, Apple)

---

## ✅ Consolidated Guides

### Environment Setup (Consolidated)
- Create `.env` in `backend/` with variables listed in Getting Started → Environment Configuration.
- Optional keys: `COINGECKO_API_KEY`, Flutterwave credentials for NGN transfers.
- Testing helpers: you may add `MONGODB_URI_TEST` if you run tests locally.

### Apibara Integration (Consolidated)
- Purpose: run a Starknet indexer that listens to SendPay contract events and writes to MongoDB.
- Key env: `DNA_TOKEN`, optional stream URLs; contract address via `SENDPAY_CONTRACT_ADDRESS` or preset-specific envs.
- Commands: see Available Scripts — `apibara:dev`, `apibara:build`, `apibara:start`.
- Files: `indexers/sendpay.indexer.ts`, `apibara.config.ts`. The legacy `apibara` HTTP routes/service have been removed.

### Flutterwave Integration (Consolidated)
- Scope: NGN→NGN transfers from Flutterwave balance to Nigerian bank accounts.
- Required env:
  - `FLUTTERWAVE_CLIENT_ID`, `FLUTTERWAVE_CLIENT_SECRET`
  - `FLUTTERWAVE_ENCRYPTION_KEY`
  - `FLUTTERWAVE_CALLBACK_URL`
- Key routes (`src/routes/flutterwave.ts`):
  - Banks, verify account, initiate transfer, bulk transfer, status, list transfers, retry, fees, balance, webhook
- Implemented service methods live in `src/services/flutterwave.service.ts`.

---

## 🚧 TODO / Future Enhancements

- [ ] Implement Cairo smart contracts
- [ ] Add real-time WebSocket support
- [ ] Implement rate limiting
- [ ] Add comprehensive logging
- [ ] Implement caching layer
- [ ] Add unit and integration tests
- [ ] Implement admin dashboard
- [ ] Add payment gateway integrations
- [ ] Implement webhook handling
- [ ] Add monitoring and analytics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions, please contact the development team or create an issue in the repository.
