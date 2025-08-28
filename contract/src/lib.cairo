// Top-level imports
use starknet::ContractAddress;
use starknet::storage::*;


// The ERC20 component is not directly used, a custom IERC20 is defined.
// If you intend to use OpenZeppelin's ERC20 component, you would need:
// use openzeppelin_token::erc20::ERC20Component;

// Optimized withdrawal data structure
#[derive(Drop, Serde, starknet::Store)] // Added Serde derive
pub struct WithdrawalData {
    pub amount: u256,
    pub token_address: ContractAddress,
    pub bank_account: felt252,
    pub bank_name: felt252,
    pub account_name: felt252,
    pub recipient: ContractAddress,
}

// Compact withdrawal status for quick reads
#[derive(Drop, Copy, Serde, starknet::Store)] // Added Copy derive
pub struct WithdrawalStatus {
    pub withdrawal_id: u256,
    pub user: ContractAddress,
    pub amount: u256,
    pub token_address: ContractAddress,
    pub bank_account: felt252,
    pub bank_name: felt252,
    pub account_name: felt252,
    pub timestamp: u64,
    pub status: felt252,
    pub block_number: u64,
}

// ERC20 interface for token transfers (moved to top-level)
#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer_from(
        self: @TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;

    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;

    fn approve(self: @TContractState, spender: ContractAddress, amount: u256) -> bool;

    fn allowance(
        self: @TContractState, owner: ContractAddress, spender: ContractAddress,
    ) -> u256;
}

// Define the main contract interface
#[starknet::interface]
pub trait ISendPay<TContractState> {
    // Single function that handles everything in one call
    fn withdraw_and_process(
        ref self: TContractState,
        amount: u256,
        token_address: ContractAddress,
        bank_account: felt252,
        bank_name: felt252,
        account_name: felt252,
        recipient: ContractAddress,
    );

    // Batch withdrawals for multiple users
    fn batch_withdraw_and_process(ref self: TContractState, withdrawals: Array<WithdrawalData>);

    // Get withdrawal status quickly
    fn get_withdrawal_status(self: @TContractState, withdrawal_id: u256) -> WithdrawalStatus;

    // Get user's withdrawal history
    fn get_user_withdrawals(
        self: @TContractState, user: ContractAddress,
    ) -> Array<WithdrawalStatus>;

    // Check if user has approved tokens for contract
    fn check_token_approval(
        self: @TContractState, user: ContractAddress, token_address: ContractAddress, amount: u256,
    ) -> bool;

    // Emergency functions (part of ISendPay)
    fn emergency_pause(ref self: TContractState, reason: felt252);
    fn emergency_resume(ref self: TContractState);
}

// Define Admin interface for privileged operations
#[starknet::interface]
pub trait IAdmin<TContractState> {
    fn complete_withdrawal(ref self: TContractState, withdrawal_id: u256);
    fn update_config(
        ref self: TContractState,
        min_withdrawal: u256,
        max_withdrawal: u256,
        processing_fee: u256,
    );
    fn set_usdc_token(ref self: TContractState, token_address: ContractAddress);
    fn set_admin_address(ref self: TContractState, admin: ContractAddress);
}


// Main contract with optimized storage and latest Cairo features
#[starknet::contract]
pub mod sendpay {
    // OpenZeppelin Component Imports (These depend on Scarb.toml configuration)
    use openzeppelin::access::ownable::OwnableComponent;
    use openzeppelin::security::pausable::{PausableComponent, PausableComponent::InternalTrait};
    // ERC20 component not used in current implementation

    // Core library imports
    use starknet::{
        get_block_timestamp, get_caller_address, get_block_number, get_contract_address, ContractAddress
    };
    use starknet::storage::*;
    use core::array::{ArrayTrait, Array}; // Import Array type
    // Removed: use core::vec::VecTrait; // VecTrait for Vec operations

    use super::{
        WithdrawalData, WithdrawalStatus,
        IERC20Dispatcher, IERC20DispatcherTrait
    };

