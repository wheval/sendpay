# SendPay Platform Architecture

## 🏗️ System Overview

SendPay is a **Starknet-based onramp/offramp platform** that facilitates seamless conversion between USDC/STRK and Nigerian Naira (NGN) through bank transfers. The platform uses a modern microservices architecture with ChipiPay SDK integration for wallet management and Flutterwave V4 API for fiat processing.

## 🎯 Architecture Principles

### **Design Goals**
- **Scalability**: Handle high transaction volumes
- **Security**: Protect user funds and data
- **Reliability**: Ensure 99.9% uptime
- **Compliance**: Meet Nigerian financial regulations
- **User Experience**: Simple, intuitive interface

### **Core Principles**
- **Separation of Concerns**: Clear boundaries between layers
- **Event-Driven Architecture**: Asynchronous processing
- **Immutable Audit Trail**: Complete transaction history
- **Fail-Safe Design**: Graceful degradation and recovery
- **Security First**: Defense in depth

## 🏛️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Web App (Next.js)    │  Mobile App (RN)    │  Admin Dashboard │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API GATEWAY LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  Load Balancer  │  Rate Limiting  │  Authentication  │  CORS   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  Auth Service   │  Payment Service │  Withdrawal Service        │
│  User Service   │  Notification    │  Compliance Service        │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       INTEGRATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  Flutterwave V4 │  ChipiPay SDK  │  Starknet RPC  │  Apibara  │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  MongoDB Atlas  │  Redis Cache   │  File Storage  │  Logs      │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BLOCKCHAIN LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│        Starknet Network (Mainnet)                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  SendPay Contract│  │  USDC Token     │  │  STRK Token     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 📱 Frontend Architecture

### **Technology Stack**
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Context + Zustand
- **Validation**: Zod schemas
- **Authentication**: HTTP-only cookies + JWT

### **Component Structure**
```
frontend/src/
├── app/                    # Next.js App Router
│   ├── login/             # Authentication & onboarding
│   ├── dashboard/         # Main user interface
│   ├── receive/           # Payment request creation
│   ├── withdraw/          # Withdrawal interface
│   ├── payment/           # Payment processing
│   ├── history/           # Transaction history
│   └── admin/             # Admin dashboard
├── components/            # Reusable UI components
│   ├── ui/                # shadcn/ui components
│   ├── navigation.tsx     # Main navigation
│   └── theme-provider.tsx # Theme management
├── lib/                   # Utilities and configurations
│   ├── api.ts             # API client
│   ├── cookies.ts         # Cookie management
│   └── schemas.ts         # Zod validation schemas
└── hooks/                 # Custom React hooks
```

### **Key Features**
- **Server-Side Rendering**: SEO optimization
- **Progressive Web App**: Mobile-first design
- **Real-time Updates**: WebSocket connections
- **Offline Support**: Service worker caching
- **Accessibility**: WCAG 2.1 compliance

## 🔧 Backend Architecture

### **Technology Stack**
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis for session storage
- **Authentication**: JWT with bcrypt
- **Validation**: Built-in validation middleware

### **Service Architecture**
```
backend/src/
├── controllers/           # Route controllers (future)
├── middleware/           # Express middleware
│   ├── auth.ts           # JWT authentication
│   ├── validation.ts     # Input validation
│   └── rateLimit.ts      # Rate limiting
├── models/               # MongoDB schemas
│   ├── User.ts           # User model
│   ├── Transaction.ts    # Transaction model
│   ├── BankAccount.ts    # Bank account model
│   └── Withdrawal.ts     # Withdrawal model
├── routes/               # API endpoints
│   ├── auth.ts           # Authentication routes
│   ├── user.ts           # User management
│   ├── payment.ts        # Payment processing
│   ├── withdrawal.ts     # Withdrawal handling
│   ├── starknet.ts       # Blockchain operations
│   ├── flutterwave.ts   # Payment gateway
│   └── chipipay.ts       # ChipiPay integration
├── services/             # Business logic
│   ├── auth.service.ts   # Authentication logic
│   ├── payment.service.ts # Payment processing
│   ├── starknet.service.ts # Blockchain integration
│   ├── flutterwave.service.ts # Payment gateway
│   ├── chipipay.service.ts # ChipiPay integration
│   └── exchange-rate.service.ts # Currency conversion
├── types/                # TypeScript interfaces
├── utils/                # Utility functions
└── index.ts              # Application entry point
```

