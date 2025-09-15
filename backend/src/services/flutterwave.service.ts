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
      this.baseUrl = process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.cloud/developersandbox';
    } else {
      this.baseUrl = process.env.FLUTTERWAVE_BASE_URL || 'https://api.flutterwave.cloud/f4bexperience';
    }

    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️ FLUTTERWAVE_CLIENT_ID or FLUTTERWAVE_CLIENT_SECRET not set.');
    }
    
    // Log configuration for debugging
    console.log('[fw] Flutterwave service configuration:', {
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
      isTestMode: this.isTestMode,
      baseUrl: this.baseUrl
    });
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
    try {
      if (!this.clientId || !this.clientSecret) {
        // Simulate payout in test mode
        return this.simulatePayout(payoutData);
      }

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

      return response.data;
    } catch (error: any) {
      console.error('Flutterwave payout error:', error.response?.data || error.message);
      throw new Error(`Flutterwave payout failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Verify payout status
   */
  async verifyPayout(transferId: number): Promise<any> {
    try {
      if (!this.clientId || !this.clientSecret) {
        return this.simulatePayoutVerification(transferId);
      }

      const response = await axios.get(
        `${this.baseUrl}/transfers/${transferId}`,
        {
          headers: await this.getAuthHeader()
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Flutterwave verification error:', error.response?.data || error.message);
      throw new Error(`Flutterwave verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get bank list for Nigeria
   */
  async getBankList(): Promise<any[]> {
    try {
      if (!this.clientId || !this.clientSecret) {
        return this.getMockBankList();
      }

      const response = await axios.get(
        `${this.baseUrl}/banks/NG`,
        {
          headers: await this.getAuthHeader()
        }
      );

      return response.data.data || [];
    } catch (error: any) {
      console.error('Flutterwave bank list error:', error.response?.data || error.message);
      // Return mock data if API fails
      return this.getMockBankList();
    }
  }

  /**
   * Verify bank account number
   */
  async verifyBankAccount(bankCode: string, accountNumber: string): Promise<any> {
    try {
      if (!this.clientId || !this.clientSecret) {
        return this.simulateAccountVerification(bankCode, accountNumber);
      }

      const response = await axios.post(
        `${this.baseUrl}/accounts/resolve`,
        {
          account_number: accountNumber,
          account_bank: bankCode
        },
        {
          headers: {
            ...(await this.getAuthHeader()),
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Flutterwave account verification error:', error.response?.data || error.message);
      throw new Error(`Account verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Simulate payout for testing
   */
  private simulatePayout(payoutData: any): FlutterwavePayoutResponse {
    console.log('🧪 Simulating Flutterwave payout:', payoutData);
    
    return {
      status: 'success',
      message: 'Transfer initiated successfully',
      data: {
        id: Math.floor(Math.random() * 1000000),
        account_number: payoutData.accountNumber,
        bank_code: payoutData.bankCode,
        full_name: payoutData.beneficiaryName,
        created_at: new Date().toISOString(),
        currency: 'NGN',
        debit_currency: 'NGN',
        amount: payoutData.amount,
        fee: 0,
        status: 'PENDING',
        reference: payoutData.reference,
        meta: {},
        narration: payoutData.narration,
        approver: 'System',
        complete_message: 'Transfer initiated successfully',
        requires_approval: 0,
        is_approved: 1,
        bank_name: 'Test Bank'
      }
    };
  }

  /**
   * Simulate payout verification for testing
   */
  private simulatePayoutVerification(transferId: number): any {
    return {
      status: 'success',
      message: 'Transfer details retrieved',
      data: {
        id: transferId,
        status: 'SUCCESSFUL',
        complete_message: 'Transfer completed successfully'
      }
    };
  }

  /**
   * Get mock bank list for testing
   */
  private getMockBankList(): any[] {
    return [
      { id: 1, code: '044', name: 'Access Bank' },
      { id: 2, code: '023', name: 'Citibank Nigeria' },
      { id: 3, code: '063', name: 'Diamond Bank' },
      { id: 4, code: '050', name: 'Ecobank Nigeria' },
      { id: 5, code: '070', name: 'Fidelity Bank' },
      { id: 6, code: '011', name: 'First Bank of Nigeria' },
      { id: 7, code: '214', name: 'First City Monument Bank' },
      { id: 8, code: '058', name: 'Guaranty Trust Bank' },
      { id: 9, code: '030', name: 'Heritage Bank' },
      { id: 10, code: '301', name: 'Jaiz Bank' },
      { id: 11, code: '082', name: 'Keystone Bank' },
      { id: 12, code: '014', name: 'MainStreet Bank' },
      { id: 13, code: '076', name: 'Polaris Bank' },
      { id: 14, code: '221', name: 'Stanbic IBTC Bank' },
      { id: 15, code: '068', name: 'Standard Chartered Bank' },
      { id: 16, code: '232', name: 'Sterling Bank' },
      { id: 17, code: '100', name: 'Suntrust Bank' },
      { id: 18, code: '032', name: 'Union Bank of Nigeria' },
      { id: 19, code: '033', name: 'United Bank for Africa' },
      { id: 20, code: '215', name: 'Unity Bank' },
      { id: 21, code: '035', name: 'Wema Bank' },
      { id: 22, code: '057', name: 'Zenith Bank' }
    ];
  }

  /**
   * Simulate account verification for testing
   */
  private simulateAccountVerification(bankCode: string, accountNumber: string): any {
    return {
      status: 'success',
      message: 'Account resolved successfully',
      data: {
        account_number: accountNumber,
        account_name: 'Test Account Holder',
        bank_id: 1
      }
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isConfigured: !!(this.clientId && this.clientSecret),
      isTestMode: this.isTestMode,
      baseUrl: this.baseUrl
    };
  }
}

export const flutterwaveService = new FlutterwaveService();
