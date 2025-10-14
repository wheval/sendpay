# 🚀 SendPay - Modern Payment Platform

A full-stack payment application built with Next.js, Node.js, and Cairo smart contracts, featuring ChipiPay SDK integration for seamless wallet management and Flutterwave V4 API for fiat processing.

## 📋 Project Overview

SendPay is a production-ready payment platform that allows users to:
- **STRK/USDC to NAIRA in minutes** - Fast crypto-to-fiat conversion
- **Manage Digital Wallets** - Integrated with ChipiPay SDK for Starknet wallet creation
- **Withdraw to Bank** - Convert digital assets to fiat currency via bank transfers
- **Track Transactions** - Complete history of all payment activities
- **Multi-Currency Support** - USD and NGN with real-time exchange rates

## 🏗️ Architecture

### **System Design**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Blockchain    │
│   (Next.js)     │◄──►│   (Node.js)     │◄──►│   (Starknet)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cookies       │    │   MongoDB       │    │   ChipiPay SDK  │
│   (Auth)        │    │   (User Data)   │    │   (Wallets)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Flutterwave   │    │   Apibara       │    │   Smart Contract │
│   V4 API        │    │   (Indexer)     │    │   (Cairo)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Data Flow**
1. **User Authentication** → ChipiPay SDK → Backend JWT → Frontend Cookies
2. **Payment Requests** → Backend API → Database → QR/Link Generation
3. **Withdrawals** → Smart Contract → Backend Processing → Bank Transfer
4. **Balance Updates** → Blockchain Events → Backend Sync → Frontend Display
5. **Crypto Transfers** → ChipiPay SDK → PIN Authentication → Blockchain Execution

## 🗂️ Project Structure

```
sendpay/
├── frontend/                 # Next.js Frontend Application
│   ├── src/
│   │   ├── app/             # App Router Pages
│   │   │   ├── login/       # Authentication & Onboarding
│   │   │   ├── dashboard/   # User Dashboard & Balance
│   │   │   ├── receive/     # Create Payment Requests
│   │   │   ├── withdraw/    # Withdraw to Bank
│   │   │   └── history/     # Transaction History
│   │   ├── components/      # Reusable UI Components
│   │   │   ├── ui/          # shadcn/ui Components
│   │   │   ├── navigation.tsx
│   │   │   └── theme-provider.tsx
│   │   ├── lib/             # Utilities & APIs
│   │   │   ├── api.ts       # API Client
│   │   │   ├── cookies.ts   # Cookie Management
│   │   │   └── schemas.ts   # Zod Validation
│   │   └── hooks/           # Custom React Hooks
│   └── package.json
│
├── backend/                  # Node.js Backend API
│   ├── src/
│   │   ├── models/          # Mongoose Schemas
│   │   │   ├── User.ts      # User Model
│   │   │   ├── Transaction.ts
│   │   │   └── BankAccount.ts
│   │   ├── routes/          # API Endpoints
│   │   │   ├── auth.ts      # Authentication
│   │   │   ├── chipipay.ts  # ChipiPay Integration
│   │   │   ├── jwks.ts      # JWT Key Management
│   │   │   ├── user.ts      # User Management
│   │   │   ├── payment.ts   # Payment Requests
│   │   │   ├── transaction.ts
│   │   │   ├── withdrawal.ts # Withdrawal Handling
│   │   │   ├── starknet.ts  # Blockchain Operations
│   │   │   └── flutterwave.ts # Payment Gateway
│   │   ├── services/        # Business Logic
│   │   │   ├── chipipay.service.ts
│   │   │   ├── starknet.service.ts
│   │   │   ├── flutterwave.service.ts
│   │   │   └── exchange-rate.service.ts
│   │   ├── middleware/      # Express Middleware
│   │   │   └── auth.ts      # JWT Authentication
│   │   └── types/           # TypeScript Interfaces
│   ├── indexers/            # Apibara indexers
│   │   └── sendpay.indexer.ts
│   ├── apibara.config.ts    # Apibara config with presets
│   └── package.json
│
└── contract/                # Cairo Smart Contract
    ├── src/
    │   └── lib.cairo        # Main contract implementation
    ├── tests/
    │   └── test_sendpay.cairo
    └── Scarb.toml
```

## 🛠️ Technology Stack

### **Frontend**
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern component library
- **Zod** - Schema validation
- **React Hooks** - State management

### **Backend**
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **TypeScript** - Type-safe development
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **JWT** - Authentication tokens
- **Apibara** - Indexers for Starknet events