### **API Design Principles**
- **RESTful**: Standard HTTP methods and status codes
- **Consistent**: Uniform response format
- **Versioned**: API versioning for backward compatibility
- **Documented**: OpenAPI/Swagger documentation
- **Secure**: Input validation and sanitization

## ⛓️ Blockchain Architecture

### **Smart Contract Design**
```
contract/src/lib.cairo
├── Core Structures
│   ├── WithdrawalRequest    # Withdrawal request data
│   ├── SettlementProof      # Settlement verification
│   └── WithdrawalStatus     # Withdrawal state tracking
├── Main Functions
│   ├── withdraw_with_signature    # Signature-based withdrawal
│   ├── batch_withdraw_with_signatures # Batch processing
│   └── complete_withdrawal        # Settlement completion
├── Admin Functions
│   ├── Role Management      # Admin role control
│   ├── Configuration        # System parameters
│   └── Emergency Controls   # Pause/resume functionality
└── Events
    ├── WithdrawalCreated    # Withdrawal initiation
    ├── WithdrawalCompleted  # Settlement confirmation
    └── WithdrawalFailed     # Error handling
```

### **Integration Points**
- **Starknet.js**: Blockchain interaction library
- **Apibara**: Event streaming and indexing
- **ChipiPay**: Wallet creation and management
- **USDC Contract**: Token transfers and approvals

## 🔄 Data Flow Architecture

### **Onramp Flow (Fiat → Crypto)**
```
1. User initiates bank transfer to SendPay account
   ↓
2. Flutterwave V4 webhook notifies backend of incoming payment
   ↓
3. Backend verifies payment and creates deposit record
   ↓
4. Smart contract credits user's USDC balance
   ↓
5. User receives confirmation and updated balance
```

### **Offramp Flow (Crypto → Fiat)**
```
1. User requests withdrawal from dashboard
   ↓
2. Backend generates signature for withdrawal request
   ↓
3. Smart contract processes withdrawal and emits event
   ↓
4. Backend initiates Flutterwave bank transfer
   ↓
5. Settlement proof generated and contract updated
   ↓
6. User receives NGN in bank account
```

### **Payment Request Flow**
```
1. User creates payment request with amount and description
   ↓
2. Backend generates unique reference and QR code
   ↓
3. Payment link shared with payer
   ↓
4. Payer processes payment through Flutterwave V4
   ↓
5. Backend updates transaction status and notifies recipient
```

## 🔐 Security Architecture

### **Authentication & Authorization**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Login    │───▶│  JWT Token      │───▶│  API Access     │
│   (Email/PWD)   │    │  Generation     │    │  Control        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Password Hash   │   │  HTTP-Only      │    │ Role-Based     │
│  (bcrypt)       │    │  Cookies        │    │  Access Control │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Security Layers**
1. **Network Security**: HTTPS, CORS, CSP headers
2. **Authentication**: JWT tokens with expiration
3. **Authorization**: Role-based access control
4. **Input Validation**: Zod schema validation
5. **Database Security**: MongoDB injection prevention
6. **API Security**: Rate limiting and abuse detection

### **Compliance Features**
- **KYC/AML**: User identity verification
- **Transaction Monitoring**: Suspicious activity detection
- **Audit Trail**: Complete transaction logging
- **Data Protection**: GDPR compliance measures

## 📊 Monitoring & Observability

### **Logging Strategy**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │───▶│   Structured    │───▶│   Log Storage   │
│   Logs          │    │   Logging       │    │   (MongoDB)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Error         │    │   Performance   │    │   Analytics     │
│   Tracking      │    │   Metrics       │    │   Dashboard     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Monitoring Components**
- **Application Metrics**: Response times, error rates
- **Business Metrics**: Transaction volumes, success rates
- **Infrastructure Metrics**: CPU, memory, disk usage
- **Security Metrics**: Failed login attempts, suspicious activity

