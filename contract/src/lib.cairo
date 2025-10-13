// Top-level imports
use starknet::ContractAddress;
use starknet::storage::*;

// Role constants for multi-admin access control
const BACKEND_ADMIN_ROLE: felt252 = selector!("BACKEND_ADMIN_ROLE");
const MANUAL_ADMIN_ROLE: felt252 = selector!("MANUAL_ADMIN_ROLE");

// Withdrawal status codes
pub const STATUS_PROCESSING: u8 = 0;
pub const STATUS_COMPLETED: u8 = 1;
pub const STATUS_FAILED: u8 = 2;

// Pagination limits to prevent heavy read loops
const MAX_PAGINATION_LIMIT: u256 = 200;

// Timestamp freshness check (5 minutes in seconds)
const MAX_TIMESTAMP_SKEW: u64 = 300;


// Signed withdrawal request for backend validation
#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct WithdrawalRequest {
    pub user: ContractAddress,
    pub amount: u256,
    pub token: ContractAddress,
    pub tx_ref: felt252, // Transaction reference for uniqueness
    pub nonce: u256,
    pub timestamp: u64,
}

// Settlement proof for off-chain integration
#[derive(Drop, Serde, starknet::Store)]
pub struct SettlementProof {
    pub fiat_tx_hash: felt252,
    pub settled_amount: u256,
    pub timestamp: u64,
    pub backend_signature: felt252,
}

// Deposit record for reconciliation
#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct DepositRecord {
    pub deposit_id: u256,
    pub user: ContractAddress,
    pub amount: u256,
    pub token_address: ContractAddress,
    pub tx_ref: felt252,
    pub timestamp: u64,
}

// Compact withdrawal status for quick reads
#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct WithdrawalStatus {
    pub withdrawal_id: u256,
    pub user: ContractAddress,
    pub amount: u256,
    pub token_address: ContractAddress,
    pub tx_ref: felt252, // Transaction reference for uniqueness
    pub timestamp: u64,
    pub status: u8,
    pub block_number: u64,
    pub nonce: u256 // User nonce for replay protection
}

// ERC20 interface for token transfers (moved to top-level)
#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer_from(
        self: @TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;

    fn transfer(self: @TContractState, recipient: ContractAddress, amount: u256) -> bool;

    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;

    fn approve(self: @TContractState, spender: ContractAddress, amount: u256) -> bool;

    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
}

// Define the main contract interface
#[starknet::interface]
pub trait ISendPay<TContractState> {
    // Signature-verified withdrawal with backend approval
    fn withdraw_with_signature(
        ref self: TContractState,
        request: WithdrawalRequest,
        signature_r: felt252,
        signature_s: felt252,
    );


    // Get withdrawal status quickly
    fn get_withdrawal_status(self: @TContractState, withdrawal_id: u256) -> WithdrawalStatus;

    // Get user's withdrawal history
    fn get_user_withdrawals(
        self: @TContractState, user: ContractAddress, offset: u256, limit: u256,
    ) -> Array<WithdrawalStatus>;

    // Get user's current nonce
    fn get_user_nonce(self: @TContractState, user: ContractAddress) -> u256;

    // Get USDC token address
    fn get_usdc_token(self: @TContractState) -> ContractAddress;

    // Get chain ID for signature verification
    fn get_chain_id(self: @TContractState) -> felt252;

    // Emergency functions (part of ISendPay)
    fn emergency_pause(ref self: TContractState, reason: felt252);
    fn emergency_resume(ref self: TContractState);
}

// Define the internal trait for helper functions
#[starknet::interface]
pub trait InternalTrait<TContractState> {
    fn transfer_tokens_with_approval(
        ref self: TContractState,
        token_address: ContractAddress,
        from: ContractAddress,
        to: ContractAddress,
        amount: u256,
    );

    // Signature verification helpers
    fn verify_withdrawal_signature(
        self: @TContractState,
        request: WithdrawalRequest,
        signature_r: felt252,
        signature_s: felt252,
    ) -> bool;

    fn hash_withdrawal_request(self: @TContractState, request: WithdrawalRequest) -> felt252;

    // Reentrancy helpers
    fn enter_non_reentrant(ref self: TContractState);
    fn exit_non_reentrant(ref self: TContractState);
}

// Define Admin interface for privileged operations
#[starknet::interface]
pub trait IAdmin<TContractState> {
    fn complete_withdrawal(ref self: TContractState, withdrawal_id: u256);
    fn complete_withdrawal_with_proof(
        ref self: TContractState, withdrawal_id: u256, proof: SettlementProof,
    );
    fn fail_withdrawal(ref self: TContractState, withdrawal_id: u256);
    fn update_config(ref self: TContractState, min_withdrawal: u256, max_withdrawal: u256);
    fn set_usdc_token(ref self: TContractState, token_address: ContractAddress);
    fn set_backend_public_key(ref self: TContractState, public_key: felt252);

    // Backend admin management (single admin)
    fn set_backend_admin(ref self: TContractState, admin: ContractAddress);
    fn get_backend_admin(self: @TContractState) -> ContractAddress;