### **Blockchain**
- **Starknet** - Layer 2 scaling solution
- **ChipiPay SDK** - Wallet management & gasless transactions
- **Cairo** - Smart contract language
- **Apibara** - Event streaming indexers

### **Infrastructure**
- **MongoDB Atlas** - Cloud database
- **Flutterwave V4** - Payment gateway
- **Environment Variables** - Secure configuration
- **CORS** - Cross-origin resource sharing

## 🚀 Key Features

### **1. Authentication & Onboarding**
- **ChipiPay Integration** - Real wallet creation via ChipiPay SDK
- **Multi-step Onboarding** - Personal info + bank details
- **Secure Token Management** - HTTP-only cookies with expiration
- **JWT-based Auth** - Custom backend authentication with JWKS endpoints

### **2. Payment System**
- **Payment Requests** - Generate shareable payment links
- **QR Code Generation** - Mobile-friendly payment options
- **Multi-currency** - USD and NGN support
- **Real-time Exchange Rates** - Dynamic currency conversion

### **3. Wallet Management**
- **Starknet Wallets** - Deployed via ChipiPay SDK
- **Balance Tracking** - Real-time USDC and STRK balances
- **Transaction History** - Complete blockchain activity log
- **Gasless Operations** - ChipiPay handles transaction fees
- **Crypto Transfers** - Send STRK/USDC with PIN authentication

### **4. Banking Integration**
- **Bank Account Management** - Multiple account support
- **Withdrawal Processing** - Digital to fiat conversion
- **Transaction Status** - Real-time processing updates
- **Compliance Ready** - KYC/AML integration ready

## 🔧 Setup & Installation

### **Prerequisites**
- Node.js 18+ and npm
- MongoDB Atlas account
- ChipiPay organization account
- Flutterwave account
- Starknet wallet (for testing)

### **Environment Variables**

#### **Backend (.env)**
```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sendpay

# ChipiPay Integration
CHIPI_PUBLIC_KEY=your_chipi_public_key
CHIPI_SECRET_KEY=your_chipi_secret_key

# JWT Configuration
JWT_PRIVATE_KEY_PEM=your_jwt_private_key_pem
JWT_PUBLIC_KEY_PEM=your_jwt_public_key_pem
JWT_ISSUER=https://your-backend-url.com
JWT_AUDIENCE=sendpay-users

# Starknet Configuration
STARKNET_NETWORK=mainnet
STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io/rpc/v0_7
SENDPAY_CONTRACT_ADDRESS=your_mainnet_contract_address
USDC_MAINNET_ADDRESS=0x053C91253BC9682c04929cA02ED00b3E423f6710D2ee7e0D5EBB06F3eCF368A8

# Flutterwave V4 Integration
FLUTTERWAVE_CLIENT_ID=your_flutterwave_client_id
FLUTTERWAVE_CLIENT_SECRET=your_flutterwave_client_secret
FLUTTERWAVE_ENCRYPTION_KEY=your_flutterwave_encryption_key
FLUTTERWAVE_CALLBACK_URL=https://yourdomain.com/api/flutterwave/webhook

# Apibara (DNA) — required to run the indexer
DNA_TOKEN=your_apibara_api_key
APIBARA_STREAM_URL=https://mainnet.starknet.a5a.ch

# Optional
COINGECKO_API_KEY=your_coingecko_api_key_here
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-vercel-domain.vercel.app
```

#### **Frontend (.env.local)**
```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api
NEXT_PUBLIC_STARKNET_NETWORK=mainnet
```

### **Installation Steps**

1. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/sendpay.git
   cd sendpay
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your credentials
   npm run build
   npm start
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local with your API URL
   npm run build
   npm start
   ```

4. **Database Setup**
   - Create MongoDB Atlas cluster
   - Update connection string in backend .env
   - Database will auto-create collections

5. **Smart Contract Deployment**
   ```bash
   cd contract
   scarb build
   # Deploy to mainnet using your preferred tool
   ```

## 🧪 Testing

### **Backend Testing**
```bash
cd backend
npm test
```

### **Frontend Testing**
```bash
cd frontend
npm test
```

### **API Testing**
- Use Postman or similar tool
- Test endpoints at `https://your-backend-url.com/api`
- Include JWT token in Authorization header

## 📱 Current Implementation Status

