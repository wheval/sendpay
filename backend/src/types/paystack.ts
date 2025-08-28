export interface IResolveAccountResponse {
  status: boolean;
  message: string;
  data: {
    account_number: string;
    account_name: string;
    bank_id: number;
  };
}

export interface ICreateRecipientResponse {
  status: boolean;
  message: string;
  data: {
    active: boolean;
    currency: string;
    description: string;
    domain: string;
    email: string | null;
    id: number;
    integration: number;
    metadata: string | null;
    name: string;
    recipient_code: string;
    type: string;
    is_deleted: boolean;
    details: {
      account_number: string;
      account_name: string | null;
      bank_code: string;
      bank_name: string;
    };
    createdAt: string;
    updatedAt: string;
  };
}

export interface IInitiateTransferResponse {
  status: boolean;
  message: string;
  data: {
    integration: number;
    domain: string;
    amount: number;
    currency: string;
    source: string;
    reason: string;
    recipient: number;
    status: string;
    transfer_code: string;
    id: number;
    createdAt: string;
    updatedAt: string;
  };
}