    // Define components
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    // If using ERC20Component: component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    #[storage]
    pub struct Storage {
        // Core functionality components
        #[substorage(v0)]
        pub ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        pub pausable: PausableComponent::Storage,
        // Optimized withdrawal tracking
        pub withdrawal_counter: u256, // Starts from 1 to avoid ID 0 ambiguity
        pub withdrawals: Map<u256, WithdrawalStatus>,
        pub user_withdrawal_count: Map<ContractAddress, u256>,
        // TODO: Arrays cannot be stored in Cairo storage directly - need to implement differently
        // pub user_withdrawals: Map<ContractAddress, Array<u256>>,
        // Fast access mappings
        pub withdrawal_by_hash: Map<u256, u256>, // bank_account + timestamp hash -> withdrawal_id
        // Configuration
        pub usdc_token: ContractAddress,
        pub admin_address: ContractAddress,
        pub processing_fee: u256,
        pub min_withdrawal: u256,
        pub max_withdrawal: u256,
        // Token approval tracking
        pub approved_tokens: Map<
            ContractAddress, Map<ContractAddress, u256>,
        >, // user -> token -> amount
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        // Single optimized event with all data
        WithdrawalProcessed: WithdrawalProcessed,
        // Batch processing event
        BatchWithdrawalProcessed: BatchWithdrawalProcessed,
        // Token approval events
        TokenApprovalUpdated: TokenApprovalUpdated,
        // Emergency events
        EmergencyPaused: EmergencyPaused,
        EmergencyResumed: EmergencyResumed,
    }

    // Single comprehensive event
    #[derive(Drop, starknet::Event)]
    pub struct WithdrawalProcessed {
        pub withdrawal_id: u256,
        pub user: ContractAddress,
        pub amount: u256,
        pub token_address: ContractAddress,
        pub bank_account: felt252,
        pub bank_name: felt252,
        pub account_name: felt252,
        pub timestamp: u64,
        pub block_number: u64,
        pub status: felt252,
    }

    // Batch processing event
    #[derive(Drop, starknet::Event)]
    pub struct BatchWithdrawalProcessed {
        pub batch_id: u256,
        pub total_withdrawals: u256,
        pub total_amount: u256,
        pub timestamp: u64,
    }

    // Token approval events
    #[derive(Drop, starknet::Event)]
    pub struct TokenApprovalUpdated {
        pub user: ContractAddress,
        pub token: ContractAddress,
        pub amount: u256,
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
    // External
    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    #[abi(embed_v0)]
    impl OwnableMixinImpl = OwnableComponent::OwnableMixinImpl<ContractState>;

