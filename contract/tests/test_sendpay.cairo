// Import the contract module itself
use sendpay::sendpay;
// Make the required inner structs available in scope
use sendpay::sendpay::{WithdrawalProcessed, BatchWithdrawalProcessed, TokenApprovalUpdated, EmergencyPaused, EmergencyResumed};
use sendpay::{WithdrawalData, WithdrawalStatus};

// Traits derived from the interface, allowing to interact with a deployed contract
use sendpay::{ISendPayDispatcher, ISendPayDispatcherTrait, IAdminDispatcher, IAdminDispatcherTrait};

// Required for declaring and deploying a contract
use snforge_std::{declare, DeclareResultTrait, ContractClassTrait};
// Cheatcodes to spy on events and assert their emissions
use snforge_std::{EventSpyAssertionsTrait, spy_events};
// Cheatcodes to cheat environment values
use snforge_std::{
    start_cheat_caller_address, stop_cheat_caller_address, start_cheat_block_timestamp,
    stop_cheat_block_timestamp, start_cheat_block_number, stop_cheat_block_number,
};
use starknet::{ContractAddress, contract_address_const};

// Mock ERC20 contract for testing
#[starknet::interface]
pub trait IMockERC20<TContractState> {
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn allowance(
        self: @TContractState, owner: ContractAddress, spender: ContractAddress,
    ) -> u256;
}

#[starknet::contract]
pub mod MockERC20 {
    use starknet::storage::*;
    use starknet::{ContractAddress, get_caller_address};

    #[storage]
    pub struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<ContractAddress, Map<ContractAddress, u256>>,
    }

    #[abi(embed_v0)]
    impl MockERC20Impl of super::IMockERC20<ContractState> {
        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let allowance = self.allowances.entry(sender).entry(caller).read();
            assert(allowance >= amount, 'Insufficient allowance');
            
            let sender_balance = self.balances.entry(sender).read();
            assert(sender_balance >= amount, 'Insufficient balance');
            
            // Update balances
            self.balances.entry(sender).write(sender_balance - amount);
            let recipient_balance = self.balances.entry(recipient).read();
            self.balances.entry(recipient).write(recipient_balance + amount);
            
            // Update allowance
            self.allowances.entry(sender).entry(caller).write(allowance - amount);
            
            true
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.allowances.entry(caller).entry(spender).write(amount);
            true
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.allowances.entry(owner).entry(spender).read()
        }
    }

    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            let balance = self.balances.entry(to).read();
            self.balances.entry(to).write(balance + amount);
        }
    }
}

// Test constants
fn OWNER() -> ContractAddress {
    contract_address_const::<'owner'>()
}

fn USER1() -> ContractAddress {
    contract_address_const::<'user1'>()
}

fn USER2() -> ContractAddress {
    contract_address_const::<'user2'>()
}

fn ADMIN() -> ContractAddress {
    contract_address_const::<'admin'>()
}

fn USDC_TOKEN() -> ContractAddress {
    contract_address_const::<'usdc_token'>()
}

// Helper function to deploy mock ERC20
fn deploy_mock_erc20() -> (IMockERC20Dispatcher, ContractAddress) {
    let contract = declare("MockERC20").unwrap().contract_class();
    let constructor_args = array![];
    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    
    let dispatcher = IMockERC20Dispatcher { contract_address };
    
    // Mint some tokens to test users
    let mut state = MockERC20::contract_state_for_testing();
    state.mint(USER1(), 1000000000_u256); // 1000 USDC
    state.mint(USER2(), 1000000000_u256); // 1000 USDC
    
    (dispatcher, contract_address)
}

// Helper function to deploy the SendPay contract
fn deploy_sendpay_contract() -> (ISendPayDispatcher, IAdminDispatcher, ContractAddress) {
    let contract = declare("sendpay").unwrap().contract_class();
    let mut constructor_args = array![];
    
    // Constructor args: owner, usdc_token, admin_address
    constructor_args.append(OWNER().into());
    constructor_args.append(USDC_TOKEN().into());
    constructor_args.append(ADMIN().into());
    
    let (contract_address, _) = contract.deploy(@constructor_args).unwrap();
    
    let sendpay_dispatcher = ISendPayDispatcher { contract_address };
    let admin_dispatcher = IAdminDispatcher { contract_address };
    
    (sendpay_dispatcher, admin_dispatcher, contract_address)
}