### **Alerting System**
- **Critical Alerts**: System failures, security breaches
- **Warning Alerts**: Performance degradation, high error rates
- **Info Alerts**: Deployment notifications, maintenance windows

## 🚀 Deployment Architecture

### **Production Environment**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Vercel)      │    │   (Render)      │    │   (MongoDB      │
│                 │    │                 │    │    Atlas)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CDN           │    │   Load          │    │   Backup        │
│   (Cloudflare)  │    │   Balancer      │    │   System        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Development Environment**
- **Local Development**: Docker containers
- **Staging Environment**: Production-like testing
- **CI/CD Pipeline**: Automated testing and deployment
- **Feature Flags**: Gradual feature rollouts

## 🔧 Infrastructure Components

### **Database Architecture**
```
MongoDB Atlas
├── Collections
│   ├── users              # User profiles and authentication
│   ├── transactions       # All transaction records
│   ├── bankaccounts       # User bank account details
│   ├── withdrawals        # Withdrawal requests and status
│   └── auditlogs          # System audit trail
├── Indexes
│   ├── Performance        # Query optimization
│   ├── Uniqueness         # Data integrity
│   └── Geospatial         # Location-based features
└── Sharding
    ├── Horizontal scaling # High volume support
    ├── Data distribution  # Geographic distribution
    └── Load balancing     # Performance optimization
```

### **Cache Architecture**
```
Redis Cache
├── Session Storage        # User authentication sessions
├── Rate Limiting          # API abuse prevention
├── Exchange Rates         # Currency conversion caching
└── Temporary Data         # Processing state storage
```

### **External Integrations**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Flutterwave   │    │   ChipiPay      │    │   Starknet      │
│   Payment API   │    │   Wallet SDK    │    │   Blockchain    │
│                 │    │                 │    │                 │
│ • Bank transfers│    │ • Wallet creation│   │ • Smart contracts│
│ • Account verify│    │ • Gasless txns  │    │ • Event streaming│
│ • Webhooks      │    │ • User auth     │    │ • Token transfers│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📈 Scalability Considerations

### **Horizontal Scaling**
- **Microservices**: Independent service scaling
- **Load Balancing**: Traffic distribution
- **Database Sharding**: Data partitioning
- **CDN**: Global content delivery

### **Performance Optimization**
- **Caching**: Redis for frequent data
- **Database Indexing**: Query optimization
- **API Rate Limiting**: Resource protection
- **Code Splitting**: Frontend optimization

### **High Availability**
- **Multi-Region**: Geographic redundancy
- **Failover**: Automatic recovery
- **Backup**: Data protection
- **Monitoring**: Proactive issue detection

## 🔄 Event-Driven Architecture

### **Event Types**
```typescript
// Blockchain Events
WithdrawalCreated    // User initiates withdrawal
WithdrawalCompleted  // Settlement confirmed
WithdrawalFailed     // Processing error

// Business Events
PaymentReceived      // Incoming payment
UserRegistered       // New user signup
AccountVerified      // KYC completion

// System Events
ServiceDown          // Infrastructure failure
HighErrorRate        // Performance issue
SecurityBreach       // Security incident
```

### **Event Processing**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Event Source  │───▶│   Event Bus     │───▶│   Event Handler │
│                 │    │   (Apibara)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Smart         │    │   Message       │    │   Business      │
│   Contract      │    │   Queue         │    │   Logic         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🎯 Future Architecture Considerations

### **Planned Enhancements**
- **Microservices Migration**: Service decomposition
- **Event Sourcing**: Complete audit trail
- **CQRS**: Command/Query separation
- **GraphQL**: Flexible API queries

### **Advanced Features**
- **Machine Learning**: Fraud detection
- **Real-time Analytics**: Live dashboards
- **Multi-currency**: Additional fiat currencies
- **Cross-chain**: Other blockchain support

---

**This architecture provides a solid foundation for a scalable, secure, and maintainable onramp/offramp platform. The modular design allows for independent scaling and development of different components while maintaining system integrity and performance.**