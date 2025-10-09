# SendPay Smart Contract – Signature-Verified Architecture (tx_ref) 🚀

Production-ready Starknet contract for crypto ↔ fiat bridging with signature-verified withdrawals, nonce-based replay protection, and privacy-safe `tx_ref` references.

## Highlights
- Signature-verified withdrawals (ECDSA) using backend public key
- `tx_ref` used everywhere (no PII on-chain)
- Per-user nonces for perfect replay protection
- Batch signature-verified withdrawals
- Role-based access (backend/manual/default admin)
- Events for off-chain processing and auditability

## Flows

### Off-ramp (withdrawal)
1) Frontend requests signature from backend for `WithdrawalRequest { user, amount, token, tx_ref, nonce, timestamp }`
2) User calls `withdraw_with_signature(request, r, s)`
3) Contract verifies signature, checks nonce/limits/whitelist, pulls tokens user → contract, stores status, emits `WithdrawalCreated`
4) Backend executes fiat payout, then calls `complete_withdrawal_with_proof(withdrawal_id, proof)`
5) Contract verifies proof, marks `STATUS_COMPLETED`, emits `WithdrawalCompleted`

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
fn withdraw_with_signature(request: WithdrawalRequest, r: felt252, s: felt252);
fn batch_withdraw_with_signatures(requests: Array<WithdrawalRequest>, rs: Array<felt252>, ss: Array<felt252>);
fn complete_withdrawal_with_proof(withdrawal_id: u256, proof: SettlementProof);
fn get_user_nonce(user: ContractAddress) -> u256;
fn get_withdrawal_status(withdrawal_id: u256) -> WithdrawalStatus;
fn get_user_withdrawals(user: ContractAddress, offset: u256, limit: u256) -> Array<WithdrawalStatus>;
fn deposit_and_credit(user: ContractAddress, amount: u256, fiat_tx_ref: felt252);
```

## Events
```cairo
WithdrawalCreated { withdrawal_id, user, amount, token_address, tx_ref, timestamp, block_number }
WithdrawalCompleted { withdrawal_id, user, amount, token_address, tx_ref, timestamp, block_number }
WithdrawalFailed { withdrawal_id, user, amount, token_address, tx_ref, timestamp, block_number }
BatchWithdrawalProcessed { batch_id, total_withdrawals, total_amount, timestamp }
DepositCompleted { user, amount, fiat_tx_ref, timestamp, block_number }
```

## Roles
- DEFAULT_ADMIN_ROLE: owner/upgrade/role management
- BACKEND_ADMIN_ROLE: completes withdrawals with proof; backend key management
- MANUAL_ADMIN_ROLE: operational controls (pause/unpause), failure marking

## Backend integration
- Maintain a signing keypair; publish public key via `set_backend_public_key`
- Sign `WithdrawalRequest` poseidon hash; provide `(r,s)` to client
- Listen to `WithdrawalCreated` events; after bank payout, call `complete_withdrawal_with_proof`

## Build / Deploy
```bash
cd contract
scarb build
# deploy with your preferred toolchain
```

## Notes
- `tx_ref` replaces any PII; actual details live in your backend DB
- Nonces must be fetched via `get_user_nonce` before signing
- Batch size limited by `MAX_BATCH_ITEMS` to avoid gas issues