    // Internal
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl SendPayImpl of super::ISendPay<ContractState> {
        // Optimized single function that handles everything
        fn withdraw_and_process(
            ref self: ContractState,
            amount: u256,
            token_address: ContractAddress,
            bank_account: felt252,
            bank_name: felt252,
            account_name: felt252,
            recipient: ContractAddress,
        ) {
            // Fast validation checks
            self.pausable.assert_not_paused(); // This method belongs to PausableComponent
            assert(amount > 0, 'Amount must be greater than 0');
            assert(amount >= self.min_withdrawal.read(), 'Amount below minimum');
            assert(amount <= self.max_withdrawal.read(), 'Amount above maximum');

            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let block_number = get_block_number();

            // Check if user has approved tokens for this contract
            let approved_amount = self.approved_tokens.entry(caller).entry(token_address).read();
            assert(approved_amount >= amount, 'Insufficient token approval');

            // Generate unique withdrawal ID using bank account + timestamp
            let withdrawal_hash = self.generate_withdrawal_hash(bank_account, timestamp);
            assert(
                self.withdrawal_by_hash.entry(withdrawal_hash).read() == 0_u256, // Check for non-existence, as ID 0 is reserved
                'Duplicate withdrawal',
            );

            // Transfer tokens from user to contract (requires prior approval)
            self
                .transfer_tokens_with_approval(
                    token_address, caller, get_contract_address(), amount,
                );

            // Create withdrawal record with all data
            let withdrawal_id = self.withdrawal_counter.read();
            let withdrawal = WithdrawalStatus {
                withdrawal_id,
                user: caller,
                amount,
                token_address,
                bank_account,
                bank_name,
                account_name,
                timestamp,
                status: 'processing', // Start as processing immediately
                block_number,
            };

            // Store everything in one operation
            self.withdrawals.entry(withdrawal_id).write(withdrawal);
            self.withdrawal_by_hash.entry(withdrawal_hash).write(withdrawal_id);
            self.withdrawal_counter.write(withdrawal_id + 1);

            // Update user tracking efficiently
            let user_count = self.user_withdrawal_count.entry(caller).read();
            self.user_withdrawal_count.entry(caller).write(user_count + 1);

            // TODO: Fix array storage issue
            // let mut user_withdrawals = self.user_withdrawals.entry(caller).read();
            // user_withdrawals.append(withdrawal_id);
            // self.user_withdrawals.entry(caller).write(user_withdrawals);

            // Emit single comprehensive event
            self
                .emit(
                    Event::WithdrawalProcessed(
                        WithdrawalProcessed {
                            withdrawal_id,
                            user: caller,
                            amount,
                            token_address,
                            bank_account,
                            bank_name,
                            account_name,
                            timestamp,
                            block_number,
                            status: 'processing',
                        },
                    ),
                );
        }

        // Batch processing for multiple withdrawals
        fn batch_withdraw_and_process(ref self: ContractState, withdrawals: Array<WithdrawalData>) {
            self.pausable.assert_not_paused(); // This method belongs to PausableComponent
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let block_number = get_block_number();

            let mut total_amount = 0;
            let mut processed_count = 0;

            let mut i = 0;
            loop {
                if i >= withdrawals.len() {
                    break;
                }

                let withdrawal = withdrawals.at(i);

                // Validate withdrawal data
                assert(*withdrawal.amount > 0, 'Invalid amount in batch');
                assert(
                    *withdrawal.amount >= self.min_withdrawal.read(),
                    'Amount below minimum in batch',
                );
                assert(
                    *withdrawal.amount <= self.max_withdrawal.read(),
                    'Amount above maximum in batch',
                );

                // Check token approval
                let approved_amount = self
                    .approved_tokens
                    .entry(caller)
                    .entry(*withdrawal.token_address)
                    .read();
                assert(
                    approved_amount >= *withdrawal.amount, 'Insufficient approval in batch',
                );

                // Transfer tokens
                self
                    .transfer_tokens_with_approval(
                        *withdrawal.token_address,
                        caller,
                        get_contract_address(),
                        *withdrawal.amount,
                    );

                // Create withdrawal record
                let withdrawal_id = self.withdrawal_counter.read();
                let withdrawal_status = WithdrawalStatus {
                    withdrawal_id,
                    user: caller,
                    amount: *withdrawal.amount,
                    token_address: *withdrawal.token_address,
                    bank_account: *withdrawal.bank_account,
                    bank_name: *withdrawal.bank_name,
                    account_name: *withdrawal.account_name,
                    timestamp,
                    status: 'processing',
                    block_number,
                };

                // Store withdrawal
                self.withdrawals.entry(withdrawal_id).write(withdrawal_status);
                self.withdrawal_counter.write(withdrawal_id + 1);

                total_amount += *withdrawal.amount;
                processed_count += 1;

                i += 1;
            }

            // Emit batch event
            self
                .emit(
                    Event::BatchWithdrawalProcessed(
                        BatchWithdrawalProcessed {
                            batch_id: timestamp.into(), // Convert u64 to u256
                            total_withdrawals: processed_count.into(), // Convert u256 to u256 (redundant, but explicit)
                            total_amount,
                            timestamp,
                        },
                    ),
                );
        }

        // Fast status lookup
        fn get_withdrawal_status(self: @ContractState, withdrawal_id: u256) -> WithdrawalStatus {
            self.withdrawals.read(withdrawal_id)
        }

        // Get user's withdrawal history
        fn get_user_withdrawals(
            self: @ContractState, user: ContractAddress,
        ) -> Array<WithdrawalStatus> {
            // TODO: Implement proper user withdrawal tracking without arrays in storage
            let mut result = ArrayTrait::new();
            
            // Commented out until array storage issue is resolved:
            // This would require iterating through user_withdrawals storage
            // which used Array<u256> that cannot be stored in Cairo storage
            
            result
        }

        // Check if user has approved tokens for contract
        fn check_token_approval(
            self: @ContractState,
            user: ContractAddress,
            token_address: ContractAddress,
            amount: u256,
        ) -> bool {
            let approved_amount = self.approved_tokens.entry(user).entry(token_address).read();
            approved_amount >= amount
        }

        // Emergency pause with reason
        fn emergency_pause(ref self: ContractState, reason: felt252) {
            self.ownable.assert_only_owner(); // This method belongs to OwnableComponent
            self.pausable.pause(); // This method belongs to PausableComponent

            self
                .emit(
                    Event::EmergencyPaused(
                        EmergencyPaused { reason, timestamp: get_block_timestamp() },
                    ),
                );
        }

        // Emergency resume
        fn emergency_resume(ref self: ContractState) {
            self.ownable.assert_only_owner(); // This method belongs to OwnableComponent
            self.pausable.unpause(); // This method belongs to PausableComponent

            self
                .emit(
                    Event::EmergencyResumed(EmergencyResumed { timestamp: get_block_timestamp() }),
                );
        }
    }