    // Manual admin management (multiple admins supported)
    fn add_manual_admin(ref self: TContractState, admin: ContractAddress);
    fn remove_manual_admin(ref self: TContractState, admin: ContractAddress);
    fn is_manual_admin(self: @TContractState, admin: ContractAddress) -> bool;
    fn get_manual_admin_count(self: @TContractState) -> u256;

    // Fund withdrawal functions (token only - Starknet has no native ETH)
    fn withdraw_token(
        ref self: TContractState, token_address: ContractAddress, to: ContractAddress, amount: u256,
    );
    fn get_token_balance(self: @TContractState, token_address: ContractAddress) -> u256;

    // Withdraw completed withdrawal funds to caller (manual admin only)
    fn withdraw_completed_funds(ref self: TContractState, withdrawal_id: u256);
}


// Main contract with optimized storage and latest Cairo features
#[starknet::contract]
pub mod sendpay {
    // OpenZeppelin Component Imports (monorepo path)
    use core::array::{Array, ArrayTrait}; // Import Array type
    use core::ecdsa::check_ecdsa_signature;
    use core::hash::HashStateTrait;
    use core::num::traits::Zero;
    use core::poseidon::PoseidonTrait;
    use openzeppelin::access::accesscontrol::interface::AccessControlABI;
    use openzeppelin::access::accesscontrol::{AccessControlComponent, DEFAULT_ADMIN_ROLE};
    use openzeppelin::introspection::src5::SRC5Component;
    use openzeppelin::security::pausable::PausableComponent;

    // Import OpenZeppelin ERC20 interface
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin::upgrades::UpgradeableComponent;
    use openzeppelin::upgrades::interface::IUpgradeable;
    use starknet::storage::*;
    // ERC20 component not used in current implementation

    // Core library imports
    use starknet::{
        ClassHash, ContractAddress, get_block_number, get_block_timestamp, get_caller_address,
        get_contract_address,
    };
    // signature verification to be added in a later iteration

    use super::{
        BACKEND_ADMIN_ROLE, DepositRecord, MANUAL_ADMIN_ROLE, MAX_PAGINATION_LIMIT,
        MAX_TIMESTAMP_SKEW, STATUS_COMPLETED, STATUS_FAILED, STATUS_PROCESSING, SettlementProof,
        WithdrawalRequest, WithdrawalStatus,
    };

