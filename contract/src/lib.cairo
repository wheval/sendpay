mod sendpay;

use starknet::{
    contract_address_const, get_caller_address, get_block_timestamp, 
    get_block_number, get_contract_address
};
use openzeppelin::token::erc20::ERC20;
use openzeppelin::access::ownable::Ownable;
use openzeppelin::security::pausable::Pausable;

// Optimized interface for faster processing
starknet::interface!(ISendPay<TContractState> {
    // Single function that handles everything in one call
    fn withdraw_and_process(
        ref self: TContractState,
        amount: u256,
        token_address: ContractAddress,
        bank_account: felt252,
        bank_name: felt252,
        account_name: felt252,
        recipient: ContractAddress
    );
    
    // Batch withdrawals for multiple users
    fn batch_withdraw_and_process(
        ref self: TContractState,
        withdrawals: Array<WithdrawalData>
    );
    
    // Get withdrawal status quickly
    fn get_withdrawal_status(self: @TContractState, withdrawal_id: u256) -> WithdrawalStatus;
    
    // Get user's withdrawal history
    fn get_user_withdrawals(self: @TContractState, user: ContractAddress) -> Array<WithdrawalStatus>;
    
    // Check if user has approved tokens for contract
    fn check_token_approval(
        self: @TContractState,
        user: ContractAddress,
        token_address: ContractAddress,
        amount: u256
    ) -> bool;
    
    // Emergency functions
    fn emergency_pause(ref self: ContractState, reason: felt252);
    fn emergency_resume(ref self: ContractState);
});

// Optimized withdrawal data structure
#[derive(Drop, starknet::Store)]
struct WithdrawalData {
    amount: u256,
    token_address: ContractAddress,
    bank_account: felt252,
    bank_name: felt252,
    account_name: felt252,
    recipient: ContractAddress
}

// Compact withdrawal status for quick reads
#[derive(Drop, starknet::Store)]
struct WithdrawalStatus {
    withdrawal_id: u256,
    user: ContractAddress,
    amount: u256,
    token_address: ContractAddress,
    bank_account: felt252,
    bank_name: felt252,
    account_name: felt252,
    timestamp: u64,
    status: felt252,
    block_number: u64
}

// Main contract with optimized storage and latest Cairo features
#[starknet::contract]
mod sendpay {
    use super::ISendPay;
    use super::{WithdrawalData, WithdrawalStatus};
    use starknet::{
        contract_address_const, get_caller_address, get_block_timestamp, 
        get_block_number, get_contract_address
    };
    use openzeppelin::token::erc20::ERC20;
    use openzeppelin::access::ownable::Ownable;
    use openzeppelin::security::pausable::Pausable;
    
    #[storage]
    struct Storage {
        // Core functionality
        ownable: Ownable<ContractState>,
        pausable: Pausable<ContractState>,
        
        // Optimized withdrawal tracking
        withdrawal_counter: u256,
        withdrawals: Map<u256, WithdrawalStatus>,
        user_withdrawal_count: Map<ContractAddress, u256>,
        user_withdrawals: Map<ContractAddress, Array<u256>>,
        
        // Fast access mappings
        withdrawal_by_hash: Map<felt252, u256>, // bank_account + timestamp hash
        
        // Configuration
        usdc_token: ContractAddress,
        admin_address: ContractAddress,
        processing_fee: u256,
        min_withdrawal: u256,
        max_withdrawal: u256,
        
        // Token approval tracking
        approved_tokens: Map<ContractAddress, Map<ContractAddress, u256>>, // user -> token -> amount
    }
    
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: Ownable<ContractState>::Event,
        #[flat]
        PausableEvent: Pausable<ContractState>::Event,
        
        // Single optimized event with all data
        WithdrawalProcessed: WithdrawalProcessed,
        
        // Batch processing event
        BatchWithdrawalProcessed: BatchWithdrawalProcessed,
        
        // Token approval events
        TokenApprovalUpdated: TokenApprovalUpdated,
        
