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

// Batch processing guardrail (simple cap)
const MAX_BATCH_ITEMS: usize = 50;


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


    // Batch signature-verified withdrawals
    fn batch_withdraw_with_signatures(
        ref self: TContractState,
        requests: Array<WithdrawalRequest>,
        signatures_r: Array<felt252>,
        signatures_s: Array<felt252>,
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

    // Emergency functions (part of ISendPay)
    fn emergency_pause(ref self: TContractState, reason: felt252);
    fn emergency_resume(ref self: TContractState);
}

// Define the internal trait for helper functions
#[starknet::interface]
pub trait InternalTrait<TContractState> {
    fn generate_withdrawal_hash(
        self: @TContractState, caller: ContractAddress, tx_ref: felt252, timestamp: u64,
    ) -> u256;

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
        BACKEND_ADMIN_ROLE, DepositRecord, MANUAL_ADMIN_ROLE, MAX_BATCH_ITEMS, STATUS_COMPLETED,
        STATUS_FAILED, STATUS_PROCESSING, SettlementProof, WithdrawalRequest, WithdrawalStatus,
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
        pub withdrawal_by_hash: Map<u256, u256>, // tx_ref + timestamp hash -> withdrawal_id
        // Batch id counter for unique batch ids
        pub batch_counter: u256,
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
        // Single backend admin storage
        pub single_backend_admin: ContractAddress,
        // Manual admin count storage
        pub manual_admin_count: u256,
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
        // Batch processing event
        BatchWithdrawalProcessed: BatchWithdrawalProcessed,
        // Deposit event
        DepositCompleted: DepositCompleted,
        // Emergency events
        EmergencyPaused: EmergencyPaused,
        EmergencyResumed: EmergencyResumed,
        // Role management events
        RoleChanged: RoleChanged,
    }

    // Withdrawal lifecycle event payloads
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

    // Batch processing event
    #[derive(Drop, starknet::Event)]
    pub struct BatchWithdrawalProcessed {
        pub batch_id: u256,
        pub total_withdrawals: u256,
        pub total_amount: u256,
        pub timestamp: u64,
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
        fn generate_withdrawal_hash(
            self: @ContractState, caller: ContractAddress, tx_ref: felt252, timestamp: u64,
        ) -> u256 {
            let caller_felt: felt252 = caller.into();
            let timestamp_felt: felt252 = timestamp.into();

            let hash_state = PoseidonTrait::new()
                .update(caller_felt)
                .update(tx_ref)
                .update(timestamp_felt);

            let hash_felt: felt252 = hash_state.finalize();
            hash_felt.into()
        }

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

        // Signature verification helpers
        fn hash_withdrawal_request(self: @ContractState, request: WithdrawalRequest) -> felt252 {
            let user_felt: felt252 = request.user.into();
            let amount_felt: felt252 = request.amount.try_into().unwrap();
            let token_felt: felt252 = request.token.into();
            let nonce_felt: felt252 = request.nonce.try_into().unwrap();
            let timestamp_felt: felt252 = request.timestamp.into();

            let hash_state = PoseidonTrait::new()
                .update(user_felt)
                .update(amount_felt)
                .update(token_felt)
                .update(request.tx_ref)
                .update(nonce_felt)
                .update(timestamp_felt);

            hash_state.finalize()
        }

        fn verify_withdrawal_signature(
            self: @ContractState,
            request: WithdrawalRequest,
            signature_r: felt252,
            signature_s: felt252,
        ) -> bool {
            let message_hash = self.hash_withdrawal_request(request);
            let public_key = self.backend_public_key.read();

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

            // Verify signature
            assert(
                self.verify_withdrawal_signature(request, signature_r, signature_s),
                'Invalid signature',
            );

            let caller = get_caller_address();
            assert(caller == request.user, 'Caller must be request user');

            // Validate request
            assert(request.amount > 0_u256, 'Amount must be greater than 0');
            assert(request.amount >= self.min_withdrawal.read(), 'Amount below minimum');
            assert(request.amount <= self.max_withdrawal.read(), 'Amount above maximum');

            // Token whitelist
            let token_allowed = self.allowed_tokens.entry(request.token).read();
            assert(token_allowed, 'Token not allowed');

            // Check nonce
            let current_nonce = self.user_nonces.entry(caller).read();
            assert(request.nonce == current_nonce, 'Invalid nonce');

            // Check ERC20 allowance
            let token_contract = IERC20Dispatcher { contract_address: request.token };
            let allowance: u256 = token_contract.allowance(caller, get_contract_address());
            assert(allowance >= request.amount, 'ERC20 allowance too low');

            let timestamp = get_block_timestamp();
            let block_number = get_block_number();

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


        // Batch signature-verified withdrawals
        fn batch_withdraw_with_signatures(
            ref self: ContractState,
            requests: Array<WithdrawalRequest>,
            signatures_r: Array<felt252>,
            signatures_s: Array<felt252>,
        ) {
            self.enter_non_reentrant();
            self.pausable.assert_not_paused();

            let timestamp = get_block_timestamp();
            let block_number = get_block_number();

            let mut total_amount = 0_u256;
            let mut processed_count = 0_u256;

            // Guard: non-empty batch
            assert(requests.len() > 0, 'Empty batch');
            assert(requests.len() <= MAX_BATCH_ITEMS, 'Batch too large');
            assert(requests.len() == signatures_r.len(), 'Signature count mismatch');
            assert(requests.len() == signatures_s.len(), 'Signature count mismatch');

            // First pass: validate all requests and calculate total amount
            let first_request = requests.at(0);
            let first_token = *first_request.token;

            // Whitelist check for the batch token
            let token_allowed = self.allowed_tokens.entry(first_token).read();
            assert(token_allowed, 'Token not allowed');

            let mut i = 0;
            loop {
                if i >= requests.len() {
                    break;
                }

                let request = requests.at(i);
                let signature_r = signatures_r.at(i);
                let signature_s = signatures_s.at(i);

                // Verify signature
                assert(
                    self.verify_withdrawal_signature(*request, *signature_r, *signature_s),
                    'Invalid signature',
                );

                // Validate request
                assert(*request.amount > 0_u256, 'Invalid amount in batch');
                assert(
                    *request.amount >= self.min_withdrawal.read(), 'Amount below minimum in batch',
                );
                assert(
                    *request.amount <= self.max_withdrawal.read(), 'Amount above maximum in batch',
                );
                assert(*request.token == first_token, 'Same token required');

                // Check nonce
                let current_nonce = self.user_nonces.entry(*request.user).read();
                assert(*request.nonce == current_nonce, 'Invalid nonce in batch');

                total_amount += *request.amount;
                i += 1;
            }

            // Check total allowance upfront for the caller (assuming all requests are from same
            // caller)
            let caller = get_caller_address();
            let token_contract = IERC20Dispatcher { contract_address: first_token };
            let allowance = token_contract.allowance(caller, get_contract_address());
            assert(allowance >= total_amount, 'Insufficient allowance');

            // Second pass: process all withdrawals
            let mut i = 0;
            loop {
                if i >= requests.len() {
                    break;
                }

                let request = requests.at(i);

                // Transfer tokens from caller to contract
                let transfer_success = token_contract
                    .transfer_from(caller, get_contract_address(), *request.amount);
                assert(transfer_success, 'Transfer to contract failed');

                // Create withdrawal record
                let withdrawal_id = self.withdrawal_counter.read();
                let withdrawal_status = WithdrawalStatus {
                    withdrawal_id,
                    user: *request.user,
                    amount: *request.amount,
                    token_address: *request.token,
                    tx_ref: *request.tx_ref,
                    timestamp,
                    status: STATUS_PROCESSING,
                    block_number,
                    nonce: *request.nonce,
                };

                // Store withdrawal
                self.withdrawals.entry(withdrawal_id).write(withdrawal_status);
                self.withdrawal_counter.write(withdrawal_id + 1_u256);

                // Update user counters and nonce
                let user_count = self.user_withdrawal_count.entry(*request.user).read();
                self.user_withdrawal_count.entry(*request.user).write(user_count + 1_u256);
                self.user_withdrawals.entry((*request.user, user_count)).write(withdrawal_id);
                self.user_nonces.entry(*request.user).write(*request.nonce + 1_u256);

                processed_count += 1_u256;
                i += 1;
            }

            // Emit batch event
            let batch_id = self.batch_counter.read();
            self.batch_counter.write(batch_id + 1_u256);
            self
                .emit(
                    Event::BatchWithdrawalProcessed(
                        BatchWithdrawalProcessed {
                            batch_id, total_withdrawals: processed_count, total_amount, timestamp,
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
        fn complete_withdrawal_with_proof(
            ref self: ContractState, withdrawal_id: u256, proof: SettlementProof,
        ) {
            self.enter_non_reentrant();
            // Only backend admins can complete with proof
            self.accesscontrol.assert_only_role(BACKEND_ADMIN_ROLE);

            let mut withdrawal = self.withdrawals.entry(withdrawal_id).read();
            assert(withdrawal.status == STATUS_PROCESSING, 'Withdrawal not processing');

            // Verify settlement proof (basic validation)
            println!("DEBUG CONTRACT: proof.settled_amount = {}", proof.settled_amount);
            println!("DEBUG CONTRACT: withdrawal.amount = {}", withdrawal.amount);
            assert(proof.settled_amount == withdrawal.amount, 'Settlement amount mismatch');
            assert(proof.timestamp > withdrawal.timestamp, 'Invalid settlement timestamp');

            // Update status to completed
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

        // Explicitly mark a withdrawal as failed (e.g., fiat failed or policy violation)
        fn fail_withdrawal(ref self: ContractState, withdrawal_id: u256) {
            self.enter_non_reentrant();
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);

            let mut withdrawal = self.withdrawals.read(withdrawal_id);
            assert(withdrawal.status == STATUS_PROCESSING, 'Withdrawal not processing');

            withdrawal.status = STATUS_FAILED;
            self.withdrawals.write(withdrawal_id, withdrawal);

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
        fn set_backend_public_key(ref self: ContractState, public_key: felt252) {
            self.accesscontrol.assert_only_role(MANUAL_ADMIN_ROLE);
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
    }

    #[constructor] // Correct placement of constructor attribute
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        usdc_token: ContractAddress,
        backend_admin: ContractAddress,
        initial_manual_admins: Array<ContractAddress>,
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
        self.withdrawal_counter.write(1); // Start withdrawal_counter from 1
        self.batch_counter.write(1); // Start batch_counter from 1
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


