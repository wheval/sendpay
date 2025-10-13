# SendPay - Crypto ↔ Fiat Bridge Contract

A production-ready Starknet smart contract for seamless crypto-to-fiat and fiat-to-crypto transactions with signature-based security and privacy protection.

## 🏗️ Architecture Overview

### **Core Components**
- **Signature-Verified Withdrawals**: Cryptographically secure withdrawal processing with domain separation
- **Privacy Protection**: Uses `tx_ref` (transaction references) instead of storing sensitive bank details
- **Role-Based Access Control**: Three-tier admin system for security
- **Reentrancy Protection**: Guards against common smart contract vulnerabilities
- **Idempotency Protection**: Prevents duplicate transaction processing
- **Timestamp Freshness**: 5-minute window for request validity
- **Event-Driven**: Complete audit trail for off-chain integration

### **Contract Structure**
```
SendPay Contract
├── Signature-Based Withdrawals (Primary Flow)
├── Deposit & Credit System
├── Admin Management
├── Token Whitelist
├── Fund Collection (Treasury Management)
└── Emergency Controls (Pause/Upgrade)
```

---

## 🔄 **Complete Flow Architecture**

### **🆕 Signature-Verified Withdrawal Flow (Primary)**

#### **1. User Initiates Withdrawal**
```javascript
// Frontend calls backend to get signature
const signature = await backendAPI.getWithdrawalSignature({
    user: userAddress,
    amount: amount,
    token: tokenAddress,
    tx_ref: transactionReference,
    nonce: await contract.get_user_nonce(userAddress),
    timestamp: Math.floor(Date.now() / 1000)
});

// Frontend calls contract with signature
await contract.withdraw_with_signature(
    request,
    signature.r,
    signature.s
);
```

#### **2. Contract Processing**
```cairo
fn withdraw_with_signature(
    ref self: ContractState,
    request: WithdrawalRequest,
    signature_r: felt252,
    signature_s: felt252,
) {
    // 1. Verify ECDSA signature against backend public key
    // 2. Validate timestamp freshness (±5 minutes)
    // 3. Check idempotency (prevent duplicate requests)
    // 4. Validate request (amount, token, nonce)
    // 5. Transfer tokens from user → contract
    // 6. Store WithdrawalStatus with STATUS_PROCESSING
    // 7. Emit WithdrawalCreated event
}
```

#### **3. Backend Processing**
```javascript
// Backend listens to WithdrawalCreated events
contract.on('WithdrawalCreated', async (event) => {
    // 1. Process fiat payout to user's bank account
    // 2. Call complete_withdrawal_with_proof()
    await contract.complete_withdrawal_with_proof(
        event.withdrawal_id,
        settlementProof
    );
});
```

#### **4. Completion**
```cairo
fn complete_withdrawal_with_proof(
    ref self: ContractState,
    withdrawal_id: u256,
    proof: SettlementProof,
) {
    // 1. Verify settlement proof
    // 2. Update status to STATUS_COMPLETED
    // 3. Emit WithdrawalCompleted event
    // Note: Tokens remain in contract until manually collected
}
```

#### **5. Fund Collection (Optional)**
```cairo
fn withdraw_completed_funds(
    ref self: ContractState,
    withdrawal_id: u256,
) {
    // 1. Verify caller has MANUAL_ADMIN_ROLE
    // 2. Check withdrawal is completed and not already collected
    // 3. Transfer tokens from contract → admin address
    // 4. Mark funds as collected
    // 5. Emit PayoutToTreasury event
}
```

**Total Time: ~10-30 seconds** (fiat processing time only)

---

### **💰 Deposit Flow (On-Ramp)**

#### **1. User Sends Fiat**
- User sends fiat to designated bank account
- Backend detects fiat deposit via bank API

#### **2. Backend Credits User**
```javascript
// Backend calls contract to credit user
await contract.deposit_and_credit(
    userAddress,
    amount,
    fiatTransactionReference
);
```