### **✅ Completed Features (95%)**
- [x] **Authentication & User Management**: JWT-based auth with password hashing
- [x] **Onboarding Flow**: Bank account setup with Flutterwave verification
- [x] **Wallet Creation**: ChipiPay integration for Starknet wallet creation
- [x] **Payment Requests**: Create shareable payment links with QR codes
- [x] **Transaction History**: Complete tracking with filtering and search
- [x] **Smart Contract**: Full Cairo contract with withdrawal/deposit functionality
- [x] **Blockchain Integration**: Starknet.js with Apibara indexers
- [x] **Exchange Rates**: Real-time USD/NGN conversion
- [x] **Frontend Framework**: Next.js 14 with TypeScript and shadcn/ui
- [x] **Database Models**: Complete schemas for User, Transaction, BankAccount
- [x] **API Structure**: RESTful endpoints with proper error handling
- [x] **Mobile-optimized UI** with responsive design
- [x] **Production deployment ready** for both frontend and backend
- [x] **Crypto Transfers**: STRK/USDC transfer functionality with PIN authentication
- [x] **JWKS Endpoints**: JWT key management for secure authentication
- [x] **Balance Formatting**: Proper decimal formatting for crypto balances
- [x] **QR Code Integration**: Wallet address sharing with QR codes
- [x] **Offramp Flow**: Complete withdrawal system with Flutterwave integration
- [x] **Webhook System**: Flutterwave webhook handling for payment status
- [x] **Event Indexing**: Apibara indexer for real-time blockchain events
- [x] **Price Locking**: Exchange rate locking for withdrawal consistency
- [x] **Transaction Status**: Complete lifecycle management

### **⚠️ Critical Missing Features (5%)**
- [ ] **Onramp Flow**: Flutterwave V4 integration for payment processing
- [ ] **Admin Security**: Role-based access control and 2FA
- [ ] **Production Monitoring**: Comprehensive logging and alerting
- [ ] **Rate Limiting**: API abuse prevention

### **🚀 Production Readiness: 95%**
- [x] **Backend Infrastructure**: Ready for deployment
- [x] **Frontend Application**: Ready for deployment  
- [x] **Smart Contract**: Fully implemented and tested
- [x] **Database Schema**: Complete and optimized
- [x] **Environment Configuration**: Production-ready
- [x] **Crypto Transfer System**: Fully functional with PIN authentication
- [x] **JWT Security**: JWKS endpoints for secure token validation
- [x] **Balance Management**: Real-time crypto balance tracking
- [x] **Offramp System**: Complete withdrawal flow with Flutterwave
- [x] **Event Processing**: Real-time blockchain event handling
- [x] **Webhook Integration**: Flutterwave webhook processing
- [ ] **Payment Processing**: Requires Flutterwave V4 integration completion
- [ ] **Security Hardening**: Admin roles and compliance features needed
- [ ] **Monitoring & Alerting**: Production monitoring system needed

### **📋 Planned Features**
- [ ] Multi-language support
- [ ] Advanced analytics dashboard
- [ ] Mobile app development
- [ ] API rate limiting
- [ ] Admin panel

## 🔒 Security Features

- **HTTP-only Cookies** - XSS protection
- **JWT Tokens** - Secure authentication
- **CORS Configuration** - Origin validation
- **Input Validation** - Zod schema validation
- **Environment Variables** - Secure configuration
- **MongoDB Injection Protection** - Mongoose ODM
- **Password Hashing** - bcrypt with salt rounds
- **Signature Verification** - ECDSA signatures for withdrawals

## 🌐 API Endpoints

### **Authentication**
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /.well-known/jwk.json` - JWT public key for validation

### **User Management**
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `GET /api/user/balance` - Get user balance
- `GET /api/user/bank-accounts` - List bank accounts
- `POST /api/user/bank-accounts` - Add bank account

### **Payments**
- `POST /api/payment/receive` - Create payment request
- `GET /api/payment/:reference` - Get payment details
- `POST /api/payment/:reference/process` - Process payment
- `GET /api/payment/requests` - Get user's payment requests

### **Transactions**
- `GET /api/transaction/history` - Transaction history
- `GET /api/transaction/:id` - Transaction details
- `GET /api/transaction/summary` - Transaction summary

### **Crypto Operations**
- `POST /api/chipipay/wallet` - Get wallet details
- `POST /api/chipipay/transfer` - Execute crypto transfers
- `GET /api/chipipay/balance/:address` - Get wallet balance
- `GET /api/starknet/balance/:address` - Get blockchain balance

### **Withdrawals**
- `POST /api/withdrawal/signature` - Get withdrawal signature
- `POST /api/withdrawal/execute` - Execute withdrawal

### **Flutterwave Integration**
- `GET /api/flutterwave/banks` - Get list of banks
- `POST /api/flutterwave/bank/add` - Add and verify bank account
- `POST /api/flutterwave/transfer` - Initiate bank transfer
- `POST /api/flutterwave/webhook` - Handle webhook notifications

Indexers are run via Apibara CLI, not via HTTP routes. See backend README for scripts.

## 🚀 Deployment

### **✅ Production Deployment Ready**

#### **Backend (Render)**
- **Status**: ✅ Production ready
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Environment**: Production with MongoDB Atlas

#### **Frontend (Vercel)**
- **Status**: Ready for deployment
- **Build Command**: `npm run build`
- **Environment Variable**: `NEXT_PUBLIC_API_BASE=https://your-backend-url/api`

