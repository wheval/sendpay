# Critical Mock Code Analysis & Removal Plan

## 🚨 Executive Summary

SendPay contains **critical mock implementations** that prevent production deployment. This document identifies all mock code, explains the production requirements, and provides a systematic removal plan.

## 📊 Mock Code Inventory

### **🔴 CRITICAL - Must Remove for Production**

#### **1. Withdrawal Settlement Mock**
**Location**: `backend/src/routes/withdrawal.ts:328`
```typescript
// ❌ CURRENT (MOCK)
backend_signature: 'mock_signature' // TODO: Generate actual signature

// ✅ REQUIRED (PRODUCTION)
backend_signature: await signatureService.generateSettlementProof({
  withdrawalId,
  fiatTxHash,
  settledAmount,
  timestamp: Math.floor(Date.now() / 1000)
})
```

**Impact**: Prevents withdrawal completion and contract settlement
**Priority**: HIGH - Blocks offramp functionality

#### **2. Starknet Transaction Hash Mock**
**Location**: `backend/src/routes/starknet.ts:155`
```typescript
// ❌ CURRENT (MOCK)
const mockStarknetTxHash = `0x${Math.random().toString(16).substring(2, 34)}`;

// ✅ REQUIRED (PRODUCTION)
const actualTxHash = await starknetService.executeWithdrawal({
  userAddress: req.user.chipiWalletAddress,
  amount: amount,
  tokenAddress: USDC_TOKEN_ADDRESS
});
```

**Impact**: Creates fake transaction hashes instead of real blockchain transactions
**Priority**: HIGH - Breaks transaction tracking

#### **3. Flutterwave Settlement Proof Mock**
**Location**: `backend/src/routes/flutterwave.ts:406`
```typescript
// ❌ CURRENT (MOCK)
backend_signature: '0x0', // TODO: sign proof if contract enforces

// ✅ REQUIRED (PRODUCTION)
backend_signature: await signatureService.signSettlementProof({
  withdrawalId,
  fiatTxHash: data.id,
  settledAmount: data.amount
})
```

**Impact**: Prevents proper settlement proof generation for contract completion
**Priority**: HIGH - Breaks withdrawal completion

### **🟡 MEDIUM - Feature Disabled**

#### **4. Payment Processing Simulation**
**Location**: `frontend/src/app/payment/page.tsx:42-43`
```typescript
// ❌ CURRENT (MOCK)
// Simulate payment processing
await new Promise(resolve => setTimeout(resolve, 2000));

// ✅ REQUIRED (PRODUCTION)
const paymentResult = await api.payment.process({
  amount: formData.amount,
  token: formData.token,
  bankDetails: {
    bankCode: formData.bankCode,
    accountNumber: formData.accountNumber,
    accountName: formData.accountName
  }
});
```

**Impact**: Payment page doesn't actually process payments
**Priority**: MEDIUM - Affects user experience

#### **5. Receive Feature Disabled**
**Location**: `frontend/src/app/receive/page.tsx:36`
```typescript
// ❌ CURRENT (MOCK)
const isFeatureEnabled = false

// ✅ REQUIRED (PRODUCTION)
const isFeatureEnabled = true
```

**Impact**: Payment request creation is completely disabled
**Priority**: MEDIUM - Core feature unavailable

### **🟠 LOW - Admin Security**

#### **6. Admin Role Check Disabled**
**Location**: `backend/src/routes/withdrawal.ts:308-314`
```typescript
// ❌ CURRENT (MOCK)
// TODO: Add admin role check
// if (!req.user.hasRole('BACKEND_ADMIN_ROLE')) {
//   return res.status(403).json({
//     success: false,
//     message: 'Admin role required'
//   });
// }

// ✅ REQUIRED (PRODUCTION)
if (!req.user.hasRole('BACKEND_ADMIN_ROLE')) {
  return res.status(403).json({
    success: false,
    message: 'Admin role required'
  });
}
```

**Impact**: Admin-only functions are accessible to any user
**Priority**: LOW - Security concern

#### **7. 2FA Verification Disabled**
**Location**: `backend/src/routes/chipipay.ts:51-54`
```typescript
// ❌ CURRENT (MOCK)
// TODO: Add 2FA verification here in production
// const twoFactorVerified = await verifyTwoFactor(req.user, req.body.twoFactorCode);
// if (!twoFactorVerified) {
//   return res.status(401).json({ success: false, message: '2FA verification required' });

// ✅ REQUIRED (PRODUCTION)
const twoFactorVerified = await verifyTwoFactor(req.user, req.body.twoFactorCode);
if (!twoFactorVerified) {
  return res.status(401).json({ success: false, message: '2FA verification required' });
}
```