#### **3. Contract Processing**
```cairo
fn deposit_and_credit(
    ref self: ContractState,
    user: ContractAddress,
    amount: u256,
    fiat_tx_ref: felt252,
) {
    // 1. Verify caller has BACKEND_ADMIN_ROLE or MANUAL_ADMIN_ROLE
    // 2. Check idempotency (fiat_tx_ref not already credited)
    // 3. Transfer USDC from contract → user
    // 4. Store DepositRecord
    // 5. Emit DepositCompleted event
}
```

**Total Time: ~10-30 seconds** (automated)

---

## 🔐 **Security Architecture**

### **Cryptographic Security**
- **ECDSA Signature Verification**: All withdrawals require backend signature
- **Domain Separation**: Chain ID, contract address, and version included in signatures
- **Poseidon Hashing**: For `tx_ref` generation and withdrawal uniqueness
- **Nonce-based Replay Protection**: Perfect replay prevention per user
- **Idempotency Protection**: Hash-based deduplication prevents duplicate processing
- **Timestamp Freshness**: 5-minute window prevents replay attacks with old requests

### **Access Control System**
| Role | Permissions | Use Case |
|------|-------------|----------|
| **DEFAULT_ADMIN_ROLE** | Contract owner, can grant/revoke all roles | Initial setup, emergency control |
| **BACKEND_ADMIN_ROLE** | Automated processing, signature verification | Backend automation, instant withdrawals |
| **MANUAL_ADMIN_ROLE** | Human oversight, emergency controls | Manual review, emergency pause |

### **Privacy Protection**
- **No PII Storage**: Bank details stored as `tx_ref` (transaction references)
- **Off-chain PII**: Actual bank details stored in encrypted backend database
- **Hash-based References**: `tx_ref` = Poseidon hash of bank details

---

## 📊 **Data Structures**

### **WithdrawalRequest (Signature-Based)**
```cairo
struct WithdrawalRequest {
    user: ContractAddress,      // User requesting withdrawal
    amount: u256,              // Amount to withdraw
    token: ContractAddress,    // Token contract address
    tx_ref: felt252,          // Transaction reference (hashed bank details)
    nonce: u256,              // User nonce for replay protection
    timestamp: u64,           // Request timestamp
}
```

### **WithdrawalStatus (On-Chain Record)**
```cairo
struct WithdrawalStatus {
    withdrawal_id: u256,       // Unique withdrawal ID
    user: ContractAddress,     // User address
    amount: u256,             // Withdrawal amount
    token_address: ContractAddress, // Token contract
    tx_ref: felt252,          // Transaction reference
    timestamp: u64,           // Creation timestamp
    status: u8,               // 0=PROCESSING, 1=COMPLETED, 2=FAILED
    block_number: u64,        // Block number
    nonce: u256,              // User nonce
}
```

### **SettlementProof (Off-Chain Integration)**
```cairo
struct SettlementProof {
    fiat_tx_hash: felt252,     // Fiat transaction hash
    settled_amount: u256,      // Actual settled amount
    timestamp: u64,           // Settlement timestamp
    backend_signature: felt252, // Backend signature
}
```

---

## 🚀 **Backend Integration**

### **Signature Generation (Node.js)**
```javascript
const { ec } = require('elliptic');
const { poseidonHash } = require('starknet-crypto');

class BackendSigner {
    constructor(privateKey) {
        this.ec = new ec('secp256k1');
        this.key = this.ec.keyFromPrivate(privateKey, 'hex');
    }

    signWithdrawalRequest(request) {
        const messageHash = poseidonHash([
            request.user,           // ContractAddress
            request.amount,         // u256
            request.token,          // ContractAddress
            request.tx_ref,         // felt252
            request.nonce,          // u256
            request.timestamp       // u64
        ]);
        
        const signature = this.key.sign(messageHash);
        return {
            r: signature.r.toString('hex'),
            s: signature.s.toString('hex')
        };
    }
}
```

### **Event Monitoring**
```javascript
// Listen to withdrawal events
contract.on('WithdrawalCreated', async (event) => {
    console.log(`Processing withdrawal ${event.withdrawal_id} for ${event.user}`);
    // Process fiat payout...
});

contract.on('WithdrawalCompleted', async (event) => {
    console.log(`Withdrawal ${event.withdrawal_id} completed`);
    // Update user balance...
});
```

