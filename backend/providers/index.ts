import { RpcProvider } from "starknet";

export const provider = new RpcProvider({
  nodeUrl: process.env.STARKNET_RPC_URL as string,
});