// Helper function to setup token approvals
fn setup_token_approval(token_dispatcher: IMockERC20Dispatcher, user: ContractAddress, spender: ContractAddress, amount: u256) {
    start_cheat_caller_address(token_dispatcher.contract_address, user);
    token_dispatcher.approve(spender, amount);
    stop_cheat_caller_address(token_dispatcher.contract_address);
}

#[test]
fn test_contract_deployment() {
    let (sendpay_dispatcher, _admin_dispatcher, _contract_address) = deploy_sendpay_contract();
    
    // Test that contract is deployed and constructor worked
    // We can't directly test storage variables, but we can test that calls don't panic
    // This implicitly tests that the contract was initialized properly
}

#[test]
fn test_successful_withdrawal() {
    let (token_dispatcher, token_address) = deploy_mock_erc20();
    let (sendpay_dispatcher, _admin_dispatcher, contract_address) = deploy_sendpay_contract();
    
    // Setup token approval
    setup_token_approval(token_dispatcher, USER1(), contract_address, 100000000_u256);
    
    // Setup internal approval tracking (this would normally be done through a separate function)
    // For testing, we'll assume the contract has this functionality
    
    let mut spy = spy_events();
    
    // Set caller to USER1
    start_cheat_caller_address(contract_address, USER1());
    start_cheat_block_timestamp(contract_address, 1000000_u64);
    start_cheat_block_number(contract_address, 100_u64);
    
    // Perform withdrawal
    sendpay_dispatcher.withdraw_and_process(
        1000000_u256, // 1 USDC
        token_address,
        'bank123'.try_into().unwrap(),
        'bankname'.try_into().unwrap(),
        'accountname'.try_into().unwrap(),
        USER1(),
    );
    
    // Verify event emission
    let expected_event = sendpay::Event::WithdrawalProcessed(
        WithdrawalProcessed {
            withdrawal_id: 1_u256,
            user: USER1(),
            amount: 1000000_u256,
            token_address: token_address,
            bank_account: 'bank123'.try_into().unwrap(),
            bank_name: 'bankname'.try_into().unwrap(),
            account_name: 'accountname'.try_into().unwrap(),
            timestamp: 1000000_u64,
            block_number: 100_u64,
            status: 'processing',
        }
    );
    
    spy.assert_emitted(@array![(contract_address, expected_event)]);
    
    stop_cheat_caller_address(contract_address);
    stop_cheat_block_timestamp(contract_address);
    stop_cheat_block_number(contract_address);
}

#[test]
#[should_panic(expected: ('Amount must be greater than 0',))]
fn test_withdrawal_zero_amount() {
    let (token_dispatcher, token_address) = deploy_mock_erc20();
    let (sendpay_dispatcher, _admin_dispatcher, contract_address) = deploy_sendpay_contract();
    
    start_cheat_caller_address(contract_address, USER1());
    
    // Try to withdraw zero amount
    sendpay_dispatcher.withdraw_and_process(
        0_u256, // Zero amount should fail
        token_address,
        'bank123'.try_into().unwrap(),
        'bankname'.try_into().unwrap(),
        'accountname'.try_into().unwrap(),
        USER1(),
    );
    
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: ('Amount below minimum',))]
fn test_withdrawal_below_minimum() {
    let (token_dispatcher, token_address) = deploy_mock_erc20();
    let (sendpay_dispatcher, _admin_dispatcher, contract_address) = deploy_sendpay_contract();
    
    start_cheat_caller_address(contract_address, USER1());
    
    // Try to withdraw below minimum (1 USDC = 1000000, so 500000 is below minimum)
    sendpay_dispatcher.withdraw_and_process(
        500000_u256,
        token_address,
        'bank123'.try_into().unwrap(),
        'bankname'.try_into().unwrap(),
        'accountname'.try_into().unwrap(),
        USER1(),
    );
    
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: ('Amount above maximum',))]
fn test_withdrawal_above_maximum() {
    let (token_dispatcher, token_address) = deploy_mock_erc20();
    let (sendpay_dispatcher, _admin_dispatcher, contract_address) = deploy_sendpay_contract();
    
    start_cheat_caller_address(contract_address, USER1());
    
    // Try to withdraw above maximum (1000 USDC = 1000000000, so 2000000000 is above maximum)
    sendpay_dispatcher.withdraw_and_process(
        2000000000_u256,
        token_address,
        'bank123'.try_into().unwrap(),
        'bankname'.try_into().unwrap(),
        'accountname'.try_into().unwrap(),
        USER1(),
    );
    
    stop_cheat_caller_address(contract_address);
}