### **Settlement Proof Generation**
```javascript
async function generateSettlementProof(fiatTxHash, settledAmount) {
    const proof = {
        fiat_tx_hash: fiatTxHash,
        settled_amount: settledAmount,
        timestamp: Math.floor(Date.now() / 1000),
        backend_signature: await signSettlementProof(fiatTxHash, settledAmount)
    };
    
    return proof;
}
```

---

## 🔧 **Contract Functions**

### **User Functions**
```cairo
// Signature-verified withdrawal
fn withdraw_with_signature(
    ref self: ContractState,
    request: WithdrawalRequest,
    signature_r: felt252,
    signature_s: felt252,
);

// Get user nonce
fn get_user_nonce(self: @ContractState, user: ContractAddress) -> u256;

// Get withdrawal status
fn get_withdrawal_status(self: @ContractState, withdrawal_id: u256) -> WithdrawalStatus;

// Get user withdrawal history (paginated)
fn get_user_withdrawals(
    self: @ContractState, 
    user: ContractAddress, 
    offset: u256, 
    limit: u256
) -> Array<WithdrawalStatus>;

// Get chain ID
fn get_chain_id(self: @ContractState) -> felt252;
```

### **Admin Functions**
```cairo
// Complete withdrawal with settlement proof
fn complete_withdrawal_with_proof(
    ref self: ContractState,
    withdrawal_id: u256,
    proof: SettlementProof,
);

// Fail withdrawal (refund tokens to user)
fn fail_withdrawal(
    ref self: ContractState,
    withdrawal_id: u256,
);

// Collect completed withdrawal funds to treasury
fn withdraw_completed_funds(
    ref self: ContractState,
    withdrawal_id: u256,
);

// Deposit and credit user
fn deposit_and_credit(
    ref self: ContractState,
    user: ContractAddress,
    amount: u256,
    fiat_tx_ref: felt252,
);

// Set backend public key
fn set_backend_public_key(ref self: ContractState, public_key: felt252);

// Emergency controls
fn pause(ref self: ContractState);
fn unpause(ref self: ContractState);
```

---

## 📈 **Performance & Scalability**

### **Gas Optimization**
- **Optimized Storage**: Minimal on-chain data storage
- **Hash-based Lookups**: O(1) withdrawal uniqueness checks
- **Pagination**: Prevents unbounded loops in user history queries
- **Single Hash Function**: Unified signature verification and idempotency

### **Throughput**
- **Single Withdrawals**: ~200k gas (~$0.50-2.00)
- **Deposit Credits**: ~100k gas (~$0.25-1.00)
- **Fund Collection**: ~150k gas (~$0.40-1.50)

### **Scalability Features**
- **Event-Driven**: Off-chain processing doesn't block on-chain operations
- **Modular Design**: Easy to upgrade and extend
- **Role-Based**: Granular permission control
- **Pausable**: Emergency circuit breaker

---

## 🛡️ **Security Features**

### **Smart Contract Security**
- **Reentrancy Guards**: All external calls protected
- **Access Control**: Role-based permissions
- **Pausable**: Emergency stop functionality
- **Upgradeable**: Can evolve contract logic
- **Input Validation**: All parameters validated

### **Cryptographic Security**
- **Signature Verification**: ECDSA signature validation
- **Nonce Protection**: Perfect replay prevention
- **Hash-based Deduplication**: Prevents duplicate processing
- **Privacy Protection**: No sensitive data on-chain

### **Operational Security**
- **Multi-sig Admin**: Multiple manual admins required
- **Backend Separation**: Automated vs manual processing
- **Audit Trail**: Complete event logging
- **Emergency Controls**: Pause and upgrade capabilities

---

## 🚀 **Deployment & Setup**

### **1. Deploy Contract**
```bash
starknet deploy --contract target/dev/sendpay_sendpay.contract_class.json
```

