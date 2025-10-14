import axios from 'axios';

interface FlutterwaveAuthToken {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
  expiresAt: number;
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
      this.baseUrl = process.env.FLUTTERWAVE_BASE_URL || 'https://f4bexperience.flutterwave.com';
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
   * Generate unique idempotency key
   */
  private generateIdempotencyKey(): string {
    return `sendpay-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate unique trace ID
   */
  private generateTraceId(): string {
    return `sendpay-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
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
          'X-Trace-Id': params.traceId || this.generateTraceId(),
          'X-Idempotency-Key': params.idempotencyKey || this.generateIdempotencyKey(),
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
   * Create a customer for PWBT
   */
  async createCustomer(customerData: {
    firstName: string;
    lastName: string;
    email: string;
  }): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured.');
    }

    console.log('[fw] Creating customer:', {
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      email: customerData.email
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/customers`,
        {
          name: {
            first: customerData.firstName,
            last: customerData.lastName
          },
          email: customerData.email
        },
        {
          headers: {
            ...(await this.getAuthHeader()),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Idempotency-Key': this.generateIdempotencyKey(),
            'X-Trace-Id': this.generateTraceId()
          }
        }
      );

      console.log('[fw] Customer created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[fw] Customer creation error:', error.response?.data || error.message);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  /**
   * Create a dynamic virtual account for PWBT
   */
  async createDynamicVirtualAccount(params: {
    reference: string;
    customerId: string;
    amount: number;
    currency?: string;
    narration?: string;
    expiryMinutes?: number; // Default 60 minutes (1 hour)
  }): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured.');
    }

    const expirySeconds = (params.expiryMinutes || 60) * 60; // Convert minutes to seconds

    console.log('[fw] Creating dynamic virtual account:', {
      reference: params.reference,
      customerId: params.customerId,
      amount: params.amount,
      expiryMinutes: params.expiryMinutes || 60
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/virtual-accounts`,
        {
          reference: params.reference,
          customer_id: params.customerId,
          amount: params.amount,
          currency: params.currency || 'NGN',
          account_type: 'dynamic',
          narration: params.narration || 'SendPay Deposit',
          expiry: expirySeconds
        },
        {
          headers: {
            ...(await this.getAuthHeader()),
            'Content-Type': 'application/json',
            'X-Idempotency-Key': this.generateIdempotencyKey(),
            'X-Trace-Id': this.generateTraceId()
          }
        }
      );

      console.log('[fw] Dynamic virtual account created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[fw] Virtual account creation error:', error.response?.data || error.message);
      throw new Error(`Failed to create virtual account: ${error.message}`);
    }
  }

  /**
   * Verify a charge/transaction by ID
   */
  async verifyCharge(chargeId: string): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured.');
    }

    console.log('[fw] Verifying charge:', { chargeId });

    try {
      const response = await axios.get(
        `${this.baseUrl}/charges/${chargeId}`,
        {
          headers: {
            ...(await this.getAuthHeader()),
            'Accept': 'application/json',
            'X-Trace-Id': this.generateTraceId()
          }
        }
      );

      console.log('[fw] Charge verification response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[fw] Charge verification error:', error.response?.data || error.message);
      throw new Error(`Failed to verify charge: ${error.message}`);
    }
  }

  /**
   * Get charges for a virtual account
   */
  async getChargesForVirtualAccount(virtualAccountId: string, page?: number): Promise<any> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Flutterwave credentials not configured.');
    }

    console.log('[fw] Getting charges for virtual account:', { virtualAccountId, page });

    try {
      const response = await axios.get(
        `${this.baseUrl}/charges`,
        {
          headers: {
            ...(await this.getAuthHeader()),
            'Accept': 'application/json',
            'X-Trace-Id': this.generateTraceId()
          },
          params: {
            virtual_account_id: virtualAccountId,
            page: page || 1
          }
        }
      );

      console.log('[fw] Virtual account charges response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[fw] Virtual account charges error:', error.response?.data || error.message);
      throw new Error(`Failed to get virtual account charges: ${error.message}`);
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