        // Emergency events
        EmergencyPaused: EmergencyPaused,
        EmergencyResumed: EmergencyResumed
    }
    
    // Single comprehensive event
    #[derive(Drop, starknet::Event)]
    struct WithdrawalProcessed {
        withdrawal_id: u256,
        user: ContractAddress,
        amount: u256,
        token_address: ContractAddress,
        bank_account: felt252,
        bank_name: felt252,
        account_name: felt252,
        timestamp: u64,
        block_number: u64,
        status: felt252
    }
    
    // Batch processing event
    #[derive(Drop, starknet::Event)]
    struct BatchWithdrawalProcessed {
        batch_id: u256,
        total_withdrawals: u256,
        total_amount: u256,
        timestamp: u64
    }
    
    // Token approval events
    #[derive(Drop, starknet::Event)]
    struct TokenApprovalUpdated {
        user: ContractAddress,
        token: ContractAddress,
        amount: u256,
        timestamp: u64
    }
    
    // Emergency control events
    #[derive(Drop, starknet::Event)]
    struct EmergencyPaused {
        reason: felt252,
        timestamp: u64
    }
    
    #[derive(Drop, starknet::Event)]
    struct EmergencyResumed {
        timestamp: u64
    }
    
    #[external(v0)]
    impl SendPayImpl of super::ISendPay<ContractState> {
        // Optimized single function that handles everything
        fn withdraw_and_process(
            ref self: ContractState,
            amount: u256,
            token_address: ContractAddress,
            bank_account: felt252,
            bank_name: felt252,
            account_name: felt252,
            recipient: ContractAddress
        ) {
            // Fast validation checks
            self.pausable.assert_not_paused();
            assert(amount > 0, 'Amount must be greater than 0');
            assert(amount >= self.min_withdrawal.read(), 'Amount below minimum');
            assert(amount <= self.max_withdrawal.read(), 'Amount above maximum');
            
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let block_number = get_block_number();
            
            // Check if user has approved tokens for this contract
            let approved_amount = self.approved_tokens.read(caller).read(token_address);
            assert(approved_amount >= amount, 'Insufficient token approval');
            
            // Generate unique withdrawal ID using bank account + timestamp
            let withdrawal_hash = self.generate_withdrawal_hash(bank_account, timestamp);
            assert(!self.withdrawal_by_hash.read(withdrawal_hash).is_some(), 'Duplicate withdrawal');
            
            // Transfer tokens from user to contract (requires prior approval)
            self.transfer_tokens_with_approval(token_address, caller, contract_address_const!(), amount);
            
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
                block_number
            };
            
            // Store everything in one operation
            self.withdrawals.write(withdrawal_id, withdrawal);
            self.withdrawal_by_hash.write(withdrawal_hash, withdrawal_id);
            self.withdrawal_counter.write(withdrawal_id + 1);
            
            // Update user tracking efficiently
            let user_count = self.user_withdrawal_count.read(caller);
            self.user_withdrawal_count.write(caller, user_count + 1);
            
            let mut user_withdrawals = self.user_withdrawals.read(caller);
            user_withdrawals.append(withdrawal_id);
            self.user_withdrawals.write(caller, user_withdrawals);
            
            // Emit single comprehensive event
            self.emit(Event::WithdrawalProcessed(WithdrawalProcessed {
                withdrawal_id,
                user: caller,
                amount,
                token_address,
                bank_account,
                bank_name,
                account_name,
                timestamp,
                block_number,
                status: 'processing'
            }));
        }
        
        // Batch processing for multiple withdrawals
        fn batch_withdraw_and_process(
            ref self: ContractState,
            withdrawals: Array<WithdrawalData>
        ) {
            self.pausable.assert_not_paused();
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();
            let block_number = get_block_number();
            
            let mut total_amount = 0;
            let mut processed_count = 0;
            
            // Process all withdrawals in one transaction
            let mut i = 0;
            loop {
                if i >= withdrawals.len() {
                    break;
                }
                
                let withdrawal = withdrawals.at(i);
                
                // Validate withdrawal data
                assert(withdrawal.amount > 0, 'Invalid amount in batch');
                assert(withdrawal.amount >= self.min_withdrawal.read(), 'Amount below minimum in batch');
                assert(withdrawal.amount <= self.max_withdrawal.read(), 'Amount above maximum in batch');
                
                // Check token approval
                let approved_amount = self.approved_tokens.read(caller).read(withdrawal.token_address);
                assert(approved_amount >= withdrawal.amount, 'Insufficient token approval in batch');
                
                // Transfer tokens
                self.transfer_tokens_with_approval(
                    withdrawal.token_address, 
                    caller, 
                    contract_address_const!(), 
                    withdrawal.amount
                );
                
                // Create withdrawal record
                let withdrawal_id = self.withdrawal_counter.read();
                let withdrawal_status = WithdrawalStatus {
                    withdrawal_id,
                    user: caller,
                    amount: withdrawal.amount,
                    token_address: withdrawal.token_address,
                    bank_account: withdrawal.bank_account,
                    bank_name: withdrawal.bank_name,
                    account_name: withdrawal.account_name,
                    timestamp,
                    status: 'processing',
                    block_number
                };
                
                // Store withdrawal
                self.withdrawals.write(withdrawal_id, withdrawal_status);
                self.withdrawal_counter.write(withdrawal_id + 1);
                
                total_amount += withdrawal.amount;
                processed_count += 1;
                
                i += 1;
            };
            
            // Emit batch event
            self.emit(Event::BatchWithdrawalProcessed(BatchWithdrawalProcessed {
                batch_id: timestamp,
                total_withdrawals: processed_count,
                total_amount,
                timestamp
            }));
        }
        
        // Fast status lookup
        fn get_withdrawal_status(self: @ContractState, withdrawal_id: u256) -> WithdrawalStatus {
            self.withdrawals.read(withdrawal_id)
        }
        
        // Get user's withdrawal history
        fn get_user_withdrawals(self: @ContractState, user: ContractAddress) -> Array<WithdrawalStatus> {
            let user_withdrawals = self.user_withdrawals.read(user);
            let mut result = ArrayTrait::new();
            
            let mut i = 0;
            loop {
                if i >= user_withdrawals.len() {
                    break;
                }
                
                let withdrawal_id = user_withdrawals.at(i);
                let withdrawal = self.withdrawals.read(withdrawal_id);
                result.append(withdrawal);
                
                i += 1;
            };
            
            result
        }
        
        // Check if user has approved tokens for contract
        fn check_token_approval(
            self: @ContractState,
            user: ContractAddress,
            token_address: ContractAddress,
            amount: u256
        ) -> bool {
            let approved_amount = self.approved_tokens.read(user).read(token_address);
            approved_amount >= amount
        }
        
        // Emergency pause with reason
        fn emergency_pause(ref self: ContractState, reason: felt252) {
            self.ownable.assert_only_owner();
            self.pausable.pause();
            
            self.emit(Event::EmergencyPaused(EmergencyPaused {
                reason,
                timestamp: get_block_timestamp()
            }));
        }
        
        // Emergency resume
        fn emergency_resume(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.pausable.unpause();
            
            self.emit(Event::EmergencyResumed(EmergencyResumed {
                timestamp: get_block_timestamp()
            }));
        }
    }
    
    #[external(v0)]
    impl AdminImpl of super::ISendPay<ContractState> {
        // Fast withdrawal completion
        fn complete_withdrawal(ref self: ContractState, withdrawal_id: u256) {
            self.ownable.assert_only_owner();
            
            let mut withdrawal = self.withdrawals.read(withdrawal_id);
            assert(withdrawal.status == 'processing', 'Withdrawal not processing');
            
            // Update status to completed
            withdrawal.status = 'completed';
            self.withdrawals.write(withdrawal_id, withdrawal);
            
            // Emit completion event
            self.emit(Event::WithdrawalProcessed(WithdrawalProcessed {
                withdrawal_id,
                user: withdrawal.user,
                amount: withdrawal.amount,
                token_address: withdrawal.token_address,
                bank_account: withdrawal.bank_account,
                bank_name: withdrawal.bank_name,
                account_name: withdrawal.account_name,
                timestamp: withdrawal.timestamp,
                block_number: withdrawal.block_number,
                status: 'completed'
            }));
        }
        
        // Update configuration
        fn update_config(
            ref self: ContractState,
            min_withdrawal: u256,
            max_withdrawal: u256,
            processing_fee: u256
        ) {
            self.ownable.assert_only_owner();
            self.min_withdrawal.write(min_withdrawal);
            self.max_withdrawal.write(max_withdrawal);
            self.processing_fee.write(processing_fee);
        }
        
        // Set token addresses
        fn set_usdc_token(ref self: ContractState, token_address: ContractAddress) {
            self.ownable.assert_only_owner();
            self.usdc_token.write(token_address);
        }
        
        fn set_admin_address(ref self: ContractState, admin: ContractAddress) {
            self.ownable.assert_only_owner();
            self.admin_address.write(admin);
        }
    }
    
    #[constructor]
    impl Constructor of ContractImpl<ContractState> {
        fn constructor(
            ref self: ContractState,
            owner: ContractAddress,
            usdc_token: ContractAddress,
            admin_address: ContractAddress
        ) {
            self.ownable.initializer(owner);
            self.pausable.initializer();
            self.usdc_token.write(usdc_token);
            self.admin_address.write(admin_address);
            self.withdrawal_counter.write(0);
            
            // Set default configuration
            self.min_withdrawal.write(1000000); // 1 USDC (6 decimals)
            self.max_withdrawal.write(1000000000); // 1000 USDC
            self.processing_fee.write(0); // No fee for MVP
        }
    }
    
    // Helper functions for gas optimization
    impl ContractHelpers of ContractImpl<ContractState> {
        // Generate unique withdrawal hash
        fn generate_withdrawal_hash(
            self: @ContractState,
            bank_account: felt252,
            timestamp: u64
        ) -> felt252 {
            // Simple hash for uniqueness
            bank_account + timestamp
        }
        
        // Transfer tokens with approval check
        fn transfer_tokens_with_approval(
            ref self: ContractState,
            token_address: ContractAddress,
            from: ContractAddress,
            to: ContractAddress,
            amount: u256
        ) {
            // Check if user has approved tokens for this contract
            let approved_amount = self.approved_tokens.read(from).read(token_address);
            assert(approved_amount >= amount, 'Insufficient token approval');
            
            // Transfer tokens using ERC20 transferFrom
            let token_contract = IERC20Dispatcher { contract_address: token_address };
            token_contract.transfer_from(from, to, amount);
            
            // Update approved amount (reduce by spent amount)
            self.approved_tokens.write(from).write(token_address, approved_amount - amount);
        }
        
        // Update token approval for user
        fn update_token_approval(
            ref self: ContractState,
            user: ContractAddress,
            token_address: ContractAddress,
            amount: u256
        ) {
            let current_approval = self.approved_tokens.read(user).read(token_address);
            self.approved_tokens.write(user).write(token_address, current_approval + amount);
            
            // Emit approval update event
            self.emit(Event::TokenApprovalUpdated(TokenApprovalUpdated {
                user,
                token: token_address,
                amount: current_approval + amount,
                timestamp: get_block_timestamp()
            }));
        }
    }
    
    // ERC20 interface for token transfers
    #[starknet::interface]
    trait IERC20<TContractState> {
        fn transfer_from(
            self: @TContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256
        ) -> bool;
        
        fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
        
        fn approve(
            self: @TContractState,
            spender: ContractAddress,
            amount: u256
        ) -> bool;
        
        fn allowance(
            self: @TContractState,
            owner: ContractAddress,
            spender: ContractAddress
        ) -> u256;
    }
    
    impl OwnableImpl = Ownable<ContractState>;
    impl PausableImpl = Pausable<ContractState>;
}
