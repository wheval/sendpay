import axios from 'axios';

interface FlutterwaveAuthToken {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  expiresAt: number;
}

interface FlutterwavePayoutRequest {
  account_bank: string;
  account_number: string;
  amount: number;
  narration: string;
  currency: string;
  reference: string;
  beneficiary_name: string;
}

interface FlutterwavePayoutResponse {
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

export class FlutterwaveService {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string = '';
  private isTestMode: boolean;
  private currentToken: FlutterwaveAuthToken | null = null;
  private tokenEndpoint = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';

  constructor() {
    this.clientId = process.env.FLUTTERWAVE_CLIENT_ID || '';
    this.clientSecret = process.env.FLUTTERWAVE_CLIENT_SECRET || '';
    this.isTestMode = process.env.NODE_ENV !== 'production';
    
    if (this.isTestMode) {
      this.baseUrl = process.env.FLUTTERWAVE_BASE_URL || 'https://developersandbox-api.flutterwave.com';
    } else {
      this.baseUrl = process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.cloud/f4bexperience';
    }

    if (!this.clientId || !this.clientSecret) {
      console.error('❌ FLUTTERWAVE_CLIENT_ID or FLUTTERWAVE_CLIENT_SECRET not configured. Flutterwave services will not work.');
    } else {
      console.log('[fw] Flutterwave service initialized:', {
        hasClientId: !!this.clientId,
        hasClientSecret: !!this.clientSecret,
        isTestMode: this.isTestMode,
        baseUrl: this.baseUrl
      });
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      // If we have a valid token, return it
      if (this.currentToken && Date.now() < this.currentToken.expiresAt) {
        return this.currentToken?.access_token || null;
      }

      // Otherwise, get a new token
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);

      console.log('[fw] Requesting new access token...');
      
      const response = await axios.post(this.tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      // Store the token with its expiration time
      this.currentToken = {
        ...response.data,
        expiresAt: Date.now() + (response.data.expires_in * 1000)
      };

      console.log('[fw] New access token obtained, expires in:', response.data.expires_in, 'seconds');
      
      return this.currentToken?.access_token || null;
    } catch (error: any) {
      console.error('[fw] Failed to get access token:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get authorization header with access token
   */
  private async getAuthHeader(): Promise<{ Authorization: string }> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Failed to get Flutterwave access token');
    }
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Initiate a bank transfer payout
   */
  async initiatePayout(payoutData: {
    bankCode: string;
    accountNumber: string;
    amount: number;
    beneficiaryName: string;
    narration: string;
    reference: string;
  }): Promise<FlutterwavePayoutResponse> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured. Please set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET environment variables.');
    }

    console.log('[fw] Initiating payout:', {
      bankCode: payoutData.bankCode,
      accountNumber: payoutData.accountNumber,
      amount: payoutData.amount,
      beneficiaryName: payoutData.beneficiaryName,
      reference: payoutData.reference
    });

    const payload: FlutterwavePayoutRequest = {
      account_bank: payoutData.bankCode,
      account_number: payoutData.accountNumber,
      amount: payoutData.amount,
      narration: payoutData.narration,
      currency: 'NGN',
      reference: payoutData.reference,
      beneficiary_name: payoutData.beneficiaryName
    };

    const response = await axios.post(
      `${this.baseUrl}/transfers`,
      payload,
      {
        headers: {
          ...(await this.getAuthHeader()),
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('[fw] Payout response:', response.data);
    return response.data;
  }

  /**
   * Direct Transfers API (new): create bank payout with NGN source
   */
  async createDirectTransfer(params: {
    bankCode: string;
    accountNumber: string;
    amountNGN: number; // value applies to destination_currency
    reference: string;
    narration: string;
    callback_url?: string;
    sender?: { name?: string; phone?: string; email?: string };
    traceId?: string;
    idempotencyKey?: string;
  }): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured. Please set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET');
    }

    const payload: any = {
      action: 'instant',
      type: 'bank',
      callback_url: params.callback_url,
      narration: params.narration,
      reference: params.reference,
      payment_instruction: {
        amount: {
          value: params.amountNGN,
          applies_to: 'destination_currency',
        },
        source_currency: 'NGN',
        destination_currency: 'NGN',
        recipient: {
          bank: {
            code: params.bankCode,
            account_number: params.accountNumber,
          },
        },
      },
    };
    if (params.sender) {
      payload.sender = { name: params.sender.name, phone: params.sender.phone, email: params.sender.email };
    }

    const response = await axios.post(
      `${this.baseUrl}/direct-transfers`,
      payload,
      {
        headers: {
          ...(await this.getAuthHeader()),
          'Content-Type': 'application/json',
          ...(params.traceId ? { 'X-Trace-Id': params.traceId } : {}),
          ...(params.idempotencyKey ? { 'X-Idempotency-Key': params.idempotencyKey } : {}),
        },
      },
    );
    return response.data;
  }

  async getDirectTransfer(transferId: string): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured. Please set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET');
    }
    const response = await axios.get(
      `${this.baseUrl}/transfers/${transferId}`,
      { headers: await this.getAuthHeader() },
    );
    return response.data;
  }

