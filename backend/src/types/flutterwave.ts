// Flutterwave Transfer Interfaces

export interface IFlutterwaveTransferRequest {
  account_bank: string;
  account_number: string;
  amount: number;
  narration: string;
  currency: string;
  reference: string;
  beneficiary_name?: string;
  callback_url?: string;
  debit_currency?: string;
  source_currency?: string; // New field for source currency
  meta?: any;
}

export interface IFlutterwaveTransferResponse {
  status: string;
  message: string;
  data: {
    id: number;
    account_number: string;
    bank_code: string;
    full_name: string;
    created_at: string;
    currency: string;
    debit_currency: string;
    amount: number;
    fee: number;
    status: string;
    reference: string;
    meta: any;
    narration: string;
    approver: string;
    complete_message: string;
    requires_approval: number;
    is_approved: number;
    bank_name: string;
  };
}

export interface IFlutterwaveBulkTransferRequest {
  title: string;
  bulk_data: IFlutterwaveTransferRecipient[];
}

export interface IFlutterwaveTransferRecipient {
  bank_code: string;
  account_number: string;
  amount: number;
  currency: string;
  narration: string;
  reference: string;
  beneficiary_name?: string;
  meta?: any;
}

export interface IFlutterwaveBulkTransferResponse {
  status: string;
  message: string;
  data: {
    id: number;
    title: string;
    status: string;
    created_at: string;
    approver: string;
    total_amount: number;
    total_fee: number;
    currency: string;
    meta: any;
    transfers: IFlutterwaveTransferResponse[];
  };
}

export interface IFlutterwaveTransferStatusResponse {
  status: string;
  message: string;
  data: {
    id: number;
    account_number: string;
    bank_code: string;
    full_name: string;
    created_at: string;
    currency: string;
    debit_currency: string;
    amount: number;
    fee: number;
    status: string;
    reference: string;
    meta: any;
    narration: string;
    approver: string;
    complete_message: string;
    requires_approval: number;
    is_approved: number;
    bank_name: string;
  };
}

export interface IFlutterwaveBankListResponse {
  status: string;
  message: string;
  data: Array<{
    id: number;
    code: string;
    name: string;
    country: string;
    currency: string;
    type: string;
    active: boolean;
  }>;
}

export interface IFlutterwaveAccountVerificationResponse {
  status: string;
  message: string;
  data: {
    account_number: string;
    account_name: string;
    bank_id: number;
  };
}

export interface IFlutterwaveTransferFeeResponse {
  status: string;
  message: string;
  data: {
    currency: string;
    fee_type: string;
    fee: number;
    fee_currency: string;
  };
}

export interface IFlutterwaveBalanceResponse {
  status: string;
  message: string;
  data: Array<{
    currency: string;
    available_balance: number;
    ledger_balance: number;
  }>;
}

export interface IFlutterwaveWebhookData {
  id: number;
  tx_ref: string;
  flw_ref: string;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  meta: any;
  amount_settled: number;
  app_fee: number;
  merchant_fee: number;
  merchant_bears_fee: boolean;
  charge_response: string;
  ip: string;
  narration: string;
  auth_model: string;
  created_at: string;
  updated_at: string;
  account_id: number;
  customer: {
    id: number;
    name: string;
    phone_number: string;
    email: string;
    created_at: string;
  };
  account: {
    id: number;
    account_number: string;
    account_name: string;
    bank_code: string;
    bank_name: string;
  };
}

export interface IFlutterwaveWebhookEvent {
  event: string;
  data: IFlutterwaveWebhookData;
}