#[test]
fn test_get_withdrawal_status() {
    let (token_dispatcher, token_address) = deploy_mock_erc20();
    let (sendpay_dispatcher, _admin_dispatcher, contract_address) = deploy_sendpay_contract();
    
    // Setup token approval
    setup_token_approval(token_dispatcher, USER1(), contract_address, 100000000_u256);
    
    start_cheat_caller_address(contract_address, USER1());
    start_cheat_block_timestamp(contract_address, 1000000_u64);
    start_cheat_block_number(contract_address, 100_u64);
    
    // Perform withdrawal
    sendpay_dispatcher.withdraw_and_process(
        1000000_u256,
        token_address,
        'bank123'.try_into().unwrap(),
        'bankname'.try_into().unwrap(),
        'accountname'.try_into().unwrap(),
        USER1(),
    );
    
    // Get withdrawal status
    let status = sendpay_dispatcher.get_withdrawal_status(1_u256);
    
    // Verify status
    assert(status.withdrawal_id == 1_u256, 'Wrong withdrawal ID');
    assert(status.user == USER1(), 'Wrong user');
    assert(status.amount == 1000000_u256, 'Wrong amount');
    assert(status.token_address == token_address, 'Wrong token address');
    assert(status.status == 'processing', 'Wrong status');
    
    stop_cheat_caller_address(contract_address);
    stop_cheat_block_timestamp(contract_address);
    stop_cheat_block_number(contract_address);
}

#[test]
fn test_batch_withdrawal() {
    let (token_dispatcher, token_address) = deploy_mock_erc20();
    let (sendpay_dispatcher, _admin_dispatcher, contract_address) = deploy_sendpay_contract();
    
    // Setup token approval for larger amount
    setup_token_approval(token_dispatcher, USER1(), contract_address, 300000000_u256);
    
    let mut spy = spy_events();
    
    start_cheat_caller_address(contract_address, USER1());
    start_cheat_block_timestamp(contract_address, 1000000_u64);
    
    // Create batch withdrawals
    let mut withdrawals = array![];
    withdrawals.append(WithdrawalData {
        amount: 1000000_u256,
        token_address: token_address,
        bank_account: 'bank123'.try_into().unwrap(),
        bank_name: 'bankname1'.try_into().unwrap(),
        account_name: 'account1'.try_into().unwrap(),
        recipient: USER1(),
    });
    withdrawals.append(WithdrawalData {
        amount: 2000000_u256,
        token_address: token_address,
        bank_account: 'bank456'.try_into().unwrap(),
        bank_name: 'bankname2'.try_into().unwrap(),
        account_name: 'account2'.try_into().unwrap(),
        recipient: USER1(),
    });
    
    // Perform batch withdrawal
    sendpay_dispatcher.batch_withdraw_and_process(withdrawals);
    
    // Verify batch event emission
    let expected_batch_event = sendpay::Event::BatchWithdrawalProcessed(
        BatchWithdrawalProcessed {
            batch_id: 1000000_u256, // timestamp converted to u256
            total_withdrawals: 2_u256,
            total_amount: 3000000_u256,
            timestamp: 1000000_u64,
        }
    );
    
    spy.assert_emitted(@array![(contract_address, expected_batch_event)]);
    
    stop_cheat_caller_address(contract_address);
    stop_cheat_block_timestamp(contract_address);
}

