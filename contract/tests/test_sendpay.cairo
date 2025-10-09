// Mock ERC20 Contract for testing
#[starknet::interface]
pub trait IMockERC20<TContractState> {
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
}

#[starknet::contract]
pub mod MockERC20 {
    use starknet::storage::*;
    use starknet::{ContractAddress, get_caller_address};

    #[storage]
    pub struct Storage {
        pub balances: Map<ContractAddress, u256>,
        pub allowances: Map<(ContractAddress, ContractAddress), u256>,
        pub total_supply: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, initial_supply: u256, recipient: ContractAddress) {
        self.balances.entry(recipient).write(initial_supply);
        self.total_supply.write(initial_supply);
    }

    // Internal trait must be declared before its implementation and should not be marked as an
    // external interface
    trait InternalTrait<TContractState> {
        fn _transfer(
            ref self: TContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool;
    }

    #[abi(embed_v0)]
    impl ERC20Impl of super::IMockERC20<ContractState> {
        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let sender = get_caller_address();
            self._transfer(sender, recipient, amount)
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.allowances.entry((sender, caller)).read();

            assert(current_allowance >= amount, 'Insufficient allowance');

            self.allowances.entry((sender, caller)).write(current_allowance - amount);
            self._transfer(sender, recipient, amount)
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.allowances.entry((caller, spender)).write(amount);
            true
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.allowances.entry((owner, spender)).read()
        }
    }

    impl InternalImpl of InternalTrait<ContractState> {
        fn _transfer(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            assert(amount > 0_u256, 'Amount must be positive');

            let sender_balance = self.balances.entry(sender).read();
            assert(sender_balance >= amount, 'Insufficient balance');

            let recipient_balance = self.balances.entry(recipient).read();

            self.balances.entry(sender).write(sender_balance - amount);
            self.balances.entry(recipient).write(recipient_balance + amount);

            true
        }
    }
    // InternalTrait already declared above
}
use core::hash::HashStateTrait;

// Integration tests scaffold for sendpay using snforge
use core::poseidon::PoseidonTrait;
use core::traits::Into;
use sendpay::{WithdrawalRequest, SettlementProof, STATUS_COMPLETED};

// Admin extension dispatcher for whitelisting and deposits
use sendpay::sendpay::{IAdminExtDispatcher, IAdminExtDispatcherTrait};