**Impact**: No two-factor authentication for sensitive operations
**Priority**: LOW - Security enhancement

## 🛠️ Production Implementation Requirements

### **1. Settlement Proof Generation Service**

#### **Create**: `backend/src/services/signature.service.ts`
```typescript
import { ec } from 'starknet';
import crypto from 'crypto';

export class SignatureService {
  private privateKey: string;
  
  constructor() {
    this.privateKey = process.env.BACKEND_PRIVATE_KEY;
    if (!this.privateKey) {
      throw new Error('BACKEND_PRIVATE_KEY environment variable is required');
    }
  }

  async generateSettlementProof(data: {
    withdrawalId: string;
    fiatTxHash: string;
    settledAmount: string;
    timestamp: number;
  }): Promise<string> {
    // Create message hash
    const message = `${data.withdrawalId}:${data.fiatTxHash}:${data.settledAmount}:${data.timestamp}`;
    const messageHash = crypto.createHash('sha256').update(message).digest('hex');
    
    // Sign with backend private key
    const signature = ec.sign(this.privateKey, messageHash);
    
    return signature.r + signature.s;
  }

  async signSettlementProof(data: {
    withdrawalId: string;
    fiatTxHash: string;
    settledAmount: string;
  }): Promise<string> {
    return this.generateSettlementProof({
      ...data,
      timestamp: Math.floor(Date.now() / 1000)
    });
  }
}

export const signatureService = new SignatureService();
```

### **2. Real Starknet Transaction Execution**

#### **Update**: `backend/src/services/starknet.service.ts`
```typescript
async executeWithdrawal(data: {
  userAddress: string;
  amount: number;
  tokenAddress: string;
}): Promise<{ hash: string }> {
  try {
    // Get user's private key (encrypted in database)
    const user = await User.findOne({ chipiWalletAddress: data.userAddress });
    if (!user || !user.encryptedPrivateKey) {
      throw new Error('User wallet not found or not initialized');
    }

    // Decrypt private key (implement decryption logic)
    const privateKey = await this.decryptPrivateKey(user.encryptedPrivateKey, user.pin);
    
    // Create account instance
    const account = new Account(provider, data.userAddress, privateKey);
    
    // Prepare contract call
    const contractCall = {
      contractAddress: this.contractAddress,
      entrypoint: 'withdraw_with_signature',
      calldata: CallData.compile({
        request: withdrawalRequest,
        signature_r: signature.r,
        signature_s: signature.s
      })
    };

    // Execute transaction
    const result = await account.execute(contractCall);
    
    return { hash: result.transaction_hash };
  } catch (error) {
    console.error('Starknet withdrawal execution failed:', error);
    throw error;
  }
}
```

### **3. Real Payment Processing**

#### **Update**: `frontend/src/app/payment/page.tsx`
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsProcessing(true);
  setStatus('processing');
  setMessage('Processing payment...');

  try {
    // Real payment processing
    const paymentResult = await api.payment.process({
      amount: formData.amount,
      token: formData.token,
      bankDetails: {
        bankCode: formData.bankCode,
        accountNumber: formData.accountNumber,
        accountName: formData.accountName
      }
    });

    if (paymentResult.success) {
      setStatus('success');
      setMessage('Payment processed successfully! Check your bank account for NGN transfer.');
    } else {
      throw new Error(paymentResult.message);
    }
    
  } catch (error) {
    setStatus('error');
    setMessage('Payment failed. Please try again.');
    console.error('Payment processing error:', error);
  } finally {
    setIsProcessing(false);
  }
};
```

### **4. Admin Role System**

#### **Create**: `backend/src/middleware/admin.ts`
```typescript
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';

export const requireAdminRole = (requiredRole: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.user._id);
      
      if (!user || !user.roles || !user.roles.includes(requiredRole)) {
        return res.status(403).json({
          success: false,
          message: `${requiredRole} role required`
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Admin role verification failed'
      });
    }
  };
};

export const requireBackendAdmin = requireAdminRole('BACKEND_ADMIN_ROLE');
export const requireManualAdmin = requireAdminRole('MANUAL_ADMIN_ROLE');
```

### **5. 2FA Implementation**

#### **Create**: `backend/src/services/2fa.service.ts`
```typescript
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export class TwoFactorService {
  generateSecret(userId: string): { secret: string; qrCodeUrl: string } {
    const secret = speakeasy.generateSecret({
      name: `SendPay (${userId})`,
      issuer: 'SendPay'
    });
    
    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url
    };
  }

  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1
    });
  }

  async generateQRCode(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }
}

