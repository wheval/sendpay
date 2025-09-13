import { CavosAuth, executeCalls } from 'cavos-service-sdk';
import { apibaraService } from './apibara.service';
import { starknetService } from './starknet.service';

export interface CavosConfig {
  network: 'sepolia' | 'mainnet' | string;
  appId: string;
  orgSecret: string;
}

class CavosService {
  private cavosAuth: CavosAuth | null = null;
  private config: CavosConfig | null = null;
  private initialized = false;

  private initialize() {
    if (this.initialized) return;

    const network = (process.env.CAVOS_NETWORK as CavosConfig['network']) || 'sepolia';
    const appId = process.env.CAVOS_APP_ID || '';
    const orgSecret = process.env.CAVOS_ORG_SECRET || '';
    
    // Validate required environment variables
    if (!appId || !orgSecret) {
      const missingVars = [];
      if (!appId) missingVars.push('CAVOS_APP_ID');
      if (!orgSecret) missingVars.push('CAVOS_ORG_SECRET');
      
      throw new Error(
        `❌ Cavos service initialization failed! Missing required environment variables: ${missingVars.join(', ')}\n` +
        `Please set the following environment variables:\n` +
        `- CAVOS_APP_ID=your_cavos_app_id\n` +
        `- CAVOS_ORG_SECRET=your_cavos_org_secret\n` +
        `- CAVOS_NETWORK=sepolia (optional, defaults to sepolia)`
      );
    }
    
    this.config = { network, appId, orgSecret };
    this.cavosAuth = new CavosAuth(network, appId);
    this.initialized = true;
  }

  getConfig() {
    this.initialize();
    return this.config!;
  }

  async signUp(email: string, password: string) {
    this.initialize();
    const result = await this.cavosAuth!.signUp(email, password, this.config!.orgSecret);
    return result;
  }

  async signIn(email: string, password: string) {
    this.initialize();
    const result = await this.cavosAuth!.signIn(email, password, this.config!.orgSecret);
    return result;
  }

  async refreshToken(refreshToken: string) {
    this.initialize();
    const result = await this.cavosAuth!.refreshToken(refreshToken, this.config!.network);
    return result;
  }

  async getBalance(address: string, tokenAddress: string, decimals = '18') {
    try {
      // Use Apibara service for better balance checking
      const balance = await apibaraService.getTokenBalance(address, tokenAddress);
      const formattedBalance = parseFloat(balance) / Math.pow(10, parseInt(decimals));
      
      return { 
        balance: balance, 
        formatted: formattedBalance.toFixed(parseInt(decimals)) 
      };
    } catch (error) {
      console.error('Apibara balance check failed, falling back to Starknet service:', error);
      
      // Fallback to starknet service if Apibara fails
      const result = await starknetService.getTokenBalance(address, tokenAddress, decimals);
      return { balance: result, formatted: String(result) };
    }
  }

  async execute(address: string, calls: any[], accessToken: string) {
    this.initialize();
    const result = await this.cavosAuth!.executeCalls(address, calls, accessToken);
    return result;
  }
}

export const cavosService = new CavosService();