  /**
   * Verify payout status
   */
  async verifyPayout(transferId: number): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured. Please set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET environment variables.');
    }

    console.log('[fw] Verifying payout status for transfer ID:', transferId);

    const response = await axios.get(
      `${this.baseUrl}/transfers/${transferId}`,
      {
        headers: await this.getAuthHeader()
      }
    );

    console.log('[fw] Payout verification response:', response.data);
    return response.data;
  }

  /**
   * Get bank list for Nigeria
   */
  async getBankList(): Promise<any[]> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured. Please set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET environment variables.');
    }

    console.log('[fw] Fetching bank list for Nigeria...');

    const response = await axios.get(
      `${this.baseUrl}/banks`,
      {
        headers: await this.getAuthHeader(),
        params: {
          country: 'NG'
        }
      }
    );

    console.log('[fw] Bank list response:', { count: response.data.data?.length || 0 });
    return response.data.data || [];
  }

  /**
   * Verify bank account number using Flutterwave Bank Account Look Up API
   */
  async verifyBankAccount(bankCode: string, accountNumber: string): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured. Please set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET environment variables.');
    }

    console.log('[fw] Verifying bank account:', { bankCode, accountNumber });

    try {
      const response = await axios.post(
        `${this.baseUrl}/banks/account-resolve`,
        {
          currency: 'NGN',
          account: {
            code: bankCode,
            number: accountNumber
          }
        },
        {
          headers: {
            ...(await this.getAuthHeader()),
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('[fw] Bank account verification response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[fw] Bank account verification error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      throw error;
    }
  }

  /**
   * V4: Create order for bank transfer payment (on-ramp)
   */
  async createOrder(orderData: {
    amount: number;
    currency: string;
    customer: { email: string; name: string; phone?: string };
    tx_ref: string;
    redirect_url: string;
    description?: string;
  }): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured.');
    }

    console.log('[fw] Creating order for bank transfer:', {
      amount: orderData.amount,
      tx_ref: orderData.tx_ref
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/orders`,
        {
          amount: orderData.amount,
          currency: orderData.currency,
          customer: orderData.customer,
          tx_ref: orderData.tx_ref,
          redirect_url: orderData.redirect_url,
          description: orderData.description || 'SendPay On-Ramp Deposit',
          meta: { source: 'sendpay-onramp', payment_type: 'account' } // Specify bank transfer
        },
        {
          headers: {
            ...(await this.getAuthHeader()),
            'Content-Type': 'application/json',
            'X-Trace-Id': `sendpay-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
          }
        }
      );

      console.log('[fw] Order created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[fw] Order creation error:', error.response?.data || error.message);
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  /**
   * V4: Process bank transfer payment
   */
  async processBankTransferPayment(orderId: string): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured.');
    }

    console.log('[fw] Processing bank transfer for order:', { orderId });

    try {
      const response = await axios.post(
        `${this.baseUrl}/payments/account`,
        {
          order_id: orderId
        },
        {
          headers: {
            ...(await this.getAuthHeader()),
            'Content-Type': 'application/json',
            'X-Trace-Id': `sendpay-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
          }
        }
      );

      console.log('[fw] Bank transfer payment response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[fw] Bank transfer payment error:', error.response?.data || error.message);
      throw new Error(`Failed to process bank transfer: ${error.message}`);
    }
  }

  /**
   * V4: Check payment status
   */
  async getPaymentStatus(transactionId: string): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured.');
    }

    console.log('[fw] Checking payment status:', { transactionId });

    try {
      const response = await axios.get(
        `${this.baseUrl}/payments/${transactionId}`,
        {
          headers: {
            ...(await this.getAuthHeader()),
            'Content-Type': 'application/json',
            'X-Trace-Id': `sendpay-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
          }
        }
      );

      console.log('[fw] Payment status response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[fw] Payment status error:', error.response?.data || error.message);
      throw new Error(`Failed to check payment status: ${error.message}`);
    }
  }

  /**
   * List available payment methods (optional for validation)
   */
  async listPaymentMethods(params: { page?: number; size?: number } = {}): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured.');
    }

    console.log('[fw] Fetching payment methods:', { page: params.page || 1, size: params.size || 10 });

    try {
      const response = await axios.get(
        `${this.baseUrl}/payment-methods`,
        {
          headers: {
            ...(await this.getAuthHeader()),
            'Content-Type': 'application/json',
            'X-Trace-Id': `sendpay-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
          },
          params: {
            page: params.page || 1,
            size: params.size || 10
          }
        }
      );

      console.log('[fw] Payment methods response:', { count: response.data.data?.length || 0 });
      return response.data;
    } catch (error: any) {
      console.error('[fw] Payment methods fetch error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch payment methods: ${error.message}`);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isConfigured: !!(this.clientId && this.clientSecret),
      isTestMode: this.isTestMode,
      baseUrl: this.baseUrl,
      hasCredentials: {
        clientId: !!this.clientId,
        clientSecret: !!this.clientSecret
      }
    };
  }
}

export const flutterwaveService = new FlutterwaveService();