export const twoFactorService = new TwoFactorService();
```

## 📋 Removal Plan

### **Phase 1: Critical Mock Removal (Week 1)**

#### **Day 1-2: Settlement Proof Generation**
1. Create `backend/src/services/signature.service.ts`
2. Add `BACKEND_PRIVATE_KEY` environment variable
3. Update withdrawal completion routes
4. Test signature generation

#### **Day 3-4: Starknet Transaction Execution**
1. Update `backend/src/services/starknet.service.ts`
2. Implement real transaction execution
3. Add transaction hash verification
4. Test blockchain integration

#### **Day 5: Flutterwave Integration**
1. Update settlement proof generation in Flutterwave routes
2. Remove mock signatures
3. Test webhook handling

### **Phase 2: Feature Enabling (Week 2)**

#### **Day 6-7: Payment Processing**
1. Enable payment processing in frontend
2. Remove simulation delays
3. Implement real API calls
4. Test end-to-end payment flow

#### **Day 8-9: Receive Feature**
1. Enable payment request creation
2. Remove feature flag
3. Test payment request flow
4. Verify QR code generation

#### **Day 10: Security Implementation**
1. Implement admin role checks
2. Add 2FA verification
3. Test security features
4. Update documentation

### **Phase 3: Testing & Validation (Week 3)**

#### **Day 11-12: Integration Testing**
1. Test complete onramp flow
2. Test complete offramp flow
3. Verify all mock code removed
4. Performance testing

#### **Day 13-14: Security Testing**
1. Test admin role restrictions
2. Test 2FA functionality
3. Security audit
4. Penetration testing

#### **Day 15: Production Readiness**
1. Final code review
2. Documentation update
3. Deployment preparation
4. Monitoring setup

## 🔍 Verification Checklist

### **Mock Code Removal Verification**
- [ ] All `mockStarknetTxHash` instances removed
- [ ] All `mock_signature` instances replaced with real signatures
- [ ] All `'0x0'` placeholder signatures replaced
- [ ] All `TODO` comments for mock code addressed
- [ ] All simulation delays removed from payment processing
- [ ] All feature flags enabled for production features

### **Functionality Verification**
- [ ] Withdrawal settlement proof generation works
- [ ] Starknet transactions execute successfully
- [ ] Flutterwave webhooks process correctly
- [ ] Payment processing completes end-to-end
- [ ] Payment request creation works
- [ ] Admin role checks function properly
- [ ] 2FA verification works

### **Security Verification**
- [ ] Admin endpoints protected by role checks
- [ ] Sensitive operations require 2FA
- [ ] All API endpoints have proper authentication
- [ ] Input validation prevents injection attacks
- [ ] Error messages don't leak sensitive information

## 🚨 Critical Dependencies

### **Environment Variables Required**
```bash
# Backend signature generation
BACKEND_PRIVATE_KEY=your_backend_private_key_here

# Flutterwave integration
FLUTTERWAVE_CLIENT_ID=your_flutterwave_client_id
FLUTTERWAVE_CLIENT_SECRET=your_flutterwave_client_secret
FLUTTERWAVE_BASE_URL=https://api.flutterwave.com/v3

# Starknet configuration
STARKNET_RPC_URL=your_starknet_rpc_url
SENDPAY_CONTRACT_ADDRESS=your_contract_address
USDC_TOKEN_ADDRESS=your_usdc_token_address
```

### **External Service Dependencies**
- **Flutterwave API**: Bank transfer processing
- **Starknet Network**: Blockchain transactions
- **ChipiPay SDK**: Wallet management
- **Apibara**: Event streaming

## 📊 Success Metrics

### **Technical Metrics**
- [ ] 0 mock implementations remaining
- [ ] 100% real API integrations
- [ ] All security measures implemented
- [ ] End-to-end flows working

### **Business Metrics**
- [ ] Onramp flow: Fiat → Crypto working
- [ ] Offramp flow: Crypto → Fiat working
- [ ] Payment processing: Real transactions
- [ ] Admin operations: Secure and functional

---

**This document provides a comprehensive plan for removing all mock code and implementing production-ready functionality. Following this plan will result in a fully functional onramp/offramp platform ready for production deployment.**