// Import main contract interface dispatchers
use sendpay::{ISendPayDispatcher, ISendPayDispatcherTrait};
use sendpay::{IAdminDispatcher, IAdminDispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;


fn deploy_erc20(
    _name: felt252,
    _symbol: felt252,
    _decimals: u8,
    initial_supply: u256,
    recipient: ContractAddress,
) -> IMockERC20Dispatcher {
    let erc20 = declare("MockERC20").unwrap();
    let mut ctor = array![];
    // MockERC20 constructor: initial_supply, recipient
    Serde::serialize(@initial_supply, ref ctor);
    Serde::serialize(@recipient, ref ctor);
    let (addr, _) = erc20.contract_class().deploy(@ctor).unwrap();
    IMockERC20Dispatcher { contract_address: addr }
}

fn deploy_sendpay(
    owner: ContractAddress,
    usdc: ContractAddress,
    backend_admin: ContractAddress,
    manual_admin: ContractAddress,
) -> (ISendPayDispatcher, IAdminExtDispatcher, IAdminDispatcher) {
    let class = declare("sendpay").unwrap();
    let mut ctor = array![];
    // constructor(owner, usdc_token, backend_admin, initial_manual_admins)
    Serde::serialize(@owner, ref ctor);
    Serde::serialize(@usdc, ref ctor);
    Serde::serialize(@backend_admin, ref ctor);
    let mut admins = array![];
    Serde::serialize(@manual_admin, ref admins);
    Serde::serialize(@admins, ref ctor);
    let (addr, _) = class.contract_class().deploy(@ctor).unwrap();
    (ISendPayDispatcher { contract_address: addr }, IAdminExtDispatcher { contract_address: addr }, IAdminDispatcher { contract_address: addr })
}

fn poseidon_withdraw_hash(req: WithdrawalRequest) -> felt252 {
    let user_f: felt252 = req.user.into();
    let amount_f: felt252 = req.amount.try_into().unwrap();
    let token_f: felt252 = req.token.into();
    let nonce_f: felt252 = req.nonce.try_into().unwrap();
    let ts_f: felt252 = req.timestamp.into();
    PoseidonTrait::new()
        .update(user_f)
        .update(amount_f)
        .update(token_f)
        .update(req.tx_ref)
        .update(nonce_f)
        .update(ts_f)
        .finalize()
}

#[test]
#[ignore] // TODO: replace with working secp256k1 signing producing (r,s) matching check_ecdsa_signature
fn test_withdraw_with_signature_happy_path() {
    // Arrange
    let owner: ContractAddress = 111.try_into().unwrap();
    let backend_admin: ContractAddress = 222.try_into().unwrap();
    let manual_admin: ContractAddress = 333.try_into().unwrap();
    let user: ContractAddress = 444.try_into().unwrap();

    let zero: ContractAddress = 0.try_into().unwrap();
    let erc: IMockERC20Dispatcher = deploy_erc20('USDC', 'USDC', 6_u8, 1_000_000_000_u256, zero);

    let (sendpay_disp, admin_disp, admin_main_disp) = deploy_sendpay(
        owner, erc.contract_address, backend_admin, manual_admin,
    );

    // Whitelist the token
    start_cheat_caller_address(sendpay_disp.contract_address, manual_admin);
    admin_disp.add_allowed_token(erc.contract_address);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Mint to user and approve contract (assuming ERC20 supports transfer/mint in ctor)
    // User approves
    start_cheat_caller_address(erc.contract_address, user);
    let ok = erc.approve(sendpay_disp.contract_address, 1_000_000_u256);
    assert(ok, 'approve failed');
    stop_cheat_caller_address(erc.contract_address);

    // Set backend public key (placeholder felt value)
    start_cheat_caller_address(sendpay_disp.contract_address, manual_admin);
    // NOTE: set_backend_public_key is not exposed in ISendPay interface; skipping for now
    // sendpay_disp.set_backend_public_key(12345);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Build request
    let req = WithdrawalRequest {
        user,
        amount: 500_000_u256,
        token: erc.contract_address,
        tx_ref: 777,
        nonce: sendpay_disp.get_user_nonce(user),
        timestamp: 1000_u64,
    };

    // Compute message hash
    let _msg = poseidon_withdraw_hash(req);

    // Placeholder signature values (r,s)
    let r: felt252 = 1;
    let s: felt252 = 2;

    // Act (will fail until proper signature wiring is done)
    start_cheat_caller_address(sendpay_disp.contract_address, user);
    sendpay_disp.withdraw_with_signature(req, r, s);
    stop_cheat_caller_address(sendpay_disp.contract_address);
    // Assert: status/event checks would go here
}

#[test]
fn test_admin_can_whitelist_token() {
    let owner: ContractAddress = 11.try_into().unwrap();
    let backend_admin: ContractAddress = 22.try_into().unwrap();
    let manual_admin: ContractAddress = 33.try_into().unwrap();
    let zero: ContractAddress = 0.try_into().unwrap();
    let erc: IMockERC20Dispatcher = deploy_erc20('USDC', 'USDC', 6_u8, 0_u256, zero);
    let (sendpay_disp, admin_disp, admin_main_disp) = deploy_sendpay(
        owner, erc.contract_address, backend_admin, manual_admin,
    );

    start_cheat_caller_address(sendpay_disp.contract_address, manual_admin);
    admin_disp.add_allowed_token(erc.contract_address);
    stop_cheat_caller_address(sendpay_disp.contract_address);
    // No revert implies success; further reads would require a getter (not present), so we stop
// here.
}

#[test]
fn test_deposit_and_credit_by_backend_or_manual() {
    // Arrange
    let owner: ContractAddress = 51.try_into().unwrap();
    let backend_admin: ContractAddress = 52.try_into().unwrap();
    let manual_admin: ContractAddress = 53.try_into().unwrap();
    let user: ContractAddress = 54.try_into().unwrap();
    let zero: ContractAddress = 0.try_into().unwrap();
    let erc: IMockERC20Dispatcher = deploy_erc20('USDC', 'USDC', 6_u8, 1_000_000_000_u256, zero);
    let (sendpay_disp, admin_disp, _admin_main_disp) = deploy_sendpay(
        owner, erc.contract_address, backend_admin, manual_admin,
    );

    // Whitelist token as manual admin
    start_cheat_caller_address(sendpay_disp.contract_address, manual_admin);
    admin_disp.add_allowed_token(erc.contract_address);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Fund contract with USDC so it can credit users
    start_cheat_caller_address(erc.contract_address, zero);
    let ok1 = erc.transfer(sendpay_disp.contract_address, 700_000_u256);
    assert(ok1, 'prefund failed');
    stop_cheat_caller_address(erc.contract_address);

    // Backend credits user
    start_cheat_caller_address(sendpay_disp.contract_address, backend_admin);
    admin_disp.deposit_and_credit(user, 200_000_u256, 900);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Manual admin credits user
    start_cheat_caller_address(sendpay_disp.contract_address, manual_admin);
    admin_disp.deposit_and_credit(user, 100_000_u256, 901);
    stop_cheat_caller_address(sendpay_disp.contract_address);
}

#[test]
#[should_panic]
fn test_deposit_and_credit_rejects_unauthorized() {
    let owner: ContractAddress = 61.try_into().unwrap();
    let backend_admin: ContractAddress = 62.try_into().unwrap();
    let manual_admin: ContractAddress = 63.try_into().unwrap();
    let user: ContractAddress = 64.try_into().unwrap();
    let zero: ContractAddress = 0.try_into().unwrap();
    let erc: IMockERC20Dispatcher = deploy_erc20('USDC', 'USDC', 6_u8, 0_u256, zero);
    let (sendpay_disp, admin_disp, _admin_main_disp) = deploy_sendpay(
        owner, erc.contract_address, backend_admin, manual_admin,
    );

    // Unauthorized caller
    start_cheat_caller_address(sendpay_disp.contract_address, user);
    admin_disp.deposit_and_credit(user, 1_u256, 902); // should panic Not authorized
    stop_cheat_caller_address(sendpay_disp.contract_address);
}

#[test]
#[should_panic]
fn test_batch_withdraw_with_signatures_empty_batch_panics() {
    // Arrange
    let owner: ContractAddress = 71.try_into().unwrap();
    let backend_admin: ContractAddress = 72.try_into().unwrap();
    let manual_admin: ContractAddress = 73.try_into().unwrap();
    let zero: ContractAddress = 0.try_into().unwrap();
    let erc: IMockERC20Dispatcher = deploy_erc20('USDC', 'USDC', 6_u8, 0_u256, zero);
    let (sendpay_disp, _admin_disp, _admin_main_disp) = deploy_sendpay(
        owner, erc.contract_address, backend_admin, manual_admin,
    );

    // Call with empty arrays
    let reqs = array![];
    let rs = array![];
    let ss = array![];
    sendpay_disp.batch_withdraw_with_signatures(reqs, rs, ss); // should panic "Empty batch"
}

#[test]
fn test_complete_onramp_flow() {
    // Complete onramp flow: User deposits fiat -> Backend credits user on-chain
    
    // Arrange
    let owner: ContractAddress = 81.try_into().unwrap();
    let backend_admin: ContractAddress = 82.try_into().unwrap();
    let manual_admin: ContractAddress = 83.try_into().unwrap();
    let user: ContractAddress = 84.try_into().unwrap();
    let zero: ContractAddress = 0.try_into().unwrap();
    
    // Deploy contracts
    let erc: IMockERC20Dispatcher = deploy_erc20('USDC', 'USDC', 6_u8, 10_000_000_u256, zero);
    let (sendpay_disp, admin_disp, _admin_main_disp) = deploy_sendpay(
        owner, erc.contract_address, backend_admin, manual_admin,
    );

    // Step 1: Whitelist token (manual admin setup)
    start_cheat_caller_address(sendpay_disp.contract_address, manual_admin);
    admin_disp.add_allowed_token(erc.contract_address);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Step 2: Fund contract with USDC (simulating off-chain fiat deposits)
    start_cheat_caller_address(erc.contract_address, zero);
    let fund_success = erc.transfer(sendpay_disp.contract_address, 5_000_000_u256);
    assert(fund_success, 'Contract funding failed');
    stop_cheat_caller_address(erc.contract_address);

    // Step 3: Backend credits user after fiat deposit (onramp completion)
    start_cheat_caller_address(sendpay_disp.contract_address, backend_admin);
    let _fiat_tx_ref = 12345; // Simulated fiat transaction reference
    admin_disp.deposit_and_credit(user, 1_000_000_u256, _fiat_tx_ref);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Step 4: Verify user received USDC tokens
    let user_balance = erc.balance_of(user);
    assert(user_balance == 1_000_000_u256, 'User balance wrong');

    // Step 5: Verify contract balance decreased
    let contract_balance = erc.balance_of(sendpay_disp.contract_address);
    assert(contract_balance == 4_000_000_u256, 'Contract balance wrong');

    // Step 6: Verify deposit record exists (if getter available)
    // Note: This would require a getter function in the contract
}

#[test]
fn test_complete_offramp_flow() {
    // Complete offramp flow: User withdraws -> Backend processes -> Admin completes
    
    // Arrange
    let owner: ContractAddress = 91.try_into().unwrap();
    let backend_admin: ContractAddress = 92.try_into().unwrap();
    let manual_admin: ContractAddress = 93.try_into().unwrap();
    let user: ContractAddress = 94.try_into().unwrap();
    let zero: ContractAddress = 0.try_into().unwrap();
    
    // Deploy contracts
    let erc: IMockERC20Dispatcher = deploy_erc20('USDC', 'USDC', 6_u8, 10_000_000_u256, zero);
    let (sendpay_disp, admin_disp, admin_main_disp) = deploy_sendpay(
        owner, erc.contract_address, backend_admin, manual_admin,
    );

    // Step 1: Setup - Whitelist token and fund user
    start_cheat_caller_address(sendpay_disp.contract_address, manual_admin);
    admin_disp.add_allowed_token(erc.contract_address);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Fund user with USDC
    start_cheat_caller_address(erc.contract_address, zero);
    let fund_success = erc.transfer(user, 2_000_000_u256);
    assert(fund_success, 'User funding failed');
    stop_cheat_caller_address(erc.contract_address);

    // Step 2: User approves contract to spend their USDC
    start_cheat_caller_address(erc.contract_address, user);
    let approve_success = erc.approve(sendpay_disp.contract_address, 2_000_000_u256);
    assert(approve_success, 'User approval failed');
    stop_cheat_caller_address(erc.contract_address);

    // Step 3: User initiates withdrawal (simulating offramp request)
    let withdrawal_amount = 500_000_u256;
    let bank_tx_ref = 67890; // Simulated bank transaction reference
    
    start_cheat_caller_address(sendpay_disp.contract_address, user);
    let req = WithdrawalRequest {
        user,
        amount: withdrawal_amount,
        token: erc.contract_address,
        tx_ref: bank_tx_ref,
        nonce: sendpay_disp.get_user_nonce(user),
        timestamp: 1000_u64,
    };
    
    // For now, we'll test the hash generation (since signature verification needs proper ECDSA)
    let withdrawal_hash = poseidon_withdraw_hash(req);
    
    // Actually create the withdrawal on-chain (simulate signature with dummy values)
    let dummy_r: felt252 = 111;
    let dummy_s: felt252 = 222;
    sendpay_disp.withdraw_with_signature(req, dummy_r, dummy_s);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Step 4: Verify withdrawal hash is generated correctly
    assert(withdrawal_hash != 0, 'Hash should not be zero');

    // Step 5: Simulate backend processing (manually complete withdrawal)
    // In real flow: Backend processes fiat payout, then calls complete_withdrawal_with_proof
    start_cheat_caller_address(sendpay_disp.contract_address, backend_admin);
    
    // Create settlement proof (simulated)
    println!("DEBUG: withdrawal_amount = {}", withdrawal_amount);
    println!("DEBUG: req.amount = {}", req.amount);
    let settlement_proof = SettlementProof {
        fiat_tx_hash: 99999, // Simulated fiat transaction hash
        settled_amount: withdrawal_amount,
        timestamp: 1001_u64,
        backend_signature: 77777, // Simulated backend signature
    };
    println!("DEBUG: settlement_proof.settled_amount = {}", settlement_proof.settled_amount);
    
    // Complete the withdrawal
    admin_main_disp.complete_withdrawal_with_proof(withdrawal_hash.try_into().unwrap(), settlement_proof);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Step 6: Verify user's USDC was transferred to contract
    let user_balance_after = erc.balance_of(user);
    assert(user_balance_after == 1_500_000_u256, 'User balance wrong');

    let contract_balance_after = erc.balance_of(sendpay_disp.contract_address);
    assert(contract_balance_after == 500_000_u256, 'Contract balance wrong');

    // Step 7: Verify withdrawal status is completed
    let withdrawal_status = sendpay_disp.get_withdrawal_status(withdrawal_hash.try_into().unwrap());
    assert(withdrawal_status.status == STATUS_COMPLETED, 'Status should be completed');
}

#[test]
fn test_complete_offramp_and_onramp_cycle() {
    // Complete cycle: User deposits fiat (onramp) -> User withdraws (offramp)
    
    // Arrange
    let owner: ContractAddress = 101.try_into().unwrap();
    let backend_admin: ContractAddress = 102.try_into().unwrap();
    let manual_admin: ContractAddress = 103.try_into().unwrap();
    let user: ContractAddress = 104.try_into().unwrap();
    let zero: ContractAddress = 0.try_into().unwrap();
    
    // Deploy contracts
    let erc: IMockERC20Dispatcher = deploy_erc20('USDC', 'USDC', 6_u8, 20_000_000_u256, zero);
    let (sendpay_disp, admin_disp, _admin_main_disp) = deploy_sendpay(
        owner, erc.contract_address, backend_admin, manual_admin,
    );

    // Setup
    start_cheat_caller_address(sendpay_disp.contract_address, manual_admin);
    admin_disp.add_allowed_token(erc.contract_address);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Fund contract
    start_cheat_caller_address(erc.contract_address, zero);
    let fund_success = erc.transfer(sendpay_disp.contract_address, 10_000_000_u256);
    assert(fund_success, 'Contract funding failed');
    stop_cheat_caller_address(erc.contract_address);

    // PHASE 1: ONRAMP - User deposits $1000 fiat, gets 1,000,000 USDC (6 decimals)
    start_cheat_caller_address(sendpay_disp.contract_address, backend_admin);
    let onramp_amount = 1_000_000_u256; // $1000 in USDC (6 decimals)
    let _fiat_tx_ref_onramp = 11111;
    admin_disp.deposit_and_credit(user, onramp_amount, _fiat_tx_ref_onramp);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Verify onramp success
    let user_balance_after_onramp = erc.balance_of(user);
    assert(user_balance_after_onramp == onramp_amount, 'Onramp balance wrong');

    // PHASE 2: OFFRAMP - User withdraws $500, gets fiat
    let offramp_amount = 500_000_u256; // $500 in USDC
    
    // User approves contract
    start_cheat_caller_address(erc.contract_address, user);
    let approve_success = erc.approve(sendpay_disp.contract_address, offramp_amount);
    assert(approve_success, 'User approval failed');
    stop_cheat_caller_address(erc.contract_address);

    // User initiates withdrawal
    start_cheat_caller_address(sendpay_disp.contract_address, user);
    let req = WithdrawalRequest {
        user,
        amount: offramp_amount,
        token: erc.contract_address,
        tx_ref: 22222,
        nonce: sendpay_disp.get_user_nonce(user),
        timestamp: 2000_u64,
    };
    let withdrawal_hash = poseidon_withdraw_hash(req);
    
    // Actually create the withdrawal on-chain (simulate signature with dummy values)
    let dummy_r: felt252 = 123;
    let dummy_s: felt252 = 456;
    sendpay_disp.withdraw_with_signature(req, dummy_r, dummy_s);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // Backend processes and completes withdrawal
    start_cheat_caller_address(sendpay_disp.contract_address, backend_admin);
    println!("DEBUG CYCLE: offramp_amount = {}", offramp_amount);
    println!("DEBUG CYCLE: req.amount = {}", req.amount);
    let settlement_proof = SettlementProof {
        fiat_tx_hash: 33333,
        settled_amount: offramp_amount,
        timestamp: 2001_u64,
        backend_signature: 88888,
    };
    println!("DEBUG CYCLE: settlement_proof.settled_amount = {}", settlement_proof.settled_amount);
    _admin_main_disp.complete_withdrawal_with_proof(withdrawal_hash.try_into().unwrap(), settlement_proof);
    stop_cheat_caller_address(sendpay_disp.contract_address);

    // PHASE 3: VERIFY COMPLETE CYCLE
    let final_user_balance = erc.balance_of(user);
    let expected_final_balance = onramp_amount - offramp_amount; // 500,000 USDC remaining
    assert(final_user_balance == expected_final_balance, 'Final balance wrong');

    let final_contract_balance = erc.balance_of(sendpay_disp.contract_address);
    let expected_contract_balance = 10_000_000_u256 - onramp_amount + offramp_amount; // 9,500,000 USDC
    assert(final_contract_balance == expected_contract_balance, 'Contract balance wrong');

    // Verify withdrawal status
    let withdrawal_status = sendpay_disp.get_withdrawal_status(withdrawal_hash.try_into().unwrap());
    assert(withdrawal_status.status == sendpay::STATUS_COMPLETED, 'Should be completed');
}

