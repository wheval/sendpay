# SendPay Smart Contract – Signature-Verified Architecture (tx_ref) 🚀

Production-ready Starknet contract for crypto ↔ fiat bridging with signature-verified withdrawals, domain separation, idempotency protection, and privacy-safe `tx_ref` references.

## Highlights
- Signature-verified withdrawals (ECDSA) with domain separation (chain ID, contract address, version)
- `tx_ref` used everywhere (no PII on-chain)
- Per-user nonces for perfect replay protection
- Idempotency protection prevents duplicate transaction processing
- Timestamp freshness validation (±5 minutes)
- Role-based access (backend/manual/default admin)
- Fund collection system for completed withdrawals
- Events for off-chain processing and auditability

## Flows

### Off-ramp (withdrawal)
1) Frontend requests signature from backend for `WithdrawalRequest { user, amount, token, tx_ref, nonce, timestamp }`
2) User calls `withdraw_with_signature(request, r, s)`
3) Contract verifies signature, checks timestamp freshness (±5 min), validates idempotency, checks nonce/limits/whitelist, pulls tokens user → contract, stores status, emits `WithdrawalCreated`
4) Backend executes fiat payout, then calls `complete_withdrawal_with_proof(withdrawal_id, proof)`
5) Contract verifies proof, marks `STATUS_COMPLETED`, emits `WithdrawalCompleted` (tokens remain in contract)
6) Manual admin calls `withdraw_completed_funds(withdrawal_id)` to collect tokens to treasury, emits `PayoutToTreasury`

### On-ramp (deposit)
1) User sends fiat off-chain; backend detects settlement
2) Backend calls `deposit_and_credit(user, amount, fiat_tx_ref)`
3) Contract checks idempotency, transfers token contract → user, stores record, emits `DepositCompleted`

## Key Data Structures
```cairo
struct WithdrawalRequest {
    user: ContractAddress,
    amount: u256,
    token: ContractAddress,
    tx_ref: felt252,   // hashed/off-chain reference
    nonce: u256,
    timestamp: u64,
}

struct WithdrawalStatus {
    withdrawal_id: u256,
    user: ContractAddress,
    amount: u256,
    token_address: ContractAddress,
    tx_ref: felt252,
    timestamp: u64,
    status: u8,        // 0=PROCESSING,1=COMPLETED,2=FAILED
    block_number: u64,
    nonce: u256,
}

struct SettlementProof {
    fiat_tx_hash: felt252,
    settled_amount: u256,
    timestamp: u64,
    backend_signature: felt252,
}
```

## Public Interface (selected)
```cairo
// User functions
fn withdraw_with_signature(request: WithdrawalRequest, r: felt252, s: felt252);
fn get_user_nonce(user: ContractAddress) -> u256;
fn get_withdrawal_status(withdrawal_id: u256) -> WithdrawalStatus;
fn get_user_withdrawals(user: ContractAddress, offset: u256, limit: u256) -> Array<WithdrawalStatus>;
fn get_chain_id() -> felt252;

// Admin functions
fn complete_withdrawal_with_proof(withdrawal_id: u256, proof: SettlementProof);
fn fail_withdrawal(withdrawal_id: u256);  // Refunds tokens to user
fn withdraw_completed_funds(withdrawal_id: u256);  // Collects to treasury
fn deposit_and_credit(user: ContractAddress, amount: u256, fiat_tx_ref: felt252);
fn set_backend_public_key(public_key: felt252);
```

## Events
```cairo
// Withdrawal lifecycle events
WithdrawalCreated { withdrawal_id, user, amount, token_address, tx_ref, timestamp, block_number }
WithdrawalCompleted { withdrawal_id, user, amount, token_address, tx_ref, timestamp, block_number }
WithdrawalFailed { withdrawal_id, user, amount, token_address, tx_ref, timestamp, block_number }

// Treasury fund movement event
PayoutToTreasury { withdrawal_id, treasury_address, amount, token_address, timestamp }

// Deposit events
DepositCompleted { user, amount, fiat_tx_ref, timestamp, block_number }
```

### Event Semantics
- **WithdrawalCreated**: Tokens locked in contract (User → Contract)
- **WithdrawalCompleted**: Status update only, no token movement
- **WithdrawalFailed**: Tokens refunded to user (Contract → User)
- **PayoutToTreasury**: Tokens collected to treasury (Contract → Treasury)

## Roles
- DEFAULT_ADMIN_ROLE: owner/upgrade/role management
- BACKEND_ADMIN_ROLE: completes withdrawals with proof; backend key management
- MANUAL_ADMIN_ROLE: operational controls (pause/unpause), failure marking, fund collection

## Backend integration
- Maintain a signing keypair; publish public key via `set_backend_public_key`
- Sign `WithdrawalRequest` poseidon hash with domain separation (chain ID, contract address, version); provide `(r,s)` to client
- Listen to `WithdrawalCreated` events; after bank payout, call `complete_withdrawal_with_proof`
- Ensure timestamp freshness (±5 minutes) when signing requests

## Build / Deploy
```bash
cd contract
scarb build
# deploy with your preferred toolchain
```

## Constructor
```cairo
constructor(
    owner: ContractAddress,              // DEFAULT_ADMIN_ROLE
    usdc_token: ContractAddress,         // Primary token
    backend_admin: ContractAddress,      // BACKEND_ADMIN_ROLE
    initial_manual_admins: Array<ContractAddress>,  // MANUAL_ADMIN_ROLE
    chain_id: felt252                    // Chain ID for domain separation
)
```

## Notes
- `tx_ref` replaces any PII; actual details live in your backend DB
- Nonces must be fetched via `get_user_nonce` before signing
- Hash function excludes timestamp to avoid synchronization issues
- Completed withdrawals require manual admin to collect funds via `withdraw_completed_funds`
- Idempotency protection prevents duplicate transaction processing
- Timestamp freshness validation prevents replay attacks with old requests