#[test]
fn test_emergency_pause_and_resume() {
    let (sendpay_dispatcher, _admin_dispatcher, contract_address) = deploy_sendpay_contract();
    
    let mut spy = spy_events();
    
    start_cheat_caller_address(contract_address, OWNER());
    start_cheat_block_timestamp(contract_address, 1000000_u64);
    
    // Test emergency pause
    sendpay_dispatcher.emergency_pause('security_issue');
    
    // Verify pause event
    let expected_pause_event = sendpay::Event::EmergencyPaused(
        EmergencyPaused {
            reason: 'security_issue',
            timestamp: 1000000_u64,
        }
    );
    spy.assert_emitted(@array![(contract_address, expected_pause_event)]);
    
    // Test emergency resume
    sendpay_dispatcher.emergency_resume();
    
    // Verify resume event
    let expected_resume_event = sendpay::Event::EmergencyResumed(
        EmergencyResumed {
            timestamp: 1000000_u64,
        }
    );
    spy.assert_emitted(@array![(contract_address, expected_resume_event)]);
    
    stop_cheat_caller_address(contract_address);
    stop_cheat_block_timestamp(contract_address);
}

#[test]
fn test_admin_complete_withdrawal() {
    let (token_dispatcher, token_address) = deploy_mock_erc20();
    let (sendpay_dispatcher, admin_dispatcher, contract_address) = deploy_sendpay_contract();
    
    // Setup token approval
    setup_token_approval(token_dispatcher, USER1(), contract_address, 100000000_u256);
    
    // First, create a withdrawal as USER1
    start_cheat_caller_address(contract_address, USER1());
    sendpay_dispatcher.withdraw_and_process(
        1000000_u256,
        token_address,
        'bank123'.try_into().unwrap(),
        'bankname'.try_into().unwrap(),
        'accountname'.try_into().unwrap(),
        USER1(),
    );
    stop_cheat_caller_address(contract_address);
    
    let mut spy = spy_events();
    
    // Now complete the withdrawal as OWNER
    start_cheat_caller_address(contract_address, OWNER());
    admin_dispatcher.complete_withdrawal(1_u256);
    
    // Verify completion event
    let status = sendpay_dispatcher.get_withdrawal_status(1_u256);
    assert(status.status == 'completed', 'Withdrawal not completed');
    
    stop_cheat_caller_address(contract_address);
}

#[test]
fn test_admin_update_config() {
    let (_sendpay_dispatcher, admin_dispatcher, contract_address) = deploy_sendpay_contract();
    
    start_cheat_caller_address(contract_address, OWNER());
    
    // Update configuration
    admin_dispatcher.update_config(
        500000_u256, // new min withdrawal
        2000000000_u256, // new max withdrawal
        10000_u256, // new processing fee
    );
    
    // Test would pass if no panic occurs
    stop_cheat_caller_address(contract_address);
}

#[test]
#[should_panic(expected: ('Only owner',))]
fn test_unauthorized_admin_functions() {
    let (_sendpay_dispatcher, admin_dispatcher, contract_address) = deploy_sendpay_contract();
    
    // Try to call admin function as non-owner
    start_cheat_caller_address(contract_address, USER1());
    
    admin_dispatcher.complete_withdrawal(1_u256);
    
    stop_cheat_caller_address(contract_address);
}

#[test]
fn test_token_approval_check() {
    let (token_dispatcher, token_address) = deploy_mock_erc20();
    let (sendpay_dispatcher, _admin_dispatcher, contract_address) = deploy_sendpay_contract();
    
    // Setup token approval
    setup_token_approval(token_dispatcher, USER1(), contract_address, 100000000_u256);
    
    // Check token approval
    let has_approval = sendpay_dispatcher.check_token_approval(
        USER1(),
        token_address,
        50000000_u256
    );
    
    assert(has_approval, 'Should have approval');
    
    // Check insufficient approval
    let insufficient_approval = sendpay_dispatcher.check_token_approval(
        USER1(),
        token_address,
        200000000_u256
    );
    
    assert(!insufficient_approval, 'Should not have approval');
}