    // Define components
    component!(path: AccessControlComponent, storage: accesscontrol, event: AccessControlEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[storage]
    pub struct Storage {
        // Core functionality components
        #[substorage(v0)]
        pub accesscontrol: AccessControlComponent::Storage,
        #[substorage(v0)]
        pub pausable: PausableComponent::Storage,
        #[substorage(v0)]
        pub upgradeable: UpgradeableComponent::Storage,
        #[substorage(v0)]
        pub src5: SRC5Component::Storage,
        // Optimized withdrawal tracking
        pub withdrawal_counter: u256, // Starts from 1 to avoid ID 0 ambiguity
        pub withdrawals: Map<u256, WithdrawalStatus>,
        pub user_withdrawal_count: Map<ContractAddress, u256>,
        // User withdrawal tracking using compound keys
        pub user_withdrawals: Map<(ContractAddress, u256), u256>, // (user, index) -> withdrawal_id
        // Fast access mappings
        pub withdrawal_by_hash: Map<felt252, u256>, // request hash -> withdrawal_id
        // Token whitelist
        pub allowed_tokens: Map<ContractAddress, bool>,
        // Reentrancy guard
        pub reentrancy_lock: bool,
        // User nonce tracking for replay protection
        pub user_nonces: Map<ContractAddress, u256>,
        // Backend public key for signature verification
        pub backend_public_key: felt252,
        // Deposit bookkeeping
        pub deposit_counter: u256,
        pub deposits: Map<u256, DepositRecord>,
        pub user_deposit_count: Map<ContractAddress, u256>,
        pub user_deposits: Map<(ContractAddress, u256), u256>, // (user, index) -> deposit_id
        pub credited_tx_refs: Map<felt252, bool>,
        // Configuration
        pub usdc_token: ContractAddress,
        pub min_withdrawal: u256,
        pub max_withdrawal: u256,
        pub chain_id: felt252,
        // Single backend admin storage
        pub single_backend_admin: ContractAddress,
        // Manual admin count storage
        pub manual_admin_count: u256,
        // Track collected funds to prevent double collection
        pub funds_collected: Map<u256, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        // Withdrawal lifecycle events
        WithdrawalCreated: WithdrawalCreated,
        WithdrawalCompleted: WithdrawalCompleted,
        WithdrawalFailed: WithdrawalFailed,
        // Deposit event
        DepositCompleted: DepositCompleted,
        // Emergency events
        EmergencyPaused: EmergencyPaused,
        EmergencyResumed: EmergencyResumed,
        // Role management events
        RoleChanged: RoleChanged,
        // Treasury fund movement event
        PayoutToTreasury: PayoutToTreasury,
    }

    // Withdrawal lifecycle event payloads
    //
    // EVENT SEMANTICS SUMMARY:
    // =======================
    //
    // 1. WithdrawalCreated: User → Contract (tokens locked)
    //    - User initiates withdrawal, tokens transferred to contract
    //    - Index by: Backend (process payout), Frontend (show pending), Analytics
    //
    // 2. WithdrawalCompleted: No token movement (status update only)
    //    - Backend confirms off-chain payout completed
    //    - Index by: Frontend (show completed), Treasury (know funds available)
    //
    // 3. WithdrawalFailed: Contract → User (tokens refunded)
    //    - Withdrawal rejected, tokens returned to user
    //    - Index by: Frontend (show failed), Backend (track failures)
    //
    // 4. PayoutToTreasury: Contract → Treasury (tokens collected)
    //    - Admin manually collects tokens from completed withdrawal
    //    - Index by: Treasury (track collections), Accounting (reconcile balances)
    //
    // CRITICAL: Only WithdrawalCreated, WithdrawalFailed, and PayoutToTreasury
    // indicate actual on-chain token movement. WithdrawalCompleted is status-only.

    /// WithdrawalCreated Event
    ///
    /// Triggered when: User successfully initiates a withdrawal request
    /// Token Movement: User tokens transferred FROM user TO contract (locked)
    /// Who should index:
    ///   - Backend systems (to process off-chain payout)
    ///   - Frontend/UI (to show pending withdrawals)
    ///   - Analytics/monitoring systems
    ///
    /// This event indicates the start of withdrawal process and tokens are now locked in contract
    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalCreated {
        pub withdrawal_id: u256,
        pub user: ContractAddress,
        pub amount: u256,
        pub token_address: ContractAddress,
        pub tx_ref: felt252,
        pub timestamp: u64,
        pub block_number: u64,
    }

    /// WithdrawalCompleted Event
    ///
    /// Triggered when: Backend confirms off-chain payout was completed
    /// Token Movement: NO on-chain token movement (tokens remain in contract)
    /// Who should index:
    ///   - Frontend/UI (to show completed status to users)
    ///   - Analytics systems (to track completion rates)
    ///   - Treasury management (to know when funds can be collected)
    ///
    /// This event indicates successful off-chain payout but tokens remain locked until admin
    /// collects them
    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalCompleted {
        pub withdrawal_id: u256,
        pub user: ContractAddress,
        pub amount: u256,
        pub token_address: ContractAddress,
        pub tx_ref: felt252,
        pub timestamp: u64,
        pub block_number: u64,
    }

    /// WithdrawalFailed Event
    ///
    /// Triggered when: Backend rejects withdrawal or withdrawal cannot be completed
    /// Token Movement: Tokens refunded FROM contract TO user (unlocked)
    /// Who should index:
    ///   - Frontend/UI (to show failed status and refund notification)
    ///   - Backend systems (to track failure reasons)
    ///   - Analytics systems (to monitor failure rates)
    ///
    /// This event indicates withdrawal failed and tokens have been refunded to the user
    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalFailed {
        pub withdrawal_id: u256,
        pub user: ContractAddress,
        pub amount: u256,
        pub token_address: ContractAddress,
        pub tx_ref: felt252,
        pub timestamp: u64,
        pub block_number: u64,
    }


    // Emergency control events
    #[derive(Drop, starknet::Event)]
    pub struct EmergencyPaused {
        pub reason: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct EmergencyResumed {
        pub timestamp: u64,
    }

    // Role management events
    #[derive(Drop, starknet::Event)]
    pub struct RoleChanged {
        pub role: felt252,
        pub old_admin: ContractAddress,
        pub new_admin: ContractAddress,
        pub timestamp: u64,
    }

    // Treasury fund movement event

    /// PayoutToTreasury Event
    ///
    /// Triggered when: Manual admin collects tokens from completed withdrawal
    /// Token Movement: Tokens transferred FROM contract TO treasury/admin address
    /// Who should index:
    ///   - Treasury management systems (to track collected funds)
    ///   - Accounting systems (to reconcile on-chain vs off-chain balances)
    ///   - Analytics systems (to monitor fund collection patterns)
    ///
    /// This event indicates actual token movement out of contract to treasury
    /// Only emitted when withdraw_completed_funds() is called by manual admin
    #[derive(Drop, starknet::Event)]
    pub struct PayoutToTreasury {
        pub withdrawal_id: u256,
        pub treasury_address: ContractAddress,
        pub amount: u256,
        pub token_address: ContractAddress,
        pub timestamp: u64,
    }
    // Do not expose raw component ABIs for Pausable/AccessControl to avoid
    // external callers bypassing contract invariants and counters.
    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            // Only manual admins can upgrade the contract
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);

            // Replace the class hash upgrading the contract
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    // Internal
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    // Implement the internal trait for helper functions
    impl InternalImpl of super::InternalTrait<ContractState> {
        fn transfer_tokens_with_approval(
            ref self: ContractState,
            token_address: ContractAddress,
            from: ContractAddress,
            to: ContractAddress,
            amount: u256,
        ) {
            let token_contract = IERC20Dispatcher { contract_address: token_address };
            let transfer_result: bool = token_contract.transfer_from(from, to, amount);
            assert(transfer_result, 'ERC20 transfer_from failed');
        }

        // Simple reentrancy guard helpers
        fn enter_non_reentrant(ref self: ContractState) {
            assert(!self.reentrancy_lock.read(), 'reentrant');
            self.reentrancy_lock.write(true);
        }

        fn exit_non_reentrant(ref self: ContractState) {
            self.reentrancy_lock.write(false);
        }

        // Signature verification and idempotency hash (timestamp-free to avoid sync issues)
        fn hash_withdrawal_request(self: @ContractState, request: WithdrawalRequest) -> felt252 {
            // Domain separation constants
            const DOMAIN_VERSION: felt252 = selector!("SENDPAY_V1");
            const DOMAIN_PURPOSE: felt252 = selector!("WITHDRAWAL_REQUEST");

            let user_felt: felt252 = request.user.into();
            // Safe conversion with bounds checking
            let amount_felt: felt252 = match request.amount.try_into() {
                Option::Some(val) => val,
                Option::None => {
                    assert(false, 'Amount too large for field');
                    0 // This line will never execute
                },
            };
            let token_felt: felt252 = request.token.into();
            let nonce_felt: felt252 = match request.nonce.try_into() {
                Option::Some(val) => val,
                Option::None => {
                    assert(false, 'Nonce too large for field');
                    0 // This line will never execute
                },
            };
            let contract_felt: felt252 = get_contract_address().into();
            let chain_id_felt: felt252 = self.chain_id.read();

            // Hash without timestamp to avoid synchronization issues
            let hash_state = PoseidonTrait::new()
                .update(DOMAIN_VERSION)
                .update(DOMAIN_PURPOSE)
                .update(contract_felt)
                .update(chain_id_felt)
                .update(user_felt)
                .update(amount_felt)
                .update(token_felt)
                .update(request.tx_ref)
                .update(nonce_felt);

            hash_state.finalize()
        }


        fn verify_withdrawal_signature(
            self: @ContractState,
            request: WithdrawalRequest,
            signature_r: felt252,
            signature_s: felt252,
        ) -> bool {
            let public_key = self.backend_public_key.read();
            // CRITICAL: Ensure backend public key is set (non-zero)
            assert(public_key != 0, 'Backend public key not set');

            let message_hash = self.hash_withdrawal_request(request);
            check_ecdsa_signature(message_hash, public_key, signature_r, signature_s)
        }
    }

    #[abi(embed_v0)]
    impl SendPayImpl of super::ISendPay<ContractState> {
        // Signature-verified withdrawal with backend approval (new optimized flow)
        fn withdraw_with_signature(
            ref self: ContractState,
            request: WithdrawalRequest,
            signature_r: felt252,
            signature_s: felt252,
        ) {
            self.enter_non_reentrant();
            self.pausable.assert_not_paused();

            let caller = get_caller_address();
            assert(caller == request.user, 'Caller must be request user');

            // Validate request (cheap checks first)
            assert(request.amount > 0_u256, 'Amount must be greater than 0');
            assert(request.amount >= self.min_withdrawal.read(), 'Amount below minimum');
            assert(request.amount <= self.max_withdrawal.read(), 'Amount above maximum');

            // Check nonce (cheap check before expensive signature verification)
            let current_nonce = self.user_nonces.entry(caller).read();
            assert(request.nonce == current_nonce, 'Invalid nonce');

            // Check timestamp freshness (prevent signed transaction reuse)
            let current_timestamp = get_block_timestamp();
            // Check if request timestamp is within acceptable range
            assert(current_timestamp >= request.timestamp, 'Timestamp too far in future');
            let time_diff = current_timestamp - request.timestamp;
            assert(time_diff <= MAX_TIMESTAMP_SKEW, 'Timestamp too old');

            // Token whitelist
            let token_allowed = self.allowed_tokens.entry(request.token).read();
            assert(token_allowed, 'Token not allowed');

            // Verify signature (expensive operation last)
            assert(
                self.verify_withdrawal_signature(request, signature_r, signature_s),
                'Invalid signature',
            );

            // Check ERC20 allowance
            let token_contract = IERC20Dispatcher { contract_address: request.token };
            let allowance: u256 = token_contract.allowance(caller, get_contract_address());
            assert(allowance >= request.amount, 'ERC20 allowance too low');

            let timestamp = get_block_timestamp();
            let block_number = get_block_number();

            // Idempotency guard: check if this request was already processed
            let request_hash = self.hash_withdrawal_request(request);
            let existing_withdrawal = self.withdrawal_by_hash.entry(request_hash).read();
            assert(existing_withdrawal == 0, 'Request already processed');

            // Transfer tokens from user -> contract
            self
                .transfer_tokens_with_approval(
                    request.token, caller, get_contract_address(), request.amount,
                );

            // Create withdrawal record
            let withdrawal_id = self.withdrawal_counter.read();
            let record = WithdrawalStatus {
                withdrawal_id,
                user: caller,
                amount: request.amount,
                token_address: request.token,
                tx_ref: request.tx_ref,
                timestamp,
                status: STATUS_PROCESSING,
                block_number,
                nonce: request.nonce,
            };

            self.withdrawals.entry(withdrawal_id).write(record);
            self.withdrawal_counter.write(withdrawal_id + 1_u256);

            // Store withdrawal hash for idempotency
            self.withdrawal_by_hash.entry(request_hash).write(withdrawal_id);

            // Update user counters and nonce
            let user_count = self.user_withdrawal_count.entry(caller).read();
            self.user_withdrawal_count.entry(caller).write(user_count + 1_u256);
            self.user_withdrawals.entry((caller, user_count)).write(withdrawal_id);
            self.user_nonces.entry(caller).write(request.nonce + 1_u256);

            // Emit event
            self
                .emit(
                    Event::WithdrawalCreated(
                        WithdrawalCreated {
                            withdrawal_id,
                            user: caller,
                            amount: request.amount,
                            token_address: request.token,
                            tx_ref: request.tx_ref,
                            timestamp,
                            block_number,
                        },
                    ),
                );

            self.exit_non_reentrant();
        }


        // Fast status lookup
        fn get_withdrawal_status(self: @ContractState, withdrawal_id: u256) -> WithdrawalStatus {
            self.withdrawals.entry(withdrawal_id).read()
        }

        // Get user's withdrawal history
        fn get_user_withdrawals(
            self: @ContractState, user: ContractAddress, offset: u256, limit: u256,
        ) -> Array<WithdrawalStatus> {
            // Pagination limit to prevent heavy read loops
            assert(limit <= MAX_PAGINATION_LIMIT, 'Limit too large');

            let mut result = ArrayTrait::new();
            let user_count = self.user_withdrawal_count.entry(user).read();

            // Bounds
            let mut start: u256 = offset;
            if start > user_count {
                return result;
            }
            let mut end: u256 = offset + limit;
            if end > user_count {
                end = user_count;
            }

            // Iterate within [start, end)
            let mut i: u256 = start;
            loop {
                if i >= end {
                    break;
                }

                let withdrawal_id = self.user_withdrawals.entry((user, i)).read();
                if withdrawal_id > 0_u256 {
                    let withdrawal = self.withdrawals.entry(withdrawal_id).read();
                    result.append(withdrawal);
                }

                i += 1_u256;
            }

            result
        }

        // Get user's current nonce
        fn get_user_nonce(self: @ContractState, user: ContractAddress) -> u256 {
            self.user_nonces.entry(user).read()
        }

        // Get USDC token address
        fn get_usdc_token(self: @ContractState) -> ContractAddress {
            self.usdc_token.read()
        }

        // Get chain ID for signature verification
        fn get_chain_id(self: @ContractState) -> felt252 {
            self.chain_id.read()
        }

        // Emergency pause with reason - only manual admin
        fn emergency_pause(ref self: ContractState, reason: felt252) {
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);
            self.pausable.pause(); // This method belongs to PausableComponent

            self
                .emit(
                    Event::EmergencyPaused(
                        EmergencyPaused { reason, timestamp: get_block_timestamp() },
                    ),
                );
        }

        // Emergency resume - only manual admin
        fn emergency_resume(ref self: ContractState) {
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);
            self.pausable.unpause(); // This method belongs to PausableComponent

            self
                .emit(
                    Event::EmergencyResumed(EmergencyResumed { timestamp: get_block_timestamp() }),
                );
        }
    }

    #[abi(embed_v0)]
    impl AdminImpl of super::IAdmin<ContractState> { // Implements the new IAdmin trait
        // Fast withdrawal completion - either admin can complete
        // Note: This only updates status. Actual fiat transfer happens off-chain.
        fn complete_withdrawal(ref self: ContractState, withdrawal_id: u256) {
            self.enter_non_reentrant();
            // Check if caller has either backend or manual admin role
            let caller = get_caller_address();
            let has_backend_role = self.accesscontrol.has_role(BACKEND_ADMIN_ROLE, caller);
            let has_manual_role = self.accesscontrol.has_role(MANUAL_ADMIN_ROLE, caller);
            assert(has_backend_role || has_manual_role, 'Not authorized admin');

            let mut withdrawal = self.withdrawals.entry(withdrawal_id).read();
            assert(withdrawal.status == STATUS_PROCESSING, 'Withdrawal not processing');

            // Update status to completed
            // Note: Tokens remain in contract - actual fiat payout happens off-chain
            withdrawal.status = STATUS_COMPLETED;
            self.withdrawals.entry(withdrawal_id).write(withdrawal);

            // Emit completion event
            self
                .emit(
                    Event::WithdrawalCompleted(
                        WithdrawalCompleted {
                            withdrawal_id,
                            user: withdrawal.user,
                            amount: withdrawal.amount,
                            token_address: withdrawal.token_address,
                            tx_ref: withdrawal.tx_ref,
                            timestamp: withdrawal.timestamp,
                            block_number: withdrawal.block_number,
                        },
                    ),
                );
            self.exit_non_reentrant();
        }

        // Complete withdrawal with settlement proof (for off-chain integration)
        // Note: This only updates status. Actual fiat transfer happens off-chain.
        fn complete_withdrawal_with_proof(
            ref self: ContractState, withdrawal_id: u256, proof: SettlementProof,
        ) {
            self.enter_non_reentrant();
            // Only backend admins can complete with proof
            self.accesscontrol.assert_only_role(BACKEND_ADMIN_ROLE);

            let mut withdrawal = self.withdrawals.entry(withdrawal_id).read();
            assert(withdrawal.status == STATUS_PROCESSING, 'Withdrawal not processing');

            // Verify settlement proof (basic validation)
            assert(proof.settled_amount == withdrawal.amount, 'Settlement amount mismatch');
            assert(proof.timestamp > withdrawal.timestamp, 'Invalid settlement timestamp');

            // Update status to completed
            // Note: Tokens remain in contract - actual fiat payout happens off-chain
            withdrawal.status = STATUS_COMPLETED;
            self.withdrawals.entry(withdrawal_id).write(withdrawal);

            // Emit completion event with settlement proof
            self
                .emit(
                    Event::WithdrawalCompleted(
                        WithdrawalCompleted {
                            withdrawal_id,
                            user: withdrawal.user,
                            amount: withdrawal.amount,
                            token_address: withdrawal.token_address,
                            tx_ref: withdrawal.tx_ref,
                            timestamp: withdrawal.timestamp,
                            block_number: withdrawal.block_number,
                        },
                    ),
                );
            self.exit_non_reentrant();
        }

        // Explicitly mark a withdrawal as failed and refund tokens to user
        fn fail_withdrawal(ref self: ContractState, withdrawal_id: u256) {
            self.enter_non_reentrant();
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);

            let mut withdrawal = self.withdrawals.entry(withdrawal_id).read();
            assert(withdrawal.status == STATUS_PROCESSING, 'Withdrawal not processing');

            // Refund tokens back to user before marking as failed
            let token_contract = IERC20Dispatcher { contract_address: withdrawal.token_address };
            let refund_success = token_contract.transfer(withdrawal.user, withdrawal.amount);
            assert(refund_success, 'Token refund failed');

            withdrawal.status = STATUS_FAILED;
            self.withdrawals.entry(withdrawal_id).write(withdrawal);

            // Emit failed event for indexers
            self
                .emit(
                    Event::WithdrawalFailed(
                        WithdrawalFailed {
                            withdrawal_id,
                            user: withdrawal.user,
                            amount: withdrawal.amount,
                            token_address: withdrawal.token_address,
                            tx_ref: withdrawal.tx_ref,
                            timestamp: withdrawal.timestamp,
                            block_number: withdrawal.block_number,
                        },
                    ),
                );
            self.exit_non_reentrant();
        }

        // Update configuration - only manual admin
        fn update_config(ref self: ContractState, min_withdrawal: u256, max_withdrawal: u256) {
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);
            self.min_withdrawal.write(min_withdrawal);
            self.max_withdrawal.write(max_withdrawal);
        }

        // Set token addresses - only manual admin
        fn set_usdc_token(ref self: ContractState, token_address: ContractAddress) {
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);
            self.usdc_token.write(token_address);
        }

        // Set backend public key for signature verification - only manual admin
        //
        // IMPORTANT: public_key must be in the format expected by check_ecdsa_signature:
        // - Must be a valid Stark curve public key (felt252)
        // - Use the same key format that generates r,s signatures for hash_withdrawal_request
        // - Key must be non-zero (validated in verify_withdrawal_signature)
        //
        // Example deployment values:
        // - Sepolia: Set to your backend's Stark public key
        // - Mainnet: Set to your backend's Stark public key
        fn set_backend_public_key(ref self: ContractState, public_key: felt252) {
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);
            // Basic validation - must be non-zero
            assert(public_key != 0, 'Public key cannot be zero');
            self.backend_public_key.write(public_key);
        }

        // Backend admin management (single admin)
        fn set_backend_admin(ref self: ContractState, admin: ContractAddress) {
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);
            // Revoke role from current backend admin if exists
            let current_admin = self.single_backend_admin.read();
            if !current_admin.is_zero() {
                self.accesscontrol.revoke_role(BACKEND_ADMIN_ROLE, current_admin);
            }
            // Grant role to new admin
            self.accesscontrol.grant_role(BACKEND_ADMIN_ROLE, admin);
            self.single_backend_admin.write(admin);

            // Emit role change event
            self
                .emit(
                    Event::RoleChanged(
                        RoleChanged {
                            role: BACKEND_ADMIN_ROLE,
                            old_admin: current_admin,
                            new_admin: admin,
                            timestamp: get_block_timestamp(),
                        },
                    ),
                );
        }

        fn get_backend_admin(self: @ContractState) -> ContractAddress {
            self.single_backend_admin.read()
        }

        // Manual admin management (multiple admins supported)
        fn add_manual_admin(ref self: ContractState, admin: ContractAddress) {
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);
            if !self.accesscontrol.has_role(MANUAL_ADMIN_ROLE, admin) {
                self.accesscontrol.grant_role(MANUAL_ADMIN_ROLE, admin);
                self.manual_admin_count.write(self.manual_admin_count.read() + 1_u256);

                // Emit role change event
                self
                    .emit(
                        Event::RoleChanged(
                            RoleChanged {
                                role: MANUAL_ADMIN_ROLE,
                                old_admin: 0
                                    .try_into()
                                    .unwrap(), // Zero address indicates no previous admin for addition
                                new_admin: admin,
                                timestamp: get_block_timestamp(),
                            },
                        ),
                    );
            }
        }

        fn remove_manual_admin(ref self: ContractState, admin: ContractAddress) {
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);
            // Prevent removing the last manual admin
            let admin_count = self.manual_admin_count.read();
            assert(admin_count > 1_u256, 'Cannot remove last manual admin');
            if self.accesscontrol.has_role(MANUAL_ADMIN_ROLE, admin) {
                self.accesscontrol.revoke_role(MANUAL_ADMIN_ROLE, admin);
                self.manual_admin_count.write(admin_count - 1_u256);

                // Emit role change event
                self
                    .emit(
                        Event::RoleChanged(
                            RoleChanged {
                                role: MANUAL_ADMIN_ROLE,
                                old_admin: admin,
                                new_admin: 0.try_into().unwrap(), // No new admin for removals
                                timestamp: get_block_timestamp(),
                            },
                        ),
                    );
            }
        }

        fn is_manual_admin(self: @ContractState, admin: ContractAddress) -> bool {
            self.accesscontrol.has_role(MANUAL_ADMIN_ROLE, admin)
        }

        fn get_manual_admin_count(self: @ContractState) -> u256 {
            self.manual_admin_count.read()
        }


        // Fund withdrawal functions - only manual admin
        // Note: ETH withdrawal not supported in Starknet (no native ETH)
        // Use token withdrawal for ERC20 tokens instead

        fn withdraw_token(
            ref self: ContractState,
            token_address: ContractAddress,
            to: ContractAddress,
            amount: u256,
        ) {
            self.enter_non_reentrant();
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);

            // Check contract has enough token balance
            let balance = self.get_token_balance(token_address);
            assert(balance >= amount, 'Insufficient token balance');

            // Transfer tokens to the specified address
            let token_contract = IERC20Dispatcher { contract_address: token_address };
            let success = token_contract.transfer(to, amount);
            assert(success, 'Token transfer failed');
            self.exit_non_reentrant();
        }


        fn get_token_balance(self: @ContractState, token_address: ContractAddress) -> u256 {
            let token_contract = IERC20Dispatcher { contract_address: token_address };
            token_contract.balance_of(get_contract_address())
        }

        // Withdraw completed withdrawal funds to caller (manual admin only)
        fn withdraw_completed_funds(ref self: ContractState, withdrawal_id: u256) {
            self.enter_non_reentrant();
            // Only manual admins can withdraw completed funds
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);

            let withdrawal = self.withdrawals.entry(withdrawal_id).read();
            // Only allow withdrawal of completed withdrawals
            assert(withdrawal.status == STATUS_COMPLETED, 'Withdrawal not completed');
            // Prevent double collection
            let already_collected = self.funds_collected.entry(withdrawal_id).read();
            assert(!already_collected, 'Funds already collected');

            // Transfer tokens to the calling admin (safer than allowing arbitrary address)
            let caller = get_caller_address();
            let token_contract = IERC20Dispatcher { contract_address: withdrawal.token_address };
            let success = token_contract.transfer(caller, withdrawal.amount);
            assert(success, 'Transfer to admin failed');

            // Mark funds as collected to prevent double collection
            self.funds_collected.entry(withdrawal_id).write(true);

            // Emit dedicated payout to admin event
            self
                .emit(
                    Event::PayoutToTreasury(
                        PayoutToTreasury {
                            withdrawal_id,
                            treasury_address: caller,
                            amount: withdrawal.amount,
                            token_address: withdrawal.token_address,
                            timestamp: get_block_timestamp(),
                        },
                    ),
                );

            self.exit_non_reentrant();
        }
    }

    #[constructor] // Correct placement of constructor attribute
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        usdc_token: ContractAddress,
        backend_admin: ContractAddress,
        initial_manual_admins: Array<ContractAddress>,
        chain_id: felt252,
    ) {
        // Initialize AccessControl
        self.accesscontrol.initializer();
        self.accesscontrol._grant_role(DEFAULT_ADMIN_ROLE, owner);

        // Grant backend admin role
        self.accesscontrol._grant_role(BACKEND_ADMIN_ROLE, backend_admin);
        self.single_backend_admin.write(backend_admin);

        // Grant manual admin roles to all provided addresses
        let mut i = 0;
        let mut manual_count = 0;
        loop {
            if i >= initial_manual_admins.len() {
                break;
            }
            let admin = *initial_manual_admins.at(i);
            self.accesscontrol._grant_role(MANUAL_ADMIN_ROLE, admin);
            manual_count += 1;
            i += 1;
        }
        self.manual_admin_count.write(manual_count);

        // Ensure at least one manual admin exists
        assert(initial_manual_admins.len() > 0, 'One manual admin required');

        // Initialize config and counters
        self.usdc_token.write(usdc_token);
        self.chain_id.write(chain_id);
        self.withdrawal_counter.write(1); // Start withdrawal_counter from 1
        self.deposit_counter.write(1); // Start deposit_counter from 1
        self.reentrancy_lock.write(false);
        // Initialize backend public key to zero (must be set later by admin)
        self.backend_public_key.write(0);
        // Seed whitelist with USDC token
        self.allowed_tokens.entry(usdc_token).write(true);

        // Set default configuration
        self.min_withdrawal.write(1000000); // 1 USDC (6 decimals)
        self.max_withdrawal.write(1000000000); // 1000 USDC
    }

    // Additional admin and utility functions
    // Additional admin and utility functions
    #[starknet::interface]
    pub trait IAdminExt<TContractState> {
        fn add_allowed_token(ref self: TContractState, token: ContractAddress);
        fn remove_allowed_token(ref self: TContractState, token: ContractAddress);
        fn deposit_and_credit(
            ref self: TContractState, user: ContractAddress, amount: u256, tx_reference: felt252,
        );
        fn get_deposit(self: @TContractState, deposit_id: u256) -> DepositRecord;
        fn get_user_deposits(
            self: @TContractState, user: ContractAddress, offset: u256, limit: u256,
        ) -> Array<DepositRecord>;
    }

    #[abi(embed_v0)]
    impl AdminExtensionsImpl of IAdminExt<ContractState> {
        // Token whitelist management
        fn add_allowed_token(ref self: ContractState, token: ContractAddress) {
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);
            self.allowed_tokens.entry(token).write(true);
        }

        fn remove_allowed_token(ref self: ContractState, token: ContractAddress) {
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);
            self.allowed_tokens.entry(token).write(false);
        }

        // On-ramp deposit: credit user from contract balance of USDC
        fn deposit_and_credit(
            ref self: ContractState, user: ContractAddress, amount: u256, tx_reference: felt252,
        ) {
            self.enter_non_reentrant();
            let caller = get_caller_address();
            let has_backend = self.accesscontrol.has_role(BACKEND_ADMIN_ROLE, caller);
            let has_manual = self.accesscontrol.has_role(MANUAL_ADMIN_ROLE, caller);
            assert(has_backend || has_manual, 'Not authorized');
            assert(amount > 0_u256, 'Amount must be greater than 0');

            let token = self.usdc_token.read();
            let token_allowed = self.allowed_tokens.entry(token).read();
            assert(token_allowed, 'Token not allowed');

            // Ensure contract has enough balance to credit
            let balance = self.get_token_balance(token);
            assert(balance >= amount, 'Insufficient token balance');

            // Idempotency guard
            let already = self.credited_tx_refs.entry(tx_reference).read();
            assert(!already, 'Deposit already credited');

            // Transfer tokens to the user
            let token_contract = IERC20Dispatcher { contract_address: token };
            let ok = token_contract.transfer(user, amount);
            assert(ok, 'Deposit transfer failed');

            // Persist deposit record
            let deposit_id = self.deposit_counter.read();
            let record = DepositRecord {
                deposit_id,
                user,
                amount,
                token_address: token,
                tx_ref: tx_reference,
                timestamp: get_block_timestamp(),
            };
            self.deposits.entry(deposit_id).write(record);
            self.deposit_counter.write(deposit_id + 1_u256);
            // Update per-user index
            let count = self.user_deposit_count.entry(user).read();
            self.user_deposit_count.entry(user).write(count + 1_u256);
            self.user_deposits.entry((user, count)).write(deposit_id);
            // Mark idempotent
            self.credited_tx_refs.entry(tx_reference).write(true);

            // Emit a deposit event
            self
                .emit(
                    Event::DepositCompleted(
                        DepositCompleted {
                            user,
                            amount,
                            token_address: token,
                            fiat_tx_ref: tx_reference,
                            timestamp: get_block_timestamp(),
                        },
                    ),
                );
            self.exit_non_reentrant();
        }

        fn get_deposit(self: @ContractState, deposit_id: u256) -> DepositRecord {
            self.deposits.entry(deposit_id).read()
        }

        fn get_user_deposits(
            self: @ContractState, user: ContractAddress, offset: u256, limit: u256,
        ) -> Array<DepositRecord> {
            // Pagination limit to prevent heavy read loops
            assert(limit <= MAX_PAGINATION_LIMIT, 'Limit too large');

            let mut result = ArrayTrait::new();
            let total = self.user_deposit_count.entry(user).read();

            let mut start: u256 = offset;
            if start > total {
                return result;
            }
            let mut end: u256 = offset + limit;
            if end > total {
                end = total;
            }

            let mut i: u256 = start;
            loop {
                if i >= end {
                    break;
                }
                let dep_id = self.user_deposits.entry((user, i)).read();
                if dep_id > 0_u256 {
                    let dep = self.deposits.entry(dep_id).read();
                    result.append(dep);
                }
                i += 1_u256;
            }
            result
        }
    }

    // Additional events
    #[derive(Drop, starknet::Event)]
    pub struct DepositCompleted {
        pub user: ContractAddress,
        pub amount: u256,
        pub token_address: ContractAddress,
        pub fiat_tx_ref: felt252,
        pub timestamp: u64,
    }
}
// TODO: Future Extensions

// Add DepositRefund flow.

// Add StablecoinSwap functionality (auto-USDC conversion).

// Add RateLimiter (per-user daily cap).

// Add Merkle-based proof validation for withdrawal claims.


