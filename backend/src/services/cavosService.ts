import { CavosAuth, executeCalls } from 'cavos-service-sdk';
import { starknetService } from './starknetService';

export interface CavosConfig {
  network: 'sepolia' | 'mainnet' | string;
  appId: string;
  orgSecret: string;
}

class CavosService {
  private cavosAuth: CavosAuth;
  private config: CavosConfig;

  constructor() {
    const network = (process.env.CAVOS_NETWORK as CavosConfig['network']) || 'sepolia';
    const appId = process.env.CAVOS_APP_ID || '';
    const orgSecret = process.env.CAVOS_ORG_SECRET || '';
    this.config = { network, appId, orgSecret };
    this.cavosAuth = new CavosAuth(network, appId);
  }

  getConfig() {
    return this.config;
  }

  async signUp(email: string, password: string) {
    const result = await this.cavosAuth.signUp(email, password, this.config.orgSecret);
    return result;
  }

  async signIn(email: string, password: string) {
    const result = await this.cavosAuth.signIn(email, password, this.config.orgSecret);
    return result;
  }

  async refreshToken(refreshToken: string) {
    const result = await this.cavosAuth.refreshToken(refreshToken, this.config.network);
    return result;
  }

  async getBalance(address: string, tokenAddress: string, decimals = '18') {
    const result = await starknetService.getTokenBalance(address, tokenAddress, decimals);
    return { balance: result, formatted: String(result) };
  }

  async execute(address: string, calls: any[], accessToken: string) {
    const result = await this.cavosAuth.executeCalls(address, calls, accessToken);
    return result;
  }
}

export const cavosService = new CavosService();