    #[abi(embed_v0)]
    impl AdminImpl of super::IAdmin<ContractState> { // Implements the new IAdmin trait
        // Fast withdrawal completion
        fn complete_withdrawal(ref self: ContractState, withdrawal_id: u256) {
            self.ownable.assert_only_owner(); // This method belongs to OwnableComponent

            let mut withdrawal = self.withdrawals.read(withdrawal_id);
            assert(withdrawal.status == 'processing', 'Withdrawal not processing');

            // Update status to completed
            withdrawal.status = 'completed';
            self.withdrawals.write(withdrawal_id, withdrawal);

            // Emit completion event
            self
                .emit(
                    Event::WithdrawalProcessed(
                        WithdrawalProcessed {
                            withdrawal_id,
                            user: withdrawal.user,
                            amount: withdrawal.amount,
                            token_address: withdrawal.token_address,
                            bank_account: withdrawal.bank_account,
                            bank_name: withdrawal.bank_name,
                            account_name: withdrawal.account_name,
                            timestamp: withdrawal.timestamp,
                            block_number: withdrawal.block_number,
                            status: 'completed',
                        },
                    ),
                );
        }

        // Update configuration
        fn update_config(
            ref self: ContractState,
            min_withdrawal: u256,
            max_withdrawal: u256,
            processing_fee: u256,
        ) {
            self.ownable.assert_only_owner(); // This method belongs to OwnableComponent
            self.min_withdrawal.write(min_withdrawal);
            self.max_withdrawal.write(max_withdrawal);
            self.processing_fee.write(processing_fee);
        }

        // Set token addresses
        fn set_usdc_token(ref self: ContractState, token_address: ContractAddress) {
            self.ownable.assert_only_owner(); // This method belongs to OwnableComponent
            self.usdc_token.write(token_address);
        }

        fn set_admin_address(ref self: ContractState, admin: ContractAddress) {
            self.ownable.assert_only_owner(); // This method belongs to OwnableComponent
            self.admin_address.write(admin);
        }
    }

    #[constructor] // Correct placement of constructor attribute
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        usdc_token: ContractAddress,
        admin_address: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        // Pausable initializer - no parameters needed
        self.usdc_token.write(usdc_token);
        self.admin_address.write(admin_address);
        self.withdrawal_counter.write(1); // Start withdrawal_counter from 1

        // Set default configuration
        self.min_withdrawal.write(1000000); // 1 USDC (6 decimals)
        self.max_withdrawal.write(1000000000); // 1000 USDC
        self.processing_fee.write(0); // No fee for MVP
    }

    // Helper functions (private functions within the module)
    // Generate unique withdrawal hash
    #[generate_trait]
    impl InternalImpl of InternalTraitImpl {
        fn generate_withdrawal_hash(
            self: @ContractState, bank_account: felt252, timestamp: u64,
        ) -> u256 {
            // Simple hash for uniqueness
            let hash_value: u256 = bank_account.into() + timestamp.into();
            hash_value
        }

        // Transfer tokens with approval check
        fn transfer_tokens_with_approval(
            ref self: ContractState,
            token_address: ContractAddress,
            from: ContractAddress,
            to: ContractAddress,
            amount: u256,
        ) {
            // Check if user has approved tokens for this contract
            let approved_amount = self.approved_tokens.entry(from).entry(token_address).read();
            assert(approved_amount >= amount, 'Insufficient token approval');

            // Transfer tokens using ERC20 transferFrom
            let token_contract = IERC20Dispatcher { contract_address: token_address };
            token_contract.transfer_from(from, to, amount);

            // Update approved amount (reduce by spent amount)
            self.approved_tokens.entry(from).entry(token_address).write(approved_amount - amount);
        }

        // Update token approval for user
        fn update_token_approval(
            ref self: ContractState,
            user: ContractAddress,
            token_address: ContractAddress,
            amount: u256,
        ) {
            let current_approval = self.approved_tokens.entry(user).entry(token_address).read();
            self.approved_tokens.entry(user).entry(token_address).write(current_approval + amount);

            // Emit approval update event
            self
                .emit(
                    Event::TokenApprovalUpdated(
                        TokenApprovalUpdated {
                            user,
                            token: token_address,
                            amount: current_approval + amount,
                            timestamp: get_block_timestamp(),
                        },
                    ),
                );
        }
    }
}