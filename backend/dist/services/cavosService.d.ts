export interface CavosConfig {
    network: 'sepolia' | 'mainnet' | string;
    appId: string;
    orgSecret: string;
}
declare class CavosService {
    private cavosAuth;
    private config;
    constructor();
    getConfig(): CavosConfig;
    signUp(email: string, password: string): Promise<any>;
    signIn(email: string, password: string): Promise<any>;
    refreshToken(refreshToken: string): Promise<any>;
    getBalance(address: string, tokenAddress: string, decimals?: string): Promise<{
        balance: number;
        formatted: string;
    }>;
    execute(address: string, calls: any[], accessToken: string): Promise<any>;
}
export declare const cavosService: CavosService;
export {};
//# sourceMappingURL=cavosService.d.ts.map