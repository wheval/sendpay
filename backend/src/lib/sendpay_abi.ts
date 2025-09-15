export const SENDPAY_ABI = [
    {
      "type": "impl",
      "name": "SendPayImpl",
      "interface_name": "sendpay::ISendPay"
    },
    {
      "type": "struct",
      "name": "core::integer::u256",
      "members": [
        {
          "name": "low",
          "type": "core::integer::u128"
        },
        {
          "name": "high",
          "type": "core::integer::u128"
        }
      ]
    },
    {
      "type": "struct",
      "name": "sendpay::WithdrawalData",
      "members": [
        {
          "name": "amount",
          "type": "core::integer::u256"
        },
        {
          "name": "token_address",
          "type": "core::starknet::contract_address::ContractAddress"
        },
        {
          "name": "bank_account",
          "type": "core::felt252"
        },
        {
          "name": "bank_name",
          "type": "core::felt252"
        },
        {
          "name": "account_name",
          "type": "core::felt252"
        },
        {
          "name": "recipient",
          "type": "core::starknet::contract_address::ContractAddress"
        }
      ]
    },
    {
      "type": "struct",
      "name": "sendpay::WithdrawalStatus",
      "members": [
        {
          "name": "withdrawal_id",
          "type": "core::integer::u256"
        },
        {
          "name": "user",
          "type": "core::starknet::contract_address::ContractAddress"
        },
        {
          "name": "amount",
          "type": "core::integer::u256"
        },
        {
          "name": "token_address",
          "type": "core::starknet::contract_address::ContractAddress"
        },
        {
          "name": "bank_account",
          "type": "core::felt252"
        },
        {
          "name": "bank_name",
          "type": "core::felt252"
        },
        {
          "name": "account_name",
          "type": "core::felt252"
        },
        {
          "name": "timestamp",
          "type": "core::integer::u64"
        },
        {
          "name": "status",
          "type": "core::felt252"
        },
        {
          "name": "block_number",
          "type": "core::integer::u64"
        }
      ]
    },
    {
      "type": "enum",
      "name": "core::bool",
      "variants": [
        {
          "name": "False",
          "type": "()"
        },
        {
          "name": "True",
          "type": "()"
        }
      ]
    },
    {
      "type": "interface",
      "name": "sendpay::ISendPay",
      "items": [
        {
          "type": "function",
          "name": "withdraw_and_process",
          "inputs": [
            {
              "name": "amount",
              "type": "core::integer::u256"
            },
            {
              "name": "token_address",
              "type": "core::starknet::contract_address::ContractAddress"
            },
            {
              "name": "bank_account",
              "type": "core::felt252"
            },
            {
              "name": "bank_name",
              "type": "core::felt252"
            },
            {
              "name": "account_name",
              "type": "core::felt252"
            },
            {
              "name": "recipient",
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "batch_withdraw_and_process",
          "inputs": [
            {
              "name": "withdrawals",
              "type": "core::array::Array::<sendpay::WithdrawalData>"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "get_withdrawal_status",
          "inputs": [
            {
              "name": "withdrawal_id",
              "type": "core::integer::u256"
            }
          ],
          "outputs": [
            {
              "type": "sendpay::WithdrawalStatus"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "get_user_withdrawals",
          "inputs": [
            {
              "name": "user",
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "outputs": [
            {
              "type": "core::array::Array::<sendpay::WithdrawalStatus>"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "check_token_approval",
          "inputs": [
            {
              "name": "user",
              "type": "core::starknet::contract_address::ContractAddress"
            },
            {
              "name": "token_address",
              "type": "core::starknet::contract_address::ContractAddress"
            },
            {
              "name": "amount",
              "type": "core::integer::u256"
            }
          ],
          "outputs": [
            {
              "type": "core::bool"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "emergency_pause",
          "inputs": [
            {
              "name": "reason",
              "type": "core::felt252"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "emergency_resume",
          "inputs": [],
          "outputs": [],
          "state_mutability": "external"
        }
      ]
    },
    {
      "type": "impl",
      "name": "AdminImpl",
      "interface_name": "sendpay::IAdmin"
    },
    {
      "type": "interface",
      "name": "sendpay::IAdmin",
      "items": [
        {
          "type": "function",
          "name": "complete_withdrawal",
          "inputs": [
            {
              "name": "withdrawal_id",
              "type": "core::integer::u256"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "update_config",
          "inputs": [
            {
              "name": "min_withdrawal",
              "type": "core::integer::u256"
            },
            {
              "name": "max_withdrawal",
              "type": "core::integer::u256"
            },
            {
              "name": "processing_fee",
              "type": "core::integer::u256"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "set_usdc_token",
          "inputs": [
            {
              "name": "token_address",
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "set_admin_address",
          "inputs": [
            {
              "name": "admin",
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        }
      ]
    },
    {
      "type": "impl",
      "name": "PausableImpl",
      "interface_name": "openzeppelin_security::interface::IPausable"
    },
    {
      "type": "interface",
      "name": "openzeppelin_security::interface::IPausable",
      "items": [
        {
          "type": "function",
          "name": "is_paused",
          "inputs": [],
          "outputs": [
            {
              "type": "core::bool"
            }
          ],
          "state_mutability": "view"
        }
      ]
    },
    {
      "type": "impl",
      "name": "OwnableMixinImpl",
      "interface_name": "openzeppelin_access::ownable::interface::OwnableABI"
    },
    {
      "type": "interface",
      "name": "openzeppelin_access::ownable::interface::OwnableABI",
      "items": [
        {
          "type": "function",
          "name": "owner",
          "inputs": [],
          "outputs": [
            {
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "state_mutability": "view"
        },
        {
          "type": "function",
          "name": "transfer_ownership",
          "inputs": [
            {
              "name": "new_owner",
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "renounce_ownership",
          "inputs": [],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "transferOwnership",
          "inputs": [
            {
              "name": "newOwner",
              "type": "core::starknet::contract_address::ContractAddress"
            }
          ],
          "outputs": [],
          "state_mutability": "external"
        },
        {
          "type": "function",
          "name": "renounceOwnership",
          "inputs": [],
          "outputs": [],
          "state_mutability": "external"
        }
      ]
    },
    {
      "type": "constructor",
      "name": "constructor",
      "inputs": [
        {
          "name": "owner",
          "type": "core::starknet::contract_address::ContractAddress"
        },
        {
          "name": "usdc_token",
          "type": "core::starknet::contract_address::ContractAddress"
        },
        {
          "name": "admin_address",
          "type": "core::starknet::contract_address::ContractAddress"
        }
      ]
    },
    {
      "type": "event",
      "name": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
      "kind": "struct",
      "members": [
        {
          "name": "previous_owner",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "key"
        },
        {
          "name": "new_owner",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "key"
        }
      ]
    },
    {
      "type": "event",
      "name": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
      "kind": "struct",
      "members": [
        {
          "name": "previous_owner",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "key"
        },
        {
          "name": "new_owner",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "key"
        }
      ]
    },
    {
      "type": "event",
      "name": "openzeppelin_access::ownable::ownable::OwnableComponent::Event",
      "kind": "enum",
      "variants": [
        {
          "name": "OwnershipTransferred",
          "type": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred",
          "kind": "nested"
        },
        {
          "name": "OwnershipTransferStarted",
          "type": "openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted",
          "kind": "nested"
        }
      ]
    },
    {
      "type": "event",
      "name": "openzeppelin_security::pausable::PausableComponent::Paused",
      "kind": "struct",
      "members": [
        {
          "name": "account",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "openzeppelin_security::pausable::PausableComponent::Unpaused",
      "kind": "struct",
      "members": [
        {
          "name": "account",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "openzeppelin_security::pausable::PausableComponent::Event",
      "kind": "enum",
      "variants": [
        {
          "name": "Paused",
          "type": "openzeppelin_security::pausable::PausableComponent::Paused",
          "kind": "nested"
        },
        {
          "name": "Unpaused",
          "type": "openzeppelin_security::pausable::PausableComponent::Unpaused",
          "kind": "nested"
        }
      ]
    },
    {
      "type": "event",
      "name": "sendpay::sendpay::WithdrawalProcessed",
      "kind": "struct",
      "members": [
        {
          "name": "withdrawal_id",
          "type": "core::integer::u256",
          "kind": "data"
        },
        {
          "name": "user",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "data"
        },
        {
          "name": "amount",
          "type": "core::integer::u256",
          "kind": "data"
        },
        {
          "name": "token_address",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "data"
        },
        {
          "name": "bank_account",
          "type": "core::felt252",
          "kind": "data"
        },
        {
          "name": "bank_name",
          "type": "core::felt252",
          "kind": "data"
        },
        {
          "name": "account_name",
          "type": "core::felt252",
          "kind": "data"
        },
        {
          "name": "timestamp",
          "type": "core::integer::u64",
          "kind": "data"
        },
        {
          "name": "block_number",
          "type": "core::integer::u64",
          "kind": "data"
        },
        {
          "name": "status",
          "type": "core::felt252",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "sendpay::sendpay::BatchWithdrawalProcessed",
      "kind": "struct",
      "members": [
        {
          "name": "batch_id",
          "type": "core::integer::u256",
          "kind": "data"
        },
        {
          "name": "total_withdrawals",
          "type": "core::integer::u256",
          "kind": "data"
        },
        {
          "name": "total_amount",
          "type": "core::integer::u256",
          "kind": "data"
        },
        {
          "name": "timestamp",
          "type": "core::integer::u64",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "sendpay::sendpay::TokenApprovalUpdated",
      "kind": "struct",
      "members": [
        {
          "name": "user",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "data"
        },
        {
          "name": "token",
          "type": "core::starknet::contract_address::ContractAddress",
          "kind": "data"
        },
        {
          "name": "amount",
          "type": "core::integer::u256",
          "kind": "data"
        },
        {
          "name": "timestamp",
          "type": "core::integer::u64",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "sendpay::sendpay::EmergencyPaused",
      "kind": "struct",
      "members": [
        {
          "name": "reason",
          "type": "core::felt252",
          "kind": "data"
        },
        {
          "name": "timestamp",
          "type": "core::integer::u64",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "sendpay::sendpay::EmergencyResumed",
      "kind": "struct",
      "members": [
        {
          "name": "timestamp",
          "type": "core::integer::u64",
          "kind": "data"
        }
      ]
    },
    {
      "type": "event",
      "name": "sendpay::sendpay::Event",
      "kind": "enum",
      "variants": [
        {
          "name": "OwnableEvent",
          "type": "openzeppelin_access::ownable::ownable::OwnableComponent::Event",
          "kind": "flat"
        },
        {
          "name": "PausableEvent",
          "type": "openzeppelin_security::pausable::PausableComponent::Event",
          "kind": "flat"
        },
        {
          "name": "WithdrawalProcessed",
          "type": "sendpay::sendpay::WithdrawalProcessed",
          "kind": "nested"
        },
        {
          "name": "BatchWithdrawalProcessed",
          "type": "sendpay::sendpay::BatchWithdrawalProcessed",
          "kind": "nested"
        },
        {
          "name": "TokenApprovalUpdated",
          "type": "sendpay::sendpay::TokenApprovalUpdated",
          "kind": "nested"
        },
        {
          "name": "EmergencyPaused",
          "type": "sendpay::sendpay::EmergencyPaused",
          "kind": "nested"
        },
        {
          "name": "EmergencyResumed",
          "type": "sendpay::sendpay::EmergencyResumed",
          "kind": "nested"
        }
      ]
    }
  ]