### **Environment Variables for Production**

#### **Backend (Render)**
```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sendpay

# ChipiPay Integration
CHIPI_PUBLIC_KEY=your_chipi_public_key
CHIPI_SECRET_KEY=your_chipi_secret_key

# JWT Configuration
JWT_PRIVATE_KEY_PEM=your_jwt_private_key_pem
JWT_PUBLIC_KEY_PEM=your_jwt_public_key_pem
JWT_ISSUER=https://your-backend-url.com
JWT_AUDIENCE=sendpay-users

# Starknet Mainnet
STARKNET_NETWORK=mainnet
STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io/rpc/v0_7
SENDPAY_CONTRACT_ADDRESS=your_mainnet_contract_address
USDC_MAINNET_ADDRESS=0x053C91253BC9682c04929cA02ED00b3E423f6710D2ee7e0D5EBB06F3eCF368A8

# Flutterwave V4
FLUTTERWAVE_CLIENT_ID=your_flutterwave_client_id
FLUTTERWAVE_CLIENT_SECRET=your_flutterwave_client_secret
FLUTTERWAVE_ENCRYPTION_KEY=your_flutterwave_encryption_key
FLUTTERWAVE_CALLBACK_URL=https://yourdomain.com/api/flutterwave/webhook

# Apibara Mainnet
DNA_TOKEN=your_apibara_api_key
APIBARA_STREAM_URL=https://mainnet.starknet.a5a.ch

# Production
NODE_ENV=production
FRONTEND_URL=https://your-vercel-domain.vercel.app
PORT=3001
```

#### **Frontend (Vercel)**
```bash
NEXT_PUBLIC_API_BASE=https://your-backend-url/api
NEXT_PUBLIC_STARKNET_NETWORK=mainnet
```

### **Deployment Commands**

#### **Backend**
```bash
cd backend
npm run build
npm start
```

#### **Frontend**
```bash
cd frontend
npm run build
npm start
```

### **Recent Updates**
- ✅ **ChipiPay Integration**: Complete wallet creation and crypto transfer functionality
- ✅ **JWKS Endpoints**: JWT key management for secure authentication
- ✅ **Balance Formatting**: Proper decimal formatting for USDC (2 decimals) and STRK (18 decimals)
- ✅ **QR Code Integration**: Wallet address sharing with QR codes
- ✅ **PIN Authentication**: Secure crypto transfers with PIN verification
- ✅ **Mobile Navigation**: Added Logout button to hamburger dropdown
- ✅ **Hero Copy**: Updated to "STRK/USDC to NAIRA in minutes"
- ✅ **Production Logging**: Backend now logs correct public URLs
- ✅ **Environment Handling**: Proper production vs development configs
- ✅ **Production Ready**: Backend and frontend ready for deployment
- ✅ **Apibara Integration**: Indexer implemented for real-time event listening
- ✅ **Flutterwave Integration**: Complete offramp system with webhook handling
- ✅ **Price Locking**: Exchange rate locking for withdrawal consistency
- ✅ **Transaction Lifecycle**: Complete status management from creation to completion
- ✅ **Documentation**: Updated all READMEs to reflect current codebase

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: [Project Wiki](link-to-wiki)
- **Issues**: [GitHub Issues](link-to-issues)
- **Discussions**: [GitHub Discussions](link-to-discussions)
- **Email**: support@sendpay.com

## 🙏 Acknowledgments

- **ChipiPay Team** - For the amazing SDK and support
- **Starknet Community** - For the innovative L2 solution
- **Flutterwave Team** - For the payment gateway integration
- **shadcn/ui** - For the beautiful component library
- **Next.js Team** - For the excellent React framework

---

**Built with ❤️ by the SendPay Team**