### **2. Initialize Contract**
```cairo
constructor(
    owner: ContractAddress,              // DEFAULT_ADMIN_ROLE
    usdc_token: ContractAddress,         // Primary token
    backend_admin: ContractAddress,      // BACKEND_ADMIN_ROLE
    initial_manual_admins: Array<ContractAddress>,  // MANUAL_ADMIN_ROLE
    chain_id: felt252                    // Chain ID for domain separation
)
```

### **3. Post-Deployment Setup**
```cairo
// Set backend public key for signature verification
set_backend_public_key(backend_public_key);

// Configure withdrawal limits
update_config(min_withdrawal, max_withdrawal);

// Add token to whitelist
add_allowed_token(token_address);
```

---

## 📋 **Event Reference**

### **Withdrawal Events**
```cairo
// Withdrawal created (user initiated)
WithdrawalCreated {
    withdrawal_id: u256,
    user: ContractAddress,
    amount: u256,
    token_address: ContractAddress,
    tx_ref: felt252,
    timestamp: u64,
    block_number: u64,
}

// Withdrawal completed (backend processed)
WithdrawalCompleted {
    withdrawal_id: u256,
    user: ContractAddress,
    amount: u256,
    token_address: ContractAddress,
    tx_ref: felt252,
    timestamp: u64,
    block_number: u64,
}

// Withdrawal failed (manual admin marked)
WithdrawalFailed {
    withdrawal_id: u256,
    user: ContractAddress,
    amount: u256,
    token_address: ContractAddress,
    tx_ref: felt252,
    timestamp: u64,
    block_number: u64,
}
```

### **Deposit Events**
```cairo
// Deposit credited to user
DepositCompleted {
    user: ContractAddress,
    amount: u256,
    fiat_tx_ref: felt252,
    timestamp: u64,
    block_number: u64,
}
```

### **Treasury Events**
```cairo
// Funds collected to treasury
PayoutToTreasury {
    withdrawal_id: u256,
    treasury_address: ContractAddress,
    amount: u256,
    token_address: ContractAddress,
    timestamp: u64,
}
```

---

## 🔄 **Migration from Legacy**

### **Legacy Contract Available**
- **File**: `src/legacy_withdrawal.cairo`
- **Purpose**: Reference implementation with simple withdrawal flow
- **Features**: Hash-based deduplication, basic security
- **Use Case**: Backward compatibility or simple deployments

### **Migration Path**
1. **Deploy new contract** with signature-based flow
2. **Migrate users** to new signature-verified system
3. **Update frontend** to use new API
4. **Deprecate legacy** contract after migration

---

## 📞 **Support & Development**

### **Key Features**
- ✅ **Production-Ready**: Battle-tested security patterns
- ✅ **Privacy-First**: No sensitive data on-chain
- ✅ **High Performance**: Optimized for gas efficiency
- ✅ **Scalable**: Event-driven architecture
- ✅ **Secure**: Multiple layers of protection
- ✅ **Auditable**: Complete transaction history

### **Architecture Benefits**
- **Speed**: 10-30 second processing time
- **Security**: Cryptographic proof of authorization
- **Privacy**: No PII stored on-chain
- **Flexibility**: Modular, upgradeable design
- **Reliability**: Multiple fallback mechanisms
- **Compliance**: Audit trail for regulatory requirements

This contract provides a complete, production-ready solution for crypto ↔ fiat bridges with enterprise-grade security and performance.

---

## 📚 **Additional Documentation**

- **[Token Approval Guide](TOKEN_APPROVAL_GUIDE.md)**: Complete guide for approving tokens before withdrawals
- **[Contract Source](contract/src/lib.cairo)**: Full contract implementation with comprehensive event documentation
- **[Legacy Implementation](contract/src/legacy_withdrawal.cairo)**: Reference implementation for simple deployments

---

## 🚀 **Quick Start**

1. **Deploy Contract**: Use the constructor with proper role assignments
2. **Set Backend Key**: Configure signature verification
3. **Approve Tokens**: Follow the [Token Approval Guide](TOKEN_APPROVAL_GUIDE.md)
4. **Test Withdrawal**: Start with small amounts on testnet
5. **Monitor Events**: Set up event listeners for withdrawal processing

For detailed integration examples and troubleshooting, see the comprehensive guides above.
