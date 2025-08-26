"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cavosService = void 0;
const cavos_service_sdk_1 = require("cavos-service-sdk");
const starknetService_1 = require("./starknetService");
class CavosService {
    constructor() {
        const network = process.env.CAVOS_NETWORK || 'sepolia';
        const appId = process.env.CAVOS_APP_ID || '';
        const orgSecret = process.env.CAVOS_ORG_SECRET || '';
        this.config = { network, appId, orgSecret };
        this.cavosAuth = new cavos_service_sdk_1.CavosAuth(network, appId);
    }
    getConfig() {
        return this.config;
    }
    async signUp(email, password) {
        const result = await this.cavosAuth.signUp(email, password, this.config.orgSecret);
        return result;
    }
    async signIn(email, password) {
        const result = await this.cavosAuth.signIn(email, password, this.config.orgSecret);
        return result;
    }
    async refreshToken(refreshToken) {
        const result = await this.cavosAuth.refreshToken(refreshToken, this.config.network);
        return result;
    }
    async getBalance(address, tokenAddress, decimals = '18') {
        const result = await starknetService_1.starknetService.getTokenBalance(address, tokenAddress, decimals);
        return { balance: result, formatted: String(result) };
    }
    async execute(address, calls, accessToken) {
        const result = await this.cavosAuth.executeCalls(address, calls, accessToken);
        return result;
    }
}
exports.cavosService = new CavosService();
//# sourceMappingURL=cavosService.